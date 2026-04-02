// ============================================
// 네이버 부동산 API 서버
// Hono 기반 백엔드 서버
// ============================================

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import prisma from '../lib/db/prisma';
import tokenManager from '../lib/scraper/token-manager';
import authRouter, { getUserIdFromRequest } from './auth';
import { fetchRebTables, fetchRebTableItems, fetchRebTableData, getRebApiConfigStatus } from '../lib/public-data/reb-client';
import { fetchMolitCategoryRows, getMolitApiConfigStatus, type MolitCategory } from '../lib/public-data/molit-client';

const app = new Hono();

// CORS 설정
app.use('/*', cors({
  origin: (origin) => {
    // origin이 없는 요청(동일 출처, 직접 IP 접속 등)은 허용
    if (!origin) return '*';

    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://192.168.219.57:5173',
      'http://175.195.36.16:5173',
      'http://imapplepie20.tplinkdns.com:5173',
      'https://imapplepie20.tplinkdns.com',
    ];

    // tplinkdns.com 서브도메인 모두 허용
    if (/\.tplinkdns\.com(:5173)?$/.test(origin)) {
      return origin;
    }

    // 로컬 네트워크 IP 허용 (192.168.*)
    if (/^http:\/\/192\.168\.\d+\.\d+:5173$/.test(origin)) {
      return origin;
    }

    return allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  },
  credentials: true,
}));

// 인증 라우터 연결
app.route('/api/auth', authRouter);

// 헬스 체크
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// 공공데이터(REB) API
// ============================================

function normalizeRebParam(raw: string | undefined | null) {
  if (!raw) return '';
  return raw.trim();
}

function normalizeRebStatblId(raw: string | undefined | null) {
  // 입력 오타(예: 끝에 '_' 추가)로 인한 무의미한 0건 응답을 줄이기 위해
  // 우측 underscore는 제거해서 처리한다.
  const normalized = normalizeRebParam(raw);
  return normalized.replace(/_+$/g, '');
}

const REB_DEBUG_ENABLED = /^(1|true|yes|on)$/i.test(process.env.REB_DEBUG || '');

function rebDebugLog(message: string, payload?: unknown) {
  if (!REB_DEBUG_ENABLED) return;
  if (payload === undefined) {
    console.log(`[REB DEBUG] ${message}`);
    return;
  }
  console.log(`[REB DEBUG] ${message}`, payload);
}

function formatNotificationDate(dateValue: Date | string | null | undefined) {
  if (!dateValue) return '-';
  return new Date(dateValue).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function getDaysUntil(dateValue: Date | string | null | undefined) {
  if (!dateValue) return null;
  const target = new Date(dateValue);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = target.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function renderManagedPropertyNotificationTemplate(
  template: string,
  property: {
    articleName?: string | null;
    contractType?: string | null;
    contractEndDate?: Date | string | null;
    managerName?: string | null;
    managerPhone?: string | null;
    tenantName?: string | null;
    tenantPhone?: string | null;
    address?: string | null;
  }
) {
  const daysLeft = getDaysUntil(property.contractEndDate);
  const replacements: Record<string, string> = {
    '{managerName}': property.managerName || '책임자',
    '{articleName}': property.articleName || '-',
    '{contractType}': property.contractType || '-',
    '{contractEndDate}': formatNotificationDate(property.contractEndDate),
    '{daysLeft}': daysLeft !== null ? String(daysLeft) : '-',
    '{managerPhone}': property.managerPhone || '-',
    '{address}': property.address || '-',
  };

  return Object.entries(replacements).reduce((message, [token, value]) => {
    return message.split(token).join(value);
  }, template);
}

const MANAGED_PROPERTY_NOTIFICATION_TYPES = ['renewal_90', 'renewal_30', 'renewal_15', 'renewal_7', 'renewal_3', 'renewal_1'] as const;
type ManagedPropertyNotificationType = typeof MANAGED_PROPERTY_NOTIFICATION_TYPES[number];

function isManagedPropertyNotificationType(value: unknown): value is ManagedPropertyNotificationType {
  return typeof value === 'string' && MANAGED_PROPERTY_NOTIFICATION_TYPES.includes(value as ManagedPropertyNotificationType);
}

function normalizeNotificationHistory(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, raw]) => {
    if (typeof raw === 'string' && raw.trim()) {
      acc[key] = raw;
    }
    return acc;
  }, {});
}

function normalizeCustomerName(value: string | null | undefined) {
  return (value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeCustomerPhone(value: string | null | undefined) {
  return (value || '').replace(/\D/g, '');
}

function buildCustomerInfoKey(customerName: string, customerPhone?: string | null) {
  const normalizedName = normalizeCustomerName(customerName);
  const normalizedPhone = normalizeCustomerPhone(customerPhone);

  return normalizedPhone ? `${normalizedName}:${normalizedPhone}` : normalizedName;
}

function resolveCustomerInfoFromManagedProperty(property: {
  managerName?: string | null;
  managerPhone?: string | null;
}) {
  const customerName = property.managerName?.trim();
  if (!customerName) return null;

  const customerPhone = property.managerPhone?.trim() || null;

  return {
    customerKey: buildCustomerInfoKey(customerName, customerPhone),
    customerName,
    customerPhone,
  };
}

function compareContractDateDesc(
  a: { contractDate?: Date | string | null },
  b: { contractDate?: Date | string | null }
) {
  const aTime = a.contractDate ? new Date(a.contractDate).getTime() : Number.NEGATIVE_INFINITY;
  const bTime = b.contractDate ? new Date(b.contractDate).getTime() : Number.NEGATIVE_INFINITY;
  return bTime - aTime;
}

async function syncCustomerInfoForUser(userId: string) {
  // 1. 저장된 고객 목록 조회
  const customerInfos = await prisma.customerInfo.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  // 2. 모든 관리매물 조회
  const properties = await prisma.managedProperty.findMany({
    where: { userId },
    orderBy: { contractDate: 'desc' },
  });

  // 3. 매물을 customerKey 기준으로 그룹핑
  const propertyByKeyMap = new Map<string, typeof properties>();
  for (const property of properties) {
    const resolved = resolveCustomerInfoFromManagedProperty(property);
    if (!resolved) continue;
    const existing = propertyByKeyMap.get(resolved.customerKey) || [];
    propertyByKeyMap.set(resolved.customerKey, [...existing, property]);
  }

  // 4. 각 저장된 고객에 대해 매칭되는 매물 정보 연결
  const customers = customerInfos.map((ci) => {
    const matchedProperties = propertyByKeyMap.get(ci.customerKey) || [];
    const contracts = matchedProperties.map((p) => ({
      id: p.id,
      articleName: p.articleName,
      buildingName: p.buildingName,
      address: p.address,
      contractType: p.contractType,
      propertyType: p.propertyType,
      contractDate: p.contractDate,
      contractEndDate: p.contractEndDate,
      tenantName: p.tenantName,
      tenantPhone: p.tenantPhone,
      notes: p.notes,
      updatedAt: p.updatedAt,
    }));

    return {
      id: ci.id,
      key: ci.customerKey,
      customerName: ci.customerName,
      customerPhone: ci.customerPhone,
      memo: ci.memo || null,
      createdAt: ci.createdAt,
      updatedAt: ci.updatedAt,
      contractCount: contracts.length,
      contracts,
    };
  });

  return {
    customers,
    syncedCustomerCount: customers.length,
    createdCustomerCount: 0,
    skippedPropertyCount: 0,
    sourcePropertyCount: properties.length,
  };
}

async function saveCustomerInfoForProperty(userId: string, managedPropertyId: string) {
  const property = await prisma.managedProperty.findFirst({
    where: { id: managedPropertyId, userId },
  });

  if (!property) {
    throw new Error('관리매물을 찾을 수 없습니다.');
  }

  const resolvedCustomer = resolveCustomerInfoFromManagedProperty(property);
  if (!resolvedCustomer) {
    throw new Error('책임자명이 없어 고객정보를 저장할 수 없습니다.');
  }

  // 고객 단위로 upsert (같은 이름+전화번호면 기존 고객 재사용)
  const customerInfo = await prisma.customerInfo.upsert({
    where: {
      userId_customerKey: {
        userId,
        customerKey: resolvedCustomer.customerKey,
      },
    },
    update: {
      customerName: resolvedCustomer.customerName,
      customerPhone: resolvedCustomer.customerPhone,
    },
    create: {
      userId,
      customerKey: resolvedCustomer.customerKey,
      customerName: resolvedCustomer.customerName,
      customerPhone: resolvedCustomer.customerPhone,
    },
  });

  return customerInfo;
}

async function upsertCustomerInfoForConsultation(
  userId: string,
  customerName: string,
  customerPhone?: string | null
) {
  const trimmedName = customerName.trim();
  if (!trimmedName) {
    throw new Error('고객명은 비워둘 수 없습니다.');
  }

  const trimmedPhone = typeof customerPhone === 'string' && customerPhone.trim()
    ? customerPhone.trim()
    : null;

  return prisma.customerInfo.upsert({
    where: {
      userId_customerKey: {
        userId,
        customerKey: buildCustomerInfoKey(trimmedName, trimmedPhone),
      },
    },
    update: {
      customerName: trimmedName,
      customerPhone: trimmedPhone,
    },
    create: {
      userId,
      customerKey: buildCustomerInfoKey(trimmedName, trimmedPhone),
      customerName: trimmedName,
      customerPhone: trimmedPhone,
    },
  });
}

/**
 * GET /api/public/reb/tables
 * 한국부동산원 통계표 목록 조회
 * @query statblId - 통계표 ID 필터(선택)
 * @query page - 페이지 (기본 1)
 * @query size - 페이지 크기 (기본 100, 최대 1000)
 * @query type - 응답 타입(json|xml, 기본 json)
 */
app.get('/api/public/reb/tables', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }

    const statblId = normalizeRebStatblId(c.req.query('statblId'));
    const page = parseInt(c.req.query('page') || '1');
    const size = parseInt(c.req.query('size') || '100');
    const type = c.req.query('type') === 'xml' ? 'xml' : 'json';

    const result = await fetchRebTables({
      statblId,
      page,
      size,
      type,
    });

    return c.json({
      success: true,
      rows: result.rows,
      resultCode: result.resultCode,
      resultMessage: result.resultMessage,
      arrayField: result.arrayField,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('REB tables fetch error:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch REB tables',
      },
      500
    );
  }
});

/**
 * GET /api/public/reb/table-items
 * 한국부동산원 통계표 세부항목 조회
 * @query statblId - 통계표 ID(필수)
 * @query itmTag - 항목정보(선택)
 * @query page - 페이지 (기본 1)
 * @query size - 페이지 크기 (기본 100, 최대 1000)
 * @query type - 응답 타입(json|xml, 기본 json)
 */
app.get('/api/public/reb/table-items', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }

    const statblId = normalizeRebStatblId(c.req.query('statblId'));
    if (!statblId) {
      return c.json({ error: 'statblId is required' }, 400);
    }

    const itmTag = normalizeRebParam(c.req.query('itmTag')) || undefined;
    const page = parseInt(c.req.query('page') || '1');
    const size = parseInt(c.req.query('size') || '100');
    const type = c.req.query('type') === 'xml' ? 'xml' : 'json';

    const result = await fetchRebTableItems({
      statblId,
      itmTag,
      page,
      size,
      type,
    });

    return c.json({
      success: true,
      rows: result.rows,
      resultCode: result.resultCode,
      resultMessage: result.resultMessage,
      arrayField: result.arrayField,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('REB table items fetch error:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch REB table items',
      },
      500
    );
  }
});

/**
 * GET /api/public/reb/table-data
 * 한국부동산원 통계표 데이터 조회
 * @query statblId - 통계표 ID(필수)
 * @query dtacycleCd - 주기 코드(선택)
 * @query wrttimeIdtfrId - 시점 식별자(선택)
 * @query itmId - 항목 ID(선택)
 * @query clsId - 분류 ID(선택)
 * @query page - 페이지 (기본 1)
 * @query size - 페이지 크기 (기본 100, 최대 1000)
 * @query type - 응답 타입(json|xml, 기본 json)
 * @description 나머지 query 파라미터는 REB 원본 파라미터로 그대로 전달
 */
app.get('/api/public/reb/table-data', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }

    const statblId = normalizeRebStatblId(c.req.query('statblId'));
    if (!statblId) {
      return c.json({ error: 'statblId is required' }, 400);
    }

    const page = parseInt(c.req.query('page') || '1');
    const size = parseInt(c.req.query('size') || '100');
    const type = c.req.query('type') === 'xml' ? 'xml' : 'json';

    const paramAliasMap: Record<string, string> = {
      statblId: 'STATBL_ID',
      dtacycleCd: 'DTACYCLE_CD',
      wrttimeIdtfrId: 'WRTTIME_IDTFR_ID',
      itmId: 'ITM_ID',
      itmTag: 'ITM_TAG',
      clsId: 'CLS_ID',
    };

    const reservedKeys = new Set(['page', 'size', 'type']);
    const searchParams = new URL(c.req.url).searchParams;
    const filters: Record<string, string> = {};

    for (const [queryKey, queryValue] of searchParams.entries()) {
      if (reservedKeys.has(queryKey)) continue;
      const value = queryValue.trim();
      if (!value) continue;

      const mappedKey = paramAliasMap[queryKey] ?? queryKey;
      // 기본 파라미터는 상단 필드에서 처리하므로 제외
      if (mappedKey === 'STATBL_ID') continue;
      filters[mappedKey] = value;
    }

    const result = await fetchRebTableData({
      statblId,
      dtacycleCd: normalizeRebParam(c.req.query('dtacycleCd')) || undefined,
      wrttimeIdtfrId: normalizeRebParam(c.req.query('wrttimeIdtfrId')) || undefined,
      itmId: normalizeRebParam(c.req.query('itmId')) || undefined,
      itmTag: normalizeRebParam(c.req.query('itmTag')) || undefined,
      clsId: normalizeRebParam(c.req.query('clsId')) || undefined,
      page,
      size,
      type,
      filters,
    });

    rebDebugLog('table-data result', {
      statblId,
      dtacycleCd: normalizeRebParam(c.req.query('dtacycleCd')) || undefined,
      itmId: normalizeRebParam(c.req.query('itmId')) || undefined,
      itmTag: normalizeRebParam(c.req.query('itmTag')) || undefined,
      clsId: normalizeRebParam(c.req.query('clsId')) || undefined,
      count: result.rows.length,
      resultCode: result.resultCode,
      resultMessage: result.resultMessage,
      serviceName: result.serviceName,
    });

    if (typeof result.resultCode === 'string' && /^ERROR/i.test(result.resultCode)) {
      return c.json(
        {
          success: false,
          rows: result.rows,
          resultCode: result.resultCode,
          resultMessage: result.resultMessage,
          arrayField: result.arrayField,
          listTotalCount: result.listTotalCount,
          serviceName: result.serviceName,
          count: result.rows.length,
          error: `REB API 오류 (${result.resultCode}): ${result.resultMessage || '요청인자를 확인하세요.'}`,
        },
        502
      );
    }

    return c.json({
      success: true,
      rows: result.rows,
      resultCode: result.resultCode,
      resultMessage: result.resultMessage,
      arrayField: result.arrayField,
      listTotalCount: result.listTotalCount,
      serviceName: result.serviceName,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('REB table data fetch error:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch REB table data',
      },
      500
    );
  }
});

// ============================================
// 1. 인증 & 토큰 관리 API
// ============================================

/**
 * GET /api/token/status
 * 현재 토큰 상태 확인
 */
app.get('/api/token/status', async (c) => {
  try {
    const tokenRecord = await prisma.naverToken.findFirst({
      where: {
        expiresAt: {
          gte: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return c.json({
      hasToken: !!tokenRecord,
      expiresAt: tokenRecord?.expiresAt || null,
      isExpired: !tokenRecord,
    });
  } catch (error) {
    console.error('Token status error:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Token status check failed',
      },
      500
    );
  }
});

/**
 * POST /api/token/refresh
 * 토큰 강제 갱신
 */
app.post('/api/token/refresh', async (c) => {
  try {
    const token = await tokenManager.refreshToken();

    return c.json({
      success: true,
      message: 'Token refreshed successfully',
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * POST /api/token/manual
 * 토큰 수동 입력 (개발용)
 * Body: { token: string }
 */
app.post('/api/token/manual', async (c) => {
  try {
    const body = await c.req.json();
    const { token } = body;

    if (!token || typeof token !== 'string') {
      return c.json({ error: 'token is required' }, 400);
    }

    // 토큰 만료 시간 (23시간 후)
    const expiresAt = new Date(Date.now() + 23 * 60 * 60 * 1000);

    // 기존 토큰 삭제 후 새 토큰 저장
    await prisma.naverToken.deleteMany({});
    await prisma.naverToken.create({
      data: {
        accessToken: token,
        expiresAt,
      },
    });

    return c.json({
      success: true,
      message: 'Token saved successfully',
      expiresAt,
    });
  } catch (error) {
    console.error('Token manual save error:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to save token',
      },
      500
    );
  }
});

// ============================================
// 2. 지역 관리 API
// ============================================

/**
 * GET /api/regions
 * 지역 목록 조회 (DB에서만 조회 - 네이버 API 의존 제거)
 * @query cortarNo - 지역 코드 (기본: 0000000000)
 */
app.get('/api/regions', async (c) => {
  try {
    const cortarNo = c.req.query('cortarNo') || '0000000000';

    // DB에서 직접 조회 (네이버 API 호출 없음)
    const regions = await prisma.region.findMany({
      where: {
        parentCortarNo: cortarNo === '0000000000' ? null : cortarNo,
      },
      orderBy: {
        cortarName: 'asc',
      },
    });

    // 네이버 API 형식과 동일하게 응답
    return c.json({
      regionList: regions.map(r => ({
        cortarNo: r.cortarNo,
        cortarName: r.cortarName,
        cortarType: r.cortarType,
        centerLat: r.centerLat,
        centerLon: r.centerLon,
      })),
    });
  } catch (error) {
    console.error('Regions fetch error:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch regions',
      },
      500
    );
  }
});

/**
 * GET /api/regions/tree
 * 지역 트리 구조 조회 (시/도 → 시/군/구 → 읍/면/동)
 */
app.get('/api/regions/tree', async (c) => {
  try {
    const regions = await prisma.region.findMany({
      orderBy: [{ depth: 'asc' }, { cortarName: 'asc' }],
    });

    // 트리 구조 변환
    interface RegionNode {
      cortarNo: string;
      cortarName: string;
      cortarType: string;
      depth: number;
      parentCortarNo: string | null;
      centerLat: number | null;
      centerLon: number | null;
      children?: RegionNode[];
    }

    const buildTree = (parentId: string | null): RegionNode[] => {
      return regions
        .filter((r) => r.parentCortarNo === parentId)
        .map((region) => ({
          cortarNo: region.cortarNo,
          cortarName: region.cortarName,
          cortarType: region.cortarType,
          depth: region.depth,
          parentCortarNo: region.parentCortarNo,
          centerLat: region.centerLat,
          centerLon: region.centerLon,
          children: buildTree(region.cortarNo),
        }));
    };

    const tree = buildTree(null);

    return c.json({ tree });
  } catch (error) {
    console.error('Regions tree error:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch region tree',
      },
      500
    );
  }
});

// ============================================
// 3. 매물 API
// ============================================

/**
 * POST /api/properties/bulk
 * 매물 일괄 등록 (파일 파싱 데이터를 중앙 DB에 저장)
 * Body: { articles: Article[] }
 * NOTE: /bulk 경로가 단건 POST보다 먼저 정의되어야 함
 */
app.post('/api/properties/bulk', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    const body = await c.req.json();
    const { articles, dataSource } = body;

    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      return c.json({ error: 'articles array is required' }, 400);
    }

    // dataSource가 없으면 NAVER로 기본값 (네이버 검색에서 온 데이터)
    const finalDataSource = dataSource || 'NAVER';

    // complexNo 기반으로 주소 정보 일괄 조회 (매물에 주소가 없을 때 Complex에서 가져오기)
    const complexNos = [...new Set(
      articles
        .map((a: any) => a.complexNo)
        .filter((no: string | undefined) => !!no)
    )] as string[];

    let complexAddressMap: Record<string, { cortarAddress: string | null; roadAddress: string | null; detailAddress: string | null }> = {};
    if (complexNos.length > 0) {
      const complexes = await prisma.complex.findMany({
        where: { complexNo: { in: complexNos } },
        select: { complexNo: true, cortarAddress: true, roadAddress: true, detailAddress: true },
      });
      for (const cx of complexes) {
        if (cx.cortarAddress || cx.roadAddress) {
          complexAddressMap[cx.complexNo] = {
            cortarAddress: cx.cortarAddress,
            roadAddress: cx.roadAddress,
            detailAddress: cx.detailAddress,
          };
        }
      }
      console.log(`[BulkSave] Found addresses for ${Object.keys(complexAddressMap).length}/${complexNos.length} complexes`);
    }

    let savedCount = 0;
    let skippedCount = 0;
    const errors: Array<{ articleNo: string; error: string }> = [];

    for (const article of articles) {
      try {
        // 필수 필드 검증
        if (!article.articleName) {
          errors.push({ articleNo: article.articleNo || 'unknown', error: 'articleName is required' });
          skippedCount++;
          continue;
        }

        // articleNo 자동 생성 (없으면)
        let articleNo = article.articleNo;
        if (!articleNo) {
          const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
          const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
          articleNo = `PROP_${timestamp}_${randomSuffix}`;
        }

        // 가격 변환 함수 ("47억", "18억5,000" → 숫자)
        const parsePrice = (priceStr: string | number | null | undefined): number | null => {
          if (priceStr === null || priceStr === undefined) return null;
          if (typeof priceStr === 'number') return priceStr;

          // "47억" → 4700000000
          // "18억5,000" → 180005000
          // "1억2,345" → 10002345
          // "1,234" → 1234
          const str = String(priceStr).trim();
          const eokMatch = str.match(/(\d+)억/);
          const manMatch = str.match(/(\d+),?(\d+)/);
          const onlyMan = str.match(/^(\d+),?(\d+)$/);

          if (eokMatch && manMatch) {
            // "18억5,000" 형식
            const eok = parseInt(eokMatch[1]) * 10000;
            const man = parseInt(manMatch[1] + (manMatch[2] || ''));
            return eok + man;
          } else if (eokMatch) {
            // "47억" 형식
            return parseInt(eokMatch[1]) * 10000;
          } else if (onlyMan) {
            // "5,000" 또는 "5000" 형식 (만원 단위)
            return parseInt((onlyMan[1] + (onlyMan[2] || '')).replace(/,/g, ''));
          }
          return parseInt(str.replace(/,/g, '')) || null;
        };

        // 위도/경도 변환
        const parseCoord = (coord: string | number | null | undefined): number | null => {
          if (coord === null || coord === undefined) return null;
          if (typeof coord === 'number') return coord;
          const parsed = parseFloat(String(coord));
          return isNaN(parsed) ? null : parsed;
        };

        // 면적 변환
        const parseArea = (area: string | number | null | undefined): number | null => {
          if (area === null || area === undefined) return null;
          if (typeof area === 'number') return area;
          const parsed = parseFloat(String(area));
          return isNaN(parsed) ? null : parsed;
        };

        // upsert: 동일 articleNo가 있으면 업데이트, 없으면 생성
        await prisma.property.upsert({
          where: { articleNo },
          update: {
            articleName: article.articleName,
            articleStatus: 'R0', // 정상
            realEstateTypeCode: article.realEstateTypeCode || 'APT',
            realEstateTypeName: article.realEstateTypeName || '아파트',
            tradeTypeCode: article.tradeTypeCode || 'A1',
            tradeTypeName: article.tradeTypeName || '매매',
            dealOrWarrantPrc: parsePrice(article.dealOrWarrantPrc),
            rentPrc: parsePrice(article.rentPrc),
            area1: parseArea(article.area1),
            area2: parseArea(article.area2),
            floorInfo: article.floorInfo || null,
            direction: article.direction || null,
            buildingName: article.buildingName || article.articleName || null,
            latitude: parseCoord(article.latitude),
            longitude: parseCoord(article.longitude),
            cortarNo: article.cortarNo || '0000000000',
            cortarAddress: article.cortarAddress || (article.complexNo && complexAddressMap[article.complexNo]?.cortarAddress) || null,
            roadAddress: article.roadAddress || (article.complexNo && complexAddressMap[article.complexNo]?.roadAddress) || null,
            detailAddress: article.detailAddress || null,
            articleConfirmYmd: article.articleConfirmYmd || null,
            articleFeatureDesc: article.articleFeatureDesc || null,
            tagList: Array.isArray(article.tagList) ? JSON.stringify(article.tagList) : null,
            cpName: article.cpName || null,
            realtorName: article.realtorName || null,
            cpPcArticleUrl: article.cpPcArticleUrl || null,
            cpMobileArticleUrl: article.cpMobileArticleUrl || null,
            complexNo: article.complexNo || null,
            dataSource: finalDataSource, // NAVER(크롤링) 또는 UPLOAD(파일)
            userId, // 사용자 ID (로그인한 경우)
            lastCrawledAt: new Date(),
            cacheExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30일
          },
          create: {
            articleNo,
            articleName: article.articleName,
            articleStatus: 'R0',
            realEstateTypeCode: article.realEstateTypeCode || 'APT',
            realEstateTypeName: article.realEstateTypeName || '아파트',
            tradeTypeCode: article.tradeTypeCode || 'A1',
            tradeTypeName: article.tradeTypeName || '매매',
            dealOrWarrantPrc: parsePrice(article.dealOrWarrantPrc),
            rentPrc: parsePrice(article.rentPrc),
            area1: parseArea(article.area1),
            area2: parseArea(article.area2),
            floorInfo: article.floorInfo || null,
            direction: article.direction || null,
            buildingName: article.buildingName || article.articleName || null,
            latitude: parseCoord(article.latitude),
            longitude: parseCoord(article.longitude),
            cortarNo: article.cortarNo || '0000000000',
            cortarAddress: article.cortarAddress || (article.complexNo && complexAddressMap[article.complexNo]?.cortarAddress) || null,
            roadAddress: article.roadAddress || (article.complexNo && complexAddressMap[article.complexNo]?.roadAddress) || null,
            detailAddress: article.detailAddress || null,
            articleConfirmYmd: article.articleConfirmYmd || null,
            articleFeatureDesc: article.articleFeatureDesc || null,
            tagList: Array.isArray(article.tagList) ? JSON.stringify(article.tagList) : null,
            cpName: article.cpName || null,
            realtorName: article.realtorName || null,
            cpPcArticleUrl: article.cpPcArticleUrl || null,
            cpMobileArticleUrl: article.cpMobileArticleUrl || null,
            complexNo: article.complexNo || null,
            dataSource: finalDataSource, // NAVER(크롤링) 또는 UPLOAD(파일)
            userId, // 사용자 ID (로그인한 경우)
            lastCrawledAt: new Date(),
            cacheExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });
        savedCount++;
      } catch (err) {
        console.error(`Failed to save article ${article.articleNo}:`, err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        // Prisma 에러에서 상세 정보 추출
        if (err instanceof Error) {
          const stack = err.stack || '';
          console.error('Error stack:', stack);
        }
        errors.push({ articleNo: article.articleNo || 'unknown', error: errorMessage });
        skippedCount++;
      }
    }

    return c.json({
      success: true,
      savedCount,
      skippedCount,
      totalRequested: articles.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Bulk save to central DB error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to bulk save properties';
    const errorDetails = error instanceof Error ? {
      message: error.message,
      name: error.name,
      stack: error.stack?.split('\n').slice(0, 3).join('\n'),
    } : { message: String(error) };
    return c.json(
      {
        error: errorMessage,
        details: errorDetails,
      },
      500
    );
  }
});

/**
 * POST /api/properties/backfill-addresses
 * 기존 매물의 주소가 비어있는 경우 complexNo 기반으로 네이버 API에서 주소를 가져와 업데이트
 */
app.post('/api/properties/backfill-addresses', async (c) => {
  try {
    const { default: naverLandClient } = await import('../lib/scraper/naver-client');

    // cortarAddress가 null이고 complexNo가 있는 매물 조회
    const propertiesWithoutAddress = await prisma.property.findMany({
      where: {
        cortarAddress: null,
        complexNo: { not: null },
      },
      select: { articleNo: true, complexNo: true },
    });

    if (propertiesWithoutAddress.length === 0) {
      return c.json({ success: true, message: '업데이트할 매물이 없습니다.', updatedCount: 0 });
    }

    // 고유 complexNo 추출
    const uniqueComplexNos = [...new Set(
      propertiesWithoutAddress.map(p => p.complexNo).filter(Boolean)
    )] as string[];

    console.log(`[Backfill] ${propertiesWithoutAddress.length}개 매물, ${uniqueComplexNos.length}개 단지의 주소 업데이트 시작`);

    // 각 complexNo별로 주소 조회
    const addressMap: Record<string, { cortarAddress: string | null; roadAddress: string | null; detailAddress: string | null }> = {};

    for (const cNo of uniqueComplexNos) {
      try {
        const detail = await naverLandClient.getComplexDetail(cNo);
        const cortarAddress = detail?.complex?.cortarAddress || null;
        const roadAddress = detail?.complexDetail?.roadAddress || null;
        const detailAddress = detail?.complexDetail?.detailAddress || null;

        if (cortarAddress || roadAddress) {
          addressMap[cNo] = { cortarAddress, roadAddress, detailAddress };
          console.log(`[Backfill] ${cNo}: cortarAddress=${cortarAddress}, roadAddress=${roadAddress}`);
        }

        // Rate limiting 방지
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (err) {
        console.error(`[Backfill] Failed to fetch detail for ${cNo}:`, err);
      }
    }

    // 매물 업데이트
    let updatedCount = 0;
    for (const prop of propertiesWithoutAddress) {
      if (prop.complexNo && addressMap[prop.complexNo]) {
        const addr = addressMap[prop.complexNo];
        await prisma.property.update({
          where: { articleNo: prop.articleNo },
          data: {
            cortarAddress: addr.cortarAddress,
            roadAddress: addr.roadAddress,
            detailAddress: addr.detailAddress,
          },
        });
        updatedCount++;
      }
    }

    console.log(`[Backfill] 완료: ${updatedCount}/${propertiesWithoutAddress.length}개 업데이트`);
    return c.json({ success: true, updatedCount, totalChecked: propertiesWithoutAddress.length });
  } catch (error) {
    console.error('Backfill error:', error);
    return c.json({ error: 'Failed to backfill addresses' }, 500);
  }
});

/**
 * POST /api/properties/backfill-user
 * userId가 없는 기존 매물을 현재 로그인 사용자에게 귀속
 * Body: { dataSource?: 'UPLOAD' | 'NAVER' | 'ALL' }
 */
app.post('/api/properties/backfill-user', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }

    let body: any = {};
    try {
      body = await c.req.json();
    } catch {
      body = {};
    }

    const dataSource = body.dataSource || c.req.query('dataSource') || 'UPLOAD';
    const where: any = { userId: null };
    if (dataSource !== 'ALL') {
      where.dataSource = dataSource;
    }

    const result = await prisma.property.updateMany({
      where,
      data: { userId },
    });

    return c.json({
      success: true,
      updatedCount: result.count,
      assignedUserId: userId,
      dataSource,
    });
  } catch (error) {
    console.error('Backfill user error:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to backfill user ownership',
      },
      500
    );
  }
});

/**
 * GET /api/properties
 * 중앙 DB 매물 목록 조회 (사용자별 필터링)
 * @query dataSource - NAVER(네이버), UPLOAD(파일업로드), ALL(전체)
 * @query tradeTypeCode - 거래방식 필터 (A1, B1, B2, B3)
 * @query cortarNo - 지역 코드 필터
 * @query page - 페이지 번호 (default: 1)
 * @query limit - 페이지 당 개수 (default: 50)
 * @query allUsers - true이면 모든 사용자 매물 조회 (관리자용)
 */
app.get('/api/properties', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    const dataSource = c.req.query('dataSource') || 'ALL';
    const tradeTypeCode = c.req.query('tradeTypeCode');
    const cortarNo = c.req.query('cortarNo');
    const page = parseInt(c.req.query('page') || '1');
    const limitParam = c.req.query('limit');
    const limit = limitParam ? parseInt(limitParam) : null;
    const skip = (page - 1) * (limit || 0);
    const allUsers = c.req.query('allUsers') === 'true';

    // where 조건构建
    const where: any = {};
    if (dataSource !== 'ALL') {
      where.dataSource = dataSource;
    }
    if (tradeTypeCode) {
      where.tradeTypeCode = tradeTypeCode;
    }
    if (cortarNo) {
      where.cortarNo = cortarNo;
    }
    // 사용자 필터: 로그인한 경우 본인 매물만 조회 (allUsers=true 제외)
    if (userId && !allUsers) {
      where.userId = userId;
    } else if (!userId) {
      // 비로그인: 빈 결과 반환 (로그인 필요)
      return c.json({
        success: true,
        properties: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      });
    }

    const [properties, totalCount] = await Promise.all([
      prisma.property.findMany({
        where,
        ...(limit ? { skip, take: limit } : {}),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.property.count({ where }),
    ]);

    // tagList JSON 파싱
    const parsedProperties = properties.map(p => ({
      ...p,
      tagList: p.tagList ? JSON.parse(p.tagList) : [],
    }));

    return c.json({
      success: true,
      properties: parsedProperties,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: limit ? Math.ceil(totalCount / limit) : 1,
      },
    });
  } catch (error) {
    console.error('Properties fetch error:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch properties',
      },
      500
    );
  }
});

/**
 * DELETE /api/properties/:articleNo
 * 중앙 DB 매물 삭제 (소유자 확인)
 */
app.delete('/api/properties/:articleNo', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    const articleNo = c.req.param('articleNo');

    // 먼저 매물 조회
    const property = await prisma.property.findUnique({
      where: { articleNo },
      select: { userId: true },
    });

    if (!property) {
      return c.json({ error: '매물을 찾을 수 없습니다.' }, 404);
    }

    // 소유자 확인 (null인 경우 누구나 삭제 가능, 아니면 본인만)
    if (property.userId !== null && property.userId !== userId) {
      return c.json({ error: '삭제 권한이 없습니다.' }, 403);
    }

    await prisma.property.delete({
      where: { articleNo },
    });

    return c.json({ success: true, message: 'Property deleted' });
  } catch (error) {
    console.error('Property delete error:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to delete property',
      },
      500
    );
  }
});

/**
 * PUT /api/properties/:articleNo
 * 중앙 DB 매물 수정 (소유자 확인)
 */
app.put('/api/properties/:articleNo', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    const articleNo = c.req.param('articleNo');
    const body = await c.req.json();

    // 먼저 매물 조회하여 소유자 확인
    const property = await prisma.property.findUnique({
      where: { articleNo },
      select: { userId: true },
    });

    if (!property) {
      return c.json({ error: '매물을 찾을 수 없습니다.' }, 404);
    }

    // 소유자 확인 (null인 경우 누구나 수정 가능, 아니면 본인만)
    if (property.userId !== null && property.userId !== userId) {
      return c.json({ error: '수정 권한이 없습니다.' }, 403);
    }

    // 업데이트 가능한 필드만 추출
    const updateData: any = {};

    // 기본 정보
    const allowedFields = [
      'articleName', 'buildingName', 'detailAddress',
      'realEstateTypeCode', 'realEstateTypeName',
      'tradeTypeCode', 'tradeTypeName',
      'dealOrWarrantPrc', 'rentPrc',
      'area1', 'area2', 'floorInfo',
      'managerName', 'managerPhone',
      'articleFeatureDesc', 'articleConfirmYmd',
      'direction', 'latitude', 'longitude',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // 매물 수정
    const updatedProperty = await prisma.property.update({
      where: { articleNo },
      data: updateData,
    });

    return c.json({ success: true, property: updatedProperty });
  } catch (error) {
    console.error('Property update error:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to update property',
      },
      500
    );
  }
});

/**
 * POST /api/properties
 * 매물 직접 등록 (문서에서 가져온 데이터)
 */
app.post('/api/properties', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    console.log('[POST /api/properties] userId:', userId);
    const body = await c.req.json();

    // 필수 필드 검증
    if (!body.articleName) {
      return c.json({ error: 'articleName is required' }, 400);
    }

    // articleNo 자동 생성 (없으면)
    let articleNo = body.articleNo;
    if (!articleNo) {
      // 타임스탬프 + 난수 랜덤 생성 (예: PROP_20260302_001)
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      articleNo = `PROP_${timestamp}_${randomSuffix}`;
    }

    // 매물 생성
    const property = await prisma.property.create({
      data: {
        articleNo,
        articleName: body.articleName,
        articleStatus: 'R0', // 정상
        realEstateTypeCode: body.realEstateTypeCode || 'APT',
        realEstateTypeName: body.realEstateTypeName || '아파트',
        tradeTypeCode: body.tradeTypeCode || 'A1',
        tradeTypeName: body.tradeTypeName || '매매',
        dealOrWarrantPrc: body.dealOrWarrantPrc || null,
        rentPrc: body.rentPrc || null,
        area1: body.area1 || null,
        area2: body.area2 || null,
        floorInfo: body.floorInfo || null,
        direction: body.direction || null,
        buildingName: body.buildingName || body.articleName || null,
        latitude: body.latitude || null,
        longitude: body.longitude || null,
        cortarNo: body.cortarNo || '0000000000',
        cortarAddress: body.cortarAddress || null,
        detailAddress: body.detailAddress || null,
        articleConfirmYmd: body.articleConfirmYmd || null,
        articleFeatureDesc: body.articleFeatureDesc || null,
        tagList: Array.isArray(body.tagList) ? JSON.stringify(body.tagList) : null,
        cpName: body.cpName || null,
        realtorName: body.realtorName || null,
        cpPcArticleUrl: body.cpPcArticleUrl || null,
        cpMobileArticleUrl: body.cpMobileArticleUrl || null,
        complexNo: body.complexNo || null,
        dataSource: body.dataSource || 'NAVER', // 데이터 소스 (기본: NAVER)
        userId, // 사용자 ID (로그인한 경우)
        lastCrawledAt: new Date(),
        cacheExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30일
      },
    });

    // tagList JSON 파싱 후 반환
    const tagList = property.tagList ? JSON.parse(property.tagList) : [];

    return c.json({
      success: true,
      property: {
        ...property,
        tagList,
      },
    });
  } catch (error) {
    console.error('Property creation error:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create property',
      },
      500
    );
  }
});

/**
 * GET /api/articles/complex/:complexNo
 * 단지별 매물 목록 조회 (네이버 부동산 단지 상세 페이지 API)
 * NOTE: /api/articles보다 먼저 정의해야 라우팅 순서 문제가 발생하지 않음
 */
app.get('/api/articles/complex/:complexNo', async (c) => {
  try {
    const complexNo = c.req.param('complexNo');
    if (!complexNo) {
      return c.json({ error: 'complexNo is required' }, 400);
    }

    const { default: naverLandClient } = await import('../lib/scraper/naver-client');
    const response = await naverLandClient.getComplexArticles(complexNo, {
      realEstateType: c.req.query('realEstateType') || 'APT:PRE',
      tradeType: c.req.query('tradeType') || '',
      page: c.req.query('page') ? parseInt(c.req.query('page')!) : 1,
      order: c.req.query('order') || 'rank',
      priceType: c.req.query('priceType') || 'RETAIL',
      tag: c.req.query('tag') || '::'.repeat(4),
      rentPriceMin: c.req.query('rentPriceMin') ? parseInt(c.req.query('rentPriceMin')!) : undefined,
      rentPriceMax: c.req.query('rentPriceMax') ? parseInt(c.req.query('rentPriceMax')!) : undefined,
      priceMin: c.req.query('priceMin') ? parseInt(c.req.query('priceMin')!) : undefined,
      priceMax: c.req.query('priceMax') ? parseInt(c.req.query('priceMax')!) : undefined,
      areaMin: c.req.query('areaMin') ? parseInt(c.req.query('areaMin')!) : undefined,
      areaMax: c.req.query('areaMax') ? parseInt(c.req.query('areaMax')!) : undefined,
      buildingNos: c.req.query('buildingNos') || '',
      areaNos: c.req.query('areaNos') || '',
    });

    // 단지 주소 정보를 DB에서 조회하여 매물에 주입
    if (response.articleList && Array.isArray(response.articleList)) {
      let complexAddress: { cortarAddress: string | null; roadAddress: string | null; detailAddress: string | null } = {
        cortarAddress: null, roadAddress: null, detailAddress: null,
      };

      // 1. DB Complex 테이블에서 주소 조회
      const complex = await prisma.complex.findUnique({
        where: { complexNo },
        select: { cortarAddress: true, roadAddress: true, detailAddress: true },
      });

      if (complex && (complex.cortarAddress || complex.roadAddress)) {
        complexAddress = complex;
        console.log(`[ArticlesComplex] Using DB address for ${complexNo}: ${complex.cortarAddress}`);
      } else {
        // 2. DB에 주소가 없으면 네이버 API로 조회 후 DB 업데이트
        try {
          const detail = await naverLandClient.getComplexDetail(complexNo);
          const cortarAddress = detail?.complex?.cortarAddress || null;
          const roadAddress = detail?.complexDetail?.roadAddress || null;
          const detailAddr = detail?.complexDetail?.detailAddress || null;

          if (cortarAddress || roadAddress) {
            complexAddress = { cortarAddress, roadAddress, detailAddress: detailAddr };
            console.log(`[ArticlesComplex] Fetched address from Naver for ${complexNo}: ${cortarAddress}`);

            // DB에 주소 업데이트 (비동기)
            prisma.complex.update({
              where: { complexNo },
              data: { cortarAddress, roadAddress, detailAddress: detailAddr },
            }).catch(err => console.error(`[ArticlesComplex] Failed to update complex address:`, err));
          }
        } catch (err) {
          console.error(`[ArticlesComplex] Failed to fetch complex detail for ${complexNo}:`, err);
        }
      }

      // 3. 각 매물에 주소 정보 주입
      if (complexAddress.cortarAddress || complexAddress.roadAddress) {
        response.articleList = response.articleList.map((article: any) => ({
          ...article,
          cortarAddress: article.cortarAddress || complexAddress.cortarAddress,
          roadAddress: article.roadAddress || complexAddress.roadAddress,
          complexNo, // complexNo도 주입
        }));
      } else {
        // 주소 없어도 complexNo는 주입
        response.articleList = response.articleList.map((article: any) => ({
          ...article,
          complexNo,
        }));
      }
    }

    return c.json(response);
  } catch (error) {
    console.error('Complex articles fetch error:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch complex articles',
      },
      500
    );
  }
});

/**
 * GET /api/articles
 * 매물 목록 조회 (빌라/주택/원룸/상가 등)
 */
app.get('/api/articles', async (c) => {
  try {
    const cortarNo = c.req.query('cortarNo');
    if (!cortarNo) {
      return c.json({ error: 'cortarNo is required' }, 400);
    }

    const { default: naverLandClient } = await import('../lib/scraper/naver-client');
    const response = await naverLandClient.getArticles({
      cortarNo,
      order: (c.req.query('order') as any) || 'rank',
      realEstateType: c.req.query('realEstateType') || '',
      tradeType: c.req.query('tradeType') || '',
      priceMin: c.req.query('priceMin') ? parseInt(c.req.query('priceMin')!) : undefined,
      priceMax: c.req.query('priceMax') ? parseInt(c.req.query('priceMax')!) : undefined,
      areaMin: c.req.query('areaMin') ? parseInt(c.req.query('areaMin')!) : undefined,
      areaMax: c.req.query('areaMax') ? parseInt(c.req.query('areaMax')!) : undefined,
      page: c.req.query('page') ? parseInt(c.req.query('page')!) : 1,
      markerId: c.req.query('markerId') || undefined,  // 특정 단지의 매물만 가져오기
    });

    // DB에 저장
    if (response.articleList && Array.isArray(response.articleList)) {
      for (const article of response.articleList) {
        await prisma.property.upsert({
          where: { articleNo: article.articleNo },
          update: {
            articleName: article.articleName,
            articleStatus: article.articleStatus,
            realEstateTypeCode: article.realEstateTypeCode,
            realEstateTypeName: article.realEstateTypeName,
            tradeTypeCode: article.tradeTypeCode,
            tradeTypeName: article.tradeTypeName,
            dealOrWarrantPrc: typeof article.dealOrWarrantPrc === 'string' ? parseInt(article.dealOrWarrantPrc.replace(/,/g, '')) || null : article.dealOrWarrantPrc || null,
            rentPrc: article.rentPrc ? (typeof article.rentPrc === 'string' ? parseInt(article.rentPrc) : article.rentPrc) : null,
            area1: article.area1,
            area2: article.area2,
            floorInfo: article.floorInfo,
            direction: article.direction || null,
            buildingName: article.buildingName || null,
            latitude: typeof article.latitude === 'string' ? parseFloat(article.latitude) : article.latitude,
            longitude: typeof article.longitude === 'string' ? parseFloat(article.longitude) : article.longitude,
            cortarNo: article.cortarNo || cortarNo,
            cortarAddress: article.cortarAddress || null,
            detailAddress: article.detailAddress,
            articleConfirmYmd: article.articleConfirmYmd,
            articleFeatureDesc: article.articleFeatureDesc,
            tagList: JSON.stringify(article.tagList || []),
            cpName: article.cpName || null,
            realtorName: article.realtorName || null,
            cpPcArticleUrl: article.cpPcArticleUrl || null,
            cpMobileArticleUrl: article.cpMobileArticleUrl || null,
          },
          create: {
            articleNo: article.articleNo,
            articleName: article.articleName,
            articleStatus: article.articleStatus,
            realEstateTypeCode: article.realEstateTypeCode,
            realEstateTypeName: article.realEstateTypeName,
            tradeTypeCode: article.tradeTypeCode,
            tradeTypeName: article.tradeTypeName,
            dealOrWarrantPrc: typeof article.dealOrWarrantPrc === 'string' ? parseInt(article.dealOrWarrantPrc.replace(/,/g, '')) || null : article.dealOrWarrantPrc || null,
            rentPrc: article.rentPrc ? (typeof article.rentPrc === 'string' ? parseInt(article.rentPrc) : article.rentPrc) : null,
            area1: article.area1,
            area2: article.area2,
            floorInfo: article.floorInfo,
            direction: article.direction || null,
            buildingName: article.buildingName || null,
            latitude: typeof article.latitude === 'string' ? parseFloat(article.latitude) : article.latitude,
            longitude: typeof article.longitude === 'string' ? parseFloat(article.longitude) : article.longitude,
            cortarNo: article.cortarNo || cortarNo,
            cortarAddress: article.cortarAddress || null,
            detailAddress: article.detailAddress,
            articleConfirmYmd: article.articleConfirmYmd,
            articleFeatureDesc: article.articleFeatureDesc,
            tagList: JSON.stringify(article.tagList || []),
            cpName: article.cpName || null,
            realtorName: article.realtorName || null,
            cpPcArticleUrl: article.cpPcArticleUrl || null,
            cpMobileArticleUrl: article.cpMobileArticleUrl || null,
          },
        });
      }
    }

    return c.json(response);
  } catch (error) {
    console.error('Articles fetch error:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch articles',
      },
      500
    );
  }
});

// ============================================
// 4. 단지 API (아파트/오피스텔)
// ============================================

/**
 * GET /api/complexes
 * 단지 목록 조회 (가격 정보 포함)
 */
app.get('/api/complexes', async (c) => {
  try {
    const cortarNo = c.req.query('cortarNo');
    if (!cortarNo) {
      return c.json({ error: 'cortarNo is required' }, 400);
    }

    // 지역 정보에서 좌표 가져오기
    const region = await prisma.region.findUnique({
      where: { cortarNo },
    });

    let centerLat = 37.566427;  // 서울시 기본값
    let centerLon = 126.977872;
    let zoom = 16;

    if (region && region.centerLat && region.centerLon) {
      centerLat = region.centerLat;
      centerLon = region.centerLon;
    }

    // zoom 레벨에 따른 boundary 계산
    // zoom 16 = 약 0.02도 범위
    const zoomLevel = c.req.query('zoom') ? parseInt(c.req.query('zoom')!) : 16;
    const latDelta = 0.02 / Math.pow(2, zoomLevel - 14);
    const lonDelta = 0.03 / Math.pow(2, zoomLevel - 14);

    const tradeType = (c.req.query('tradeType') as any) || 'A1';
    const realEstateType = (c.req.query('realEstateType') as any) || 'APT';

    const { default: naverLandClient } = await import('../lib/scraper/naver-client');
    const response = await naverLandClient.getComplexMarkers({
      cortarNo,
      realEstateType,
      tradeType,
      zoom: zoomLevel,
      leftLon: centerLon - lonDelta,
      rightLon: centerLon + lonDelta,
      topLat: centerLat + latDelta,
      bottomLat: centerLat - latDelta,
    });

    const complexList = Array.isArray(response) ? response : (response.complexMarkerList || []);

    // DB에서 기존 주소 정보 조회
    const complexNos = complexList.map((c: any) => c.markerId);
    const dbComplexes = await prisma.complex.findMany({
      where: { complexNo: { in: complexNos } },
      select: {
        complexNo: true,
        cortarAddress: true,
        roadAddress: true,
        detailAddress: true,
      },
    });

    const dbAddressMap: Record<string, { cortarAddress: string | null; roadAddress: string | null; detailAddress: string | null }> = {};
    for (const c of dbComplexes) {
      dbAddressMap[c.complexNo] = {
        cortarAddress: c.cortarAddress,
        roadAddress: c.roadAddress,
        detailAddress: c.detailAddress,
      };
    }

    // DB에 단지 정보 저장 (주소가 없으면 네이버 API에서 null 아닌 값 사용)
    if (complexList && Array.isArray(complexList)) {
      for (const complex of complexList) {
        const existing = dbAddressMap[complex.markerId];
        const apiCortarAddress = complex.cortarAddress || null;

        await prisma.complex.upsert({
          where: { complexNo: complex.markerId },
          update: {
            complexName: complex.complexName,
            realEstateTypeCode: complex.realEstateTypeCode,
            realEstateTypeName: complex.realEstateTypeName,
            latitude: complex.latitude,
            longitude: complex.longitude,
            cortarNo,
            cortarAddress: existing?.cortarAddress || apiCortarAddress, // DB값 우선, 없으면 API값
            roadAddress: existing?.roadAddress || null,
            detailAddress: existing?.detailAddress || null,
            completionYearMonth: complex.completionYearMonth,
            totalDongCount: complex.totalDongCount,
            totalHouseholdCount: complex.totalHouseholdCount,
            floorAreaRatio: complex.floorAreaRatio,
            minArea: complex.minArea ? parseFloat(complex.minArea) : null,
            maxArea: complex.maxArea ? parseFloat(complex.maxArea) : null,
            representativeArea: complex.representativeArea,
            dealCount: complex.dealCount,
            leaseCount: complex.leaseCount,
            rentCount: complex.rentCount,
            totalArticleCount: complex.totalArticleCount,
          },
          create: {
            complexNo: complex.markerId,
            complexName: complex.complexName,
            realEstateTypeCode: complex.realEstateTypeCode,
            realEstateTypeName: complex.realEstateTypeName,
            latitude: complex.latitude,
            longitude: complex.longitude,
            cortarNo,
            cortarAddress: apiCortarAddress, // API값 사용
            roadAddress: null,
            detailAddress: null,
            completionYearMonth: complex.completionYearMonth,
            totalDongCount: complex.totalDongCount,
            totalHouseholdCount: complex.totalHouseholdCount,
            floorAreaRatio: complex.floorAreaRatio,
            minArea: complex.minArea ? parseFloat(complex.minArea) : null,
            maxArea: complex.maxArea ? parseFloat(complex.maxArea) : null,
            representativeArea: complex.representativeArea,
            dealCount: complex.dealCount,
            leaseCount: complex.leaseCount,
            rentCount: complex.rentCount,
            totalArticleCount: complex.totalArticleCount,
          },
        });
      }
    }

    // 주소가 없는 단지만 별도로 비동기 업데이트 (roadAddress, detailAddress)
    setImmediate(async () => {
      const { default: naverLandClient } = await import('../lib/scraper/naver-client');
      const complexesWithoutFullAddress = complexList.filter((c: any) => !dbAddressMap[c.markerId]?.roadAddress);

      if (complexesWithoutFullAddress.length > 0) {
        console.log(`[Complex] Starting full address update for ${complexesWithoutFullAddress.length} complexes`);
        for (const complex of complexesWithoutFullAddress) {
          try {
            const detail = await naverLandClient.getComplexDetail(complex.markerId);
            const cortarAddress = detail?.complex?.cortarAddress || null;
            const roadAddress = detail?.complexDetail?.roadAddress || null;
            const detailAddress = detail?.complexDetail?.detailAddress || null;

            if (cortarAddress || roadAddress || detailAddress) {
              await prisma.complex.update({
                where: { complexNo: complex.markerId },
                data: {
                  cortarAddress: cortarAddress || complex.cortarAddress || null,
                  roadAddress,
                  detailAddress,
                },
              });
              console.log(`[Complex] ${complex.markerId} updated with full address`);
            }
          } catch (error) {
            console.error(`[Complex] Failed to fetch address info for ${complex.markerId}:`, error);
          }
        }
      }
    });

    // 가격 정보 조회: 매물이 있는 단지들의 대표 가격 가져오기
    const complexesWithArticles = complexList.filter((cx: any) => cx.totalArticleCount > 0);

    console.log(`[Complexes] 총 ${complexList.length}개 단지, 매물 있는 단지: ${complexesWithArticles.length}개`);

    // 단지별 대표 가격 정보 조회 (병렬로 최대 5개씩)
    const enrichedPrices: Record<string, { price: string; tradeType: string; tradeTypeCode: string; rentPrc?: string; area?: number }> = {};

    const BATCH_SIZE = 5;
    for (let i = 0; i < complexesWithArticles.length; i += BATCH_SIZE) {
      const batch = complexesWithArticles.slice(i, i + BATCH_SIZE);
      const promises = batch.map(async (cx: any) => {
        try {
          const articlesResp = await naverLandClient.getComplexArticles(cx.markerId, {
            realEstateType: realEstateType === 'APT' ? 'APT:PRE' : 'OPST',
            tradeType: '',  // 거래유형 필터 없이 모든 매물 조회
            page: 1,
            order: 'prcAsc',  // 낮은 가격순으로 대표 가격
          });
          if (articlesResp.articleList && articlesResp.articleList.length > 0) {
            const firstArticle = articlesResp.articleList[0];
            enrichedPrices[cx.markerId] = {
              price: String(firstArticle.dealOrWarrantPrc || ''),
              tradeType: firstArticle.tradeTypeName,
              tradeTypeCode: firstArticle.tradeTypeCode,
              rentPrc: firstArticle.rentPrc ? String(firstArticle.rentPrc) : undefined,
              area: firstArticle.area2 || firstArticle.area1,
            };
            console.log(`[Price] ${cx.complexName}: ${firstArticle.tradeTypeName} ${firstArticle.dealOrWarrantPrc}`);
          } else {
            console.log(`[Price] ${cx.complexName}: 매물 0건 (markerId: ${cx.markerId})`);
          }
        } catch (err: any) {
          console.error(`[Price ERROR] ${cx.complexName} (${cx.markerId}):`, err?.message || err);
        }
      });
      await Promise.all(promises);
    }

    console.log(`[Complexes] 가격 조회 완료: ${Object.keys(enrichedPrices).length}/${complexesWithArticles.length}개 성공`);

    // 단지 목록에 가격 정보 추가
    const enrichedComplexList = complexList.map((cx: any) => ({
      ...cx,
      ...(enrichedPrices[cx.markerId] ? {
        representativePrice: enrichedPrices[cx.markerId].price,
        representativeTrade: enrichedPrices[cx.markerId].tradeType,
        representativeTradeCode: enrichedPrices[cx.markerId].tradeTypeCode,
        representativeRentPrc: enrichedPrices[cx.markerId].rentPrc,
        representativeArea: enrichedPrices[cx.markerId].area || cx.representativeArea,
      } : {}),
    }));

    return c.json({ complexMarkerList: enrichedComplexList });
  } catch (error) {
    console.error('Complexes fetch error:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch complexes',
      },
      500
    );
  }
});

/**
 * GET /api/complexes/:complexNo
 * 단지 상세 조회 (DB에서)
 */
app.get('/api/complexes/:complexNo', async (c) => {
  try {
    const complexNo = c.req.param('complexNo');

    const complex = await prisma.complex.findUnique({
      where: { complexNo },
    });

    if (!complex) {
      return c.json({ error: 'Complex not found' }, 404);
    }

    return c.json({ complex });
  } catch (error) {
    console.error('Complex detail fetch error:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch complex detail',
      },
      500
    );
  }
});

/**
 * POST /api/complexes/batch-address
 * 단지 주소 정보 일괄 조회 (DB에서)
 * Body: { complexNos: string[] }
 */
app.post('/api/complexes/batch-address', async (c) => {
  try {
    const body = await c.req.json();
    const { complexNos } = body;

    if (!Array.isArray(complexNos) || complexNos.length === 0) {
      return c.json({ error: 'complexNos array is required' }, 400);
    }

    const complexes = await prisma.complex.findMany({
      where: {
        complexNo: { in: complexNos },
      },
      select: {
        complexNo: true,
        cortarAddress: true,
        roadAddress: true,
        detailAddress: true,
      },
    });

    // complexNo를 키로 하는 맵 생성
    const addressMap: Record<string, { cortarAddress: string | null; roadAddress: string | null; detailAddress: string | null }> = {};
    for (const complex of complexes) {
      addressMap[complex.complexNo] = {
        cortarAddress: complex.cortarAddress,
        roadAddress: complex.roadAddress,
        detailAddress: complex.detailAddress,
      };
    }

    return c.json({ addresses: addressMap });
  } catch (error) {
    console.error('Batch address fetch error:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch batch addresses',
      },
      500
    );
  }
});

// ============================================
// 5. 매물 상세 조회 API
// ============================================

/**
 * GET /api/articles/:articleNo
 * 매물 상세 조회 (DB에서)
 */
app.get('/api/articles/:articleNo', async (c) => {
  try {
    const articleNo = c.req.param('articleNo');

    const property = await prisma.property.findUnique({
      where: { articleNo },
    });

    if (!property) {
      return c.json({ error: 'Article not found' }, 404);
    }

    // tagList JSON 파싱
    const tagList = property.tagList ? JSON.parse(property.tagList) : [];

    return c.json({
      ...property,
      tagList,
    });
  } catch (error) {
    console.error('Article detail fetch error:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch article detail',
      },
      500
    );
  }
});

/**
 * GET /api/articles/:articleNo/refresh
 * 매물 정보 갱신 (네이버 API에서 다시 가져와서 DB 업데이트)
 */
app.get('/api/articles/:articleNo/refresh', async (c) => {
  try {
    const articleNo = c.req.param('articleNo');

    // DB에서 기존 매물 정보 확인 (cortarNo 가져오기)
    const existingProperty = await prisma.property.findUnique({
      where: { articleNo },
    });

    if (!existingProperty) {
      return c.json({ error: 'Article not found in DB' }, 404);
    }

    // 네이버 API에서 다시 가져오기
    const { default: naverLandClient } = await import('../lib/scraper/naver-client');
    const response = await naverLandClient.getArticles({
      cortarNo: existingProperty.cortarNo,
      realEstateType: existingProperty.realEstateTypeCode,
      tradeType: existingProperty.tradeTypeCode,
    });

    // 해당 매물 찾기
    const updatedArticle = response.articleList?.find(a => a.articleNo === articleNo);

    if (!updatedArticle) {
      return c.json({ error: 'Article not found in Naver API' }, 404);
    }

    // DB 업데이트
    const updatedProperty = await prisma.property.update({
      where: { articleNo },
      data: {
        articleName: updatedArticle.articleName,
        articleStatus: updatedArticle.articleStatus,
        dealOrWarrantPrc: typeof updatedArticle.dealOrWarrantPrc === 'string' ? parseInt(updatedArticle.dealOrWarrantPrc.replace(/,/g, '')) || null : updatedArticle.dealOrWarrantPrc || null,
        rentPrc: updatedArticle.rentPrc ? (typeof updatedArticle.rentPrc === 'string' ? parseInt(updatedArticle.rentPrc) : updatedArticle.rentPrc) : null,
        floorInfo: updatedArticle.floorInfo,
        direction: updatedArticle.direction || null,
        articleConfirmYmd: updatedArticle.articleConfirmYmd,
        articleFeatureDesc: updatedArticle.articleFeatureDesc,
        tagList: JSON.stringify(updatedArticle.tagList || []),
      },
    });

    const tagList = updatedProperty.tagList ? JSON.parse(updatedProperty.tagList) : [];

    return c.json({
      ...updatedProperty,
      tagList,
    });
  } catch (error) {
    console.error('Article refresh error:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to refresh article',
      },
      500
    );
  }
});

// ============================================
// 6. 통계 API
// ============================================

/**
 * GET /api/statistics/overview
 * 전체 통계 개요 (대시보드용)
 */
app.get('/api/statistics/overview', async (c) => {
  try {
    const [totalProperties, totalComplexes, avgPriceData] = await Promise.all([
      prisma.property.count(),
      prisma.complex.count(),
      prisma.property.aggregate({
        where: { dealOrWarrantPrc: { not: null } },
        _avg: { dealOrWarrantPrc: true },
      }),
    ]);

    return c.json({
      totalProperties,
      totalComplexes,
      avgPrice: avgPriceData._avg.dealOrWarrantPrc || 0,
      priceChange: 2.5, // TODO: 이전 데이터와 비교해서 계산
    });
  } catch (error) {
    console.error('Overview statistics error:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch overview statistics',
      },
      500
    );
  }
});

/**
 * GET /api/statistics/regions
 * 지역별 매물 통계
 * @query limit - 반환할 지역 수 (선택)
 */
app.get('/api/statistics/regions', async (c) => {
  try {
    const limitParam = c.req.query('limit');
    const cortarNo = c.req.query('cortarNo');
    const realEstateType = c.req.query('realEstateType');
    const tradeType = c.req.query('tradeType');

    const whereClause: any = {};

    if (cortarNo) {
      // 해당 지역과 하위 지역 모두 포함
      const childRegions = await prisma.region.findMany({
        where: {
          OR: [
            { cortarNo },
            { parentCortarNo: cortarNo },
          ],
        },
        select: { cortarNo: true },
      });

      const cortarNos = childRegions.map(r => r.cortarNo);
      whereClause.cortarNo = { in: cortarNos };
    }

    if (realEstateType) {
      whereClause.realEstateTypeCode = realEstateType;
    }

    if (tradeType) {
      whereClause.tradeTypeCode = tradeType;
    }

    // 지역별 통계 집계
    const limitClause = limitParam ? `LIMIT ${parseInt(limitParam)}` : '';
    const regionStats = await prisma.$queryRaw<Array<{
      cortarNo: string;
      cortarName: string;
      count: bigint;
      avgPrice: number | null;
      minPrice: number | null;
      maxPrice: number | null;
    }>>`
      SELECT
        r."cortarNo",
        r."cortarName",
        COUNT(p."articleNo") as count,
        COALESCE(AVG(p."dealOrWarrantPrc"), 0) as "avgPrice",
        COALESCE(MIN(p."dealOrWarrantPrc"), 0) as "minPrice",
        COALESCE(MAX(p."dealOrWarrantPrc"), 0) as "maxPrice"
      FROM regions r
      LEFT JOIN properties p ON r."cortarNo" = p."cortarNo"
      GROUP BY r."cortarNo", r."cortarName"
      HAVING COUNT(p."articleNo") > 0
      ORDER BY count DESC
      ${limitClause}
    `;

    return c.json({
      statistics: regionStats.map((stat) => ({
        cortarNo: stat.cortarNo,
        cortarName: stat.cortarName,
        count: Number(stat.count),
        avgPrice: Number(stat.avgPrice),
        minPrice: Number(stat.minPrice),
        maxPrice: Number(stat.maxPrice),
      })),
    });
  } catch (error) {
    console.error('Region statistics error:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch region statistics',
      },
      500
    );
  }
});

/**
 * GET /api/statistics/types
 * 매물타입별 통계
 */
app.get('/api/statistics/types', async (c) => {
  try {
    const typeStats = await prisma.property.groupBy({
      by: ['realEstateTypeCode'],
      _count: true,
      _avg: { dealOrWarrantPrc: true },
    });

    const statistics = typeStats.map(stat => ({
      realEstateType: stat.realEstateTypeCode,
      count: stat._count,
      avgPrice: stat._avg.dealOrWarrantPrc || 0,
    }));

    return c.json({ statistics });
  } catch (error) {
    console.error('Type statistics error:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch type statistics',
      },
      500
    );
  }
});

/**
 * GET /api/statistics/complexes/:complexNo
 * 단지별 매물 통계
 */
app.get('/api/statistics/complexes/:complexNo', async (c) => {
  try {
    const complexNo = c.req.param('complexNo');

    // 단지 정보
    const complex = await prisma.complex.findUnique({
      where: { complexNo },
    });

    if (!complex) {
      return c.json({ error: 'Complex not found' }, 404);
    }

    // 단지 매물 통계
    const properties = await prisma.property.findMany({
      where: { complexNo },
    });

    const totalCount = properties.length;
    const byTradeType = properties.reduce((acc, p) => {
      acc[p.tradeTypeName] = (acc[p.tradeTypeName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const avgPrice = properties
      .filter(p => p.dealOrWarrantPrc)
      .reduce((sum, p) => sum + (p.dealOrWarrantPrc || 0), 0) / (properties.filter(p => p.dealOrWarrantPrc).length || 1);

    return c.json({
      complex: {
        complexNo: complex.complexNo,
        complexName: complex.complexName,
        realEstateTypeName: complex.realEstateTypeName,
        totalHouseholdCount: complex.totalHouseholdCount,
      },
      statistics: {
        totalArticles: totalCount,
        averagePrice: Math.round(avgPrice),
        byTradeType,
        dealCount: complex.dealCount,
        leaseCount: complex.leaseCount,
        rentCount: complex.rentCount,
      },
    });
  } catch (error) {
    console.error('Complex statistics error:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch complex statistics',
      },
      500
    );
  }
});

/**
 * GET /api/statistics/price-trend
 * 가격 추이 데이터 (월별 평균가)
 * @query cortarNo - 지역 코드
 * @query complexNo - 단지 코드
 * @query period - 기간 (3month, 6month, 1year, all)
 */
app.get('/api/statistics/price-trend', async (c) => {
  try {
    const cortarNo = c.req.query('cortarNo');
    const complexNo = c.req.query('complexNo');
    const period = c.req.query('period') || '6month';

    const whereClause: any = {
      dealOrWarrantPrc: { not: null },
    };

    if (cortarNo) {
      whereClause.cortarNo = cortarNo;
    }

    if (complexNo) {
      whereClause.complexNo = complexNo;
    }

    // 기간 계산
    const now = new Date();
    const monthsBack = period === '3month' ? 3 : period === '6month' ? 6 : period === '1year' ? 12 : 24;

    // 매월 데이터 집계
    const monthlyData: Array<{ month: string; avgPrice: number; count: number }> = [];

    for (let i = 0; i <= monthsBack; i++) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yearMonth = monthDate.toISOString().slice(0, 7); // YYYY-MM

      const startOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const endOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59);

      const properties = await prisma.property.findMany({
        where: {
          ...whereClause,
          articleConfirmYmd: {
            gte: startOfMonth.toISOString().slice(0, 10).replace(/-/g, ''),
            lte: endOfMonth.toISOString().slice(0, 10).replace(/-/g, ''),
          },
        },
      });

      if (properties.length > 0) {
        const avgPrice = properties
          .filter(p => p.dealOrWarrantPrc)
          .reduce((sum, p) => sum + (p.dealOrWarrantPrc || 0), 0) /
          properties.filter(p => p.dealOrWarrantPrc).length;

        monthlyData.push({
          month: yearMonth,
          avgPrice: Math.round(avgPrice),
          count: properties.length,
        });
      }
    }

    // 시간순 정렬
    monthlyData.reverse();

    return c.json({
      trend: monthlyData.map(d => ({
        date: d.month,
        price: d.avgPrice,
        count: d.count,
      })),
    });
  } catch (error) {
    console.error('Price trend error:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch price trend',
      },
      500
    );
  }
});

/**
 * GET /api/statistics/address-suggestions
 * 주소/단지명 기반 좌표 후보 조회 (자동완성)
 * @query q - 검색어 (2글자 이상)
 * @query limit - 최대 개수 (기본 12, 최대 30)
 */
app.get('/api/statistics/address-suggestions', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }

    const q = (c.req.query('q') || '').trim();
    if (q.length < 2) {
      return c.json({ suggestions: [] });
    }

    const limitRaw = parseInt(c.req.query('limit') || '12');
    const limit = Number.isNaN(limitRaw) ? 12 : Math.min(30, Math.max(1, limitRaw));

    const [propertyMatches, complexMatches] = await Promise.all([
      prisma.property.findMany({
        where: {
          userId,
          latitude: { not: null },
          longitude: { not: null },
          OR: [
            { buildingName: { contains: q, mode: 'insensitive' } },
            { cortarAddress: { contains: q, mode: 'insensitive' } },
            { roadAddress: { contains: q, mode: 'insensitive' } },
            { detailAddress: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          buildingName: true,
          cortarAddress: true,
          roadAddress: true,
          detailAddress: true,
          latitude: true,
          longitude: true,
        },
        take: 80,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.complex.findMany({
        where: {
          OR: [
            { complexName: { contains: q, mode: 'insensitive' } },
            { cortarAddress: { contains: q, mode: 'insensitive' } },
            { roadAddress: { contains: q, mode: 'insensitive' } },
            { detailAddress: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          complexName: true,
          cortarAddress: true,
          roadAddress: true,
          detailAddress: true,
          latitude: true,
          longitude: true,
        },
        take: 80,
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    type Suggestion = {
      label: string;
      latitude: number;
      longitude: number;
      source: 'property' | 'complex';
    };

    const combined: Suggestion[] = [];

    for (const p of propertyMatches) {
      const lat = p.latitude ?? null;
      const lng = p.longitude ?? null;
      if (lat === null || lng === null) continue;

      const addressParts = [p.cortarAddress, p.roadAddress, p.detailAddress]
        .filter(Boolean)
        .join(' ');
      const label = [p.buildingName, addressParts].filter(Boolean).join(' | ').trim();
      if (!label) continue;

      combined.push({
        label,
        latitude: lat,
        longitude: lng,
        source: 'property',
      });
    }

    for (const cpx of complexMatches) {
      const addressParts = [cpx.cortarAddress, cpx.roadAddress, cpx.detailAddress]
        .filter(Boolean)
        .join(' ');
      const label = [cpx.complexName, addressParts].filter(Boolean).join(' | ').trim();
      if (!label) continue;

      combined.push({
        label,
        latitude: cpx.latitude,
        longitude: cpx.longitude,
        source: 'complex',
      });
    }

    const dedupMap = new Map<string, Suggestion>();
    for (const item of combined) {
      const key = `${item.label}__${item.latitude.toFixed(6)}__${item.longitude.toFixed(6)}`;
      if (!dedupMap.has(key)) {
        dedupMap.set(key, item);
      }
    }

    const suggestions = Array.from(dedupMap.values()).slice(0, limit);
    return c.json({ suggestions });
  } catch (error) {
    console.error('Address suggestions error:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch address suggestions',
      },
      500
    );
  }
});

/**
 * GET /api/statistics/office-center
 * 로그인 사용자(부동산 사무실) 기준 지도 초기 중심점 조회
 */
app.get('/api/statistics/office-center', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        companyName: true,
        address: true,
        detailAddress: true,
      },
    });

    if (!user) {
      return c.json({ error: '사용자 정보를 찾을 수 없습니다.' }, 404);
    }

    const baseAddress = (user.address || '').trim();
    const detailAddress = (user.detailAddress || '').trim();
    const officeAddress = [baseAddress, detailAddress].filter(Boolean).join(' ').trim();
    let centerLat: number | null = null;
    let centerLng: number | null = null;
    let source: 'office-address-vworld' | 'office-address-db' | 'office-address-geocode-failed' = 'office-address-geocode-failed';
    let matchedCount = 0;
    let geocodeMessage: string | null = null;
    let geocodeQueryUsed: string | null = null;
    const vworldApiKey = (
      process.env.VWORLD_API_KEY ||
      process.env.VWORLD_SERVICE_KEY ||
      process.env.VITE_VWORLD_API_KEY ||
      ''
    ).trim();

    const sanitizeAddress = (value: string) =>
      value
        .replace(/\([^)]*\)/g, ' ')
        .replace(/\b\d{1,3}(층|호|동)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const buildAddressCandidates = (base: string, full: string) => {
      const candidates = new Set<string>();
      const pushIfValid = (v: string) => {
        const trimmed = v.trim();
        if (trimmed.length >= 5) candidates.add(trimmed);
      };

      pushIfValid(base);
      pushIfValid(full);
      pushIfValid(sanitizeAddress(base));
      pushIfValid(sanitizeAddress(full));

      const baseTokens = sanitizeAddress(base).split(' ').filter((token) => token.length > 1);
      if (baseTokens.length >= 3) {
        pushIfValid(baseTokens.slice(0, 3).join(' '));
        pushIfValid(baseTokens.slice(0, 4).join(' '));
      }

      return Array.from(candidates);
    };

    const resolvePointFromDb = async (query: string) => {
      const [propertyMatches, complexMatches] = await Promise.all([
        prisma.property.findMany({
          where: {
            userId,
            latitude: { not: null },
            longitude: { not: null },
            OR: [
              { buildingName: { contains: query, mode: 'insensitive' } },
              { cortarAddress: { contains: query, mode: 'insensitive' } },
              { roadAddress: { contains: query, mode: 'insensitive' } },
              { detailAddress: { contains: query, mode: 'insensitive' } },
            ],
          },
          select: {
            latitude: true,
            longitude: true,
          },
          take: 40,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.complex.findMany({
          where: {
            OR: [
              { complexName: { contains: query, mode: 'insensitive' } },
              { cortarAddress: { contains: query, mode: 'insensitive' } },
              { roadAddress: { contains: query, mode: 'insensitive' } },
              { detailAddress: { contains: query, mode: 'insensitive' } },
            ],
          },
          select: {
            latitude: true,
            longitude: true,
          },
          take: 40,
          orderBy: { updatedAt: 'desc' },
        }),
      ]);

      const points = [
        ...propertyMatches.map((row) => ({ latitude: row.latitude!, longitude: row.longitude! })),
        ...complexMatches.map((row) => ({ latitude: row.latitude, longitude: row.longitude })),
      ].filter((row) =>
        Number.isFinite(row.latitude) && Number.isFinite(row.longitude)
      );

      if (points.length === 0) return null;

      return {
        latitude: points.reduce((sum, row) => sum + row.latitude, 0) / points.length,
        longitude: points.reduce((sum, row) => sum + row.longitude, 0) / points.length,
        matchedCount: points.length,
      };
    };

    const geocodeByVworld = async (query: string) => {
      if (!vworldApiKey) return null;

      const requestTypes = ['ROAD', 'PARCEL'] as const;
      for (const type of requestTypes) {
        const params = new URLSearchParams({
          service: 'address',
          request: 'getCoord',
          version: '2.0',
          crs: 'EPSG:4326',
          format: 'json',
          errorformat: 'json',
          refine: 'true',
          simple: 'false',
          type,
          address: query,
          key: vworldApiKey,
        });

        const response = await fetch(`https://api.vworld.kr/req/address?${params.toString()}`);
        if (!response.ok) {
          const body = await response.text();
          console.warn('[OfficeCenter] VWorld geocode failed:', response.status, body.slice(0, 200));
          continue;
        }

        const payload = await response.json() as {
          response?: {
            status?: string;
            error?: { text?: string };
            result?: {
              point?: { x?: string | number; y?: string | number };
            };
          };
        };

        const point = payload.response?.result?.point;
        const latitude = Number(point?.y);
        const longitude = Number(point?.x);
        if (
          payload.response?.status === 'OK'
          && Number.isFinite(latitude)
          && Number.isFinite(longitude)
        ) {
          return { latitude, longitude };
        }
      }

      return null;
    };

    const candidates = buildAddressCandidates(baseAddress, officeAddress);
    for (const query of candidates) {
      const vworldPoint = await geocodeByVworld(query);
      if (vworldPoint) {
        centerLat = vworldPoint.latitude;
        centerLng = vworldPoint.longitude;
        matchedCount = 1;
        geocodeQueryUsed = query;
        source = 'office-address-vworld';
        break;
      }

      const dbPoint = await resolvePointFromDb(query);
      if (dbPoint) {
        centerLat = dbPoint.latitude;
        centerLng = dbPoint.longitude;
        matchedCount = dbPoint.matchedCount;
        geocodeQueryUsed = query;
        source = 'office-address-db';
        break;
      }
    }

    if (!baseAddress) {
      return c.json(
        {
          error: '사무실 기본 주소가 없습니다. 프로필에서 주소를 먼저 저장하세요.',
          source: 'office-address-geocode-failed',
        },
        422
      );
    }

    if (centerLat === null || centerLng === null) {
      geocodeMessage = vworldApiKey
        ? '사무실 주소 좌표 변환 실패(VWorld/DB 매칭 없음)'
        : '사무실 주소 좌표 변환 실패(VWorld 키 없음, DB 매칭 없음)';

      return c.json(
        {
          error: geocodeMessage,
          source: 'office-address-geocode-failed',
          geocodeMessage,
          geocodeQueryUsed,
          office: {
            companyName: user.companyName || null,
            baseAddress: baseAddress || null,
            detailAddress: detailAddress || null,
            address: officeAddress || null,
          },
        },
        422
      );
    }

    return c.json({
      center: {
        latitude: centerLat,
        longitude: centerLng,
      },
      source,
      matchedCount,
      geocodeMessage,
      geocodeQueryUsed,
      office: {
        companyName: user.companyName || null,
        baseAddress: baseAddress || null,
        detailAddress: detailAddress || null,
        address: officeAddress || null,
      },
    });
  } catch (error) {
    console.error('Office center error:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch office center',
      },
      500
    );
  }
});

/**
 * GET /api/statistics/address-market
 * 주소/좌표 기준 반경 내 시세 및 거래 통계
 * @query address - 주소/단지 텍스트(선택, 좌표 미입력 시 중심점 추정용)
 * @query lat - 중심 위도
 * @query lng - 중심 경도
 * @query radiusMeters - 반경(미터, 기본 1000)
 * @query realEstateType - 매물 유형 코드(선택)
 * @query tradeType - 거래 유형 코드(선택)
 */
app.get('/api/statistics/address-market', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }

    const address = (c.req.query('address') || '').trim();
    const latRaw = parseFloat(c.req.query('lat') || '');
    const lngRaw = parseFloat(c.req.query('lng') || '');
    const realEstateType = (c.req.query('realEstateType') || '').trim();
    const tradeType = (c.req.query('tradeType') || '').trim();
    const selectedTradeTypes = Array.from(
      new Set(
        tradeType
          .split(':')
          .map((token) => token.trim())
          .filter(Boolean)
          .flatMap((token) => (token === 'LEASE_ALL' ? ['B1', 'B2'] : [token]))
          .filter((token): token is 'A1' | 'B1' | 'B2' | 'B3' =>
            token === 'A1' || token === 'B1' || token === 'B2' || token === 'B3'
          )
      )
    );
    const sourceRaw = (c.req.query('source') || 'molit').trim().toLowerCase();
    const source: 'auto' | 'molit' | 'reb' =
      sourceRaw === 'molit' || sourceRaw === 'reb'
        ? sourceRaw
        : 'auto';
    const monthsBackRaw = parseInt(c.req.query('monthsBack') || '2', 10);
    const molitMonthsBack = Number.isFinite(monthsBackRaw) ? Math.min(11, Math.max(0, monthsBackRaw)) : 2;
    const molitPageRowsRaw = parseInt(c.req.query('molitRows') || '1000', 10);
    const molitRows = Number.isFinite(molitPageRowsRaw) ? Math.min(1000, Math.max(100, molitPageRowsRaw)) : 1000;
    const molitPagesRaw = parseInt(c.req.query('molitPages') || '2', 10);
    const molitPages = Number.isFinite(molitPagesRaw) ? Math.min(5, Math.max(1, molitPagesRaw)) : 2;

    const radiusRaw = parseInt(c.req.query('radiusMeters') || '1000');
    const radiusMeters = Number.isNaN(radiusRaw) ? 1000 : Math.min(10000, Math.max(200, radiusRaw));
    const vworldApiKey = (
      process.env.VWORLD_API_KEY ||
      process.env.VWORLD_SERVICE_KEY ||
      process.env.VITE_VWORLD_API_KEY ||
      ''
    ).trim();

    const toMedian = (values: number[]) => {
      if (values.length === 0) return 0;
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      if (sorted.length % 2 === 0) {
        return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
      }
      return sorted[mid];
    };

    type SegmentMetricRow = {
      tradeTypeName: string;
      realEstateTypeName: string;
      price: number | null;
      rentPrc: number | null;
      area: number | null;
      month: string | null;
      distanceM?: number | null;
      articleConfirmYmd?: string | null;
    };

    const buildSegmentStats = (rows: SegmentMetricRow[], totalCount: number) => {
      const segmentMap = new Map<
        string,
        {
          realEstateTypeName: string;
          tradeTypeName: string;
          count: number;
          prices: number[];
          unitPrices: number[];
          rents: number[];
          recentMonth: string | null;
          recentYmd: string | null;
        }
      >();

      for (const row of rows) {
        const key = `${row.realEstateTypeName}__${row.tradeTypeName}`;
        const current = segmentMap.get(key) || {
          realEstateTypeName: row.realEstateTypeName,
          tradeTypeName: row.tradeTypeName,
          count: 0,
          prices: [],
          unitPrices: [],
          rents: [],
          recentMonth: null,
          recentYmd: null,
        };

        current.count += 1;

        if (typeof row.price === 'number' && row.price > 0) {
          current.prices.push(row.price);
          if (typeof row.area === 'number' && row.area > 0) {
            current.unitPrices.push(row.price / row.area);
          }
        }

        if (typeof row.rentPrc === 'number' && row.rentPrc > 0) {
          current.rents.push(row.rentPrc);
        }

        const recentKey = row.articleConfirmYmd || row.month || null;
        if (recentKey && (!current.recentYmd || recentKey > current.recentYmd)) {
          current.recentYmd = recentKey;
          current.recentMonth = row.month || (row.articleConfirmYmd ? `${row.articleConfirmYmd.slice(0, 4)}-${row.articleConfirmYmd.slice(4, 6)}` : null);
        }

        segmentMap.set(key, current);
      }

      return Array.from(segmentMap.values())
        .map((item) => {
          const sortedPrices = [...item.prices].sort((a, b) => a - b);
          const avgPrice = item.prices.length > 0
            ? Math.round(item.prices.reduce((sum, value) => sum + value, 0) / item.prices.length)
            : 0;
          const avgPricePerArea = item.unitPrices.length > 0
            ? Math.round(item.unitPrices.reduce((sum, value) => sum + value, 0) / item.unitPrices.length)
            : 0;
          const avgRentPrc = item.rents.length > 0
            ? Math.round(item.rents.reduce((sum, value) => sum + value, 0) / item.rents.length)
            : 0;

          return {
            realEstateTypeName: item.realEstateTypeName,
            tradeTypeName: item.tradeTypeName,
            count: item.count,
            ratio: totalCount > 0 ? Number(((item.count / totalCount) * 100).toFixed(1)) : 0,
            avgPrice,
            medianPrice: toMedian(sortedPrices),
            minPrice: sortedPrices.length > 0 ? sortedPrices[0] : 0,
            maxPrice: sortedPrices.length > 0 ? sortedPrices[sortedPrices.length - 1] : 0,
            avgPricePerArea,
            avgRentPrc,
            recentMonth: item.recentMonth,
          };
        })
        .sort((a, b) => {
          if (b.count !== a.count) return b.count - a.count;
          if (b.avgPrice !== a.avgPrice) return b.avgPrice - a.avgPrice;
          return a.realEstateTypeName.localeCompare(b.realEstateTypeName);
        });
    };

    const buildMonthlyTrend = (rows: Array<{ month: string | null; price: number | null }>) => {
      const monthlyMap = new Map<string, { sum: number; count: number; transCount: number }>();
      for (const row of rows) {
        if (!row.month || typeof row.price !== 'number' || row.price <= 0) continue;
        const prev = monthlyMap.get(row.month) || { sum: 0, count: 0, transCount: 0 };
        prev.sum += row.price;
        prev.count += 1;
        prev.transCount += 1;
        monthlyMap.set(row.month, prev);
      }

      return Array.from(monthlyMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-18)
        .map(([month, val]) => ({
          month,
          avgPrice: val.count > 0 ? Math.round(val.sum / val.count) : 0,
          transactionCount: val.transCount,
        }));
    };

    const buildSegmentMonthlyTrends = (rows: SegmentMetricRow[]) => {
      const segmentMap = new Map<string, SegmentMetricRow[]>();
      for (const row of rows) {
        const key = `${row.realEstateTypeName}__${row.tradeTypeName}`;
        const current = segmentMap.get(key) || [];
        current.push(row);
        segmentMap.set(key, current);
      }

      return Array.from(segmentMap.entries())
        .flatMap(([key, items]) => {
          const [realEstateTypeName, tradeTypeName] = key.split('__');
          return buildMonthlyTrend(items.map((item) => ({ month: item.month, price: item.price }))).map((trend) => ({
            realEstateTypeName,
            tradeTypeName,
            ...trend,
          }));
        });
    };

    const buildDistanceStats = (rows: Array<{ distanceM?: number | null; price: number | null }>, fallbackBand: string) => {
      const validRows = rows.filter((row): row is { distanceM: number; price: number } =>
        typeof row.distanceM === 'number' && row.distanceM >= 0 && typeof row.price === 'number' && row.price > 0
      );

      if (validRows.length === 0) {
        return [];
      }

      const bands = [
        { label: '0~500m', min: 0, max: 500 },
        { label: '500m~1km', min: 500, max: 1000 },
        { label: '1km~2km', min: 1000, max: 2000 },
        { label: '2km+', min: 2000, max: Number.POSITIVE_INFINITY },
      ];

      const bandStats = bands
        .map((band) => {
          const prices = validRows
            .filter((row) => row.distanceM >= band.min && row.distanceM < band.max)
            .map((row) => row.price);
          if (prices.length === 0) return null;
          return {
            band: band.label,
            count: prices.length,
            avgPrice: Math.round(prices.reduce((sum, value) => sum + value, 0) / prices.length),
            medianPrice: toMedian(prices),
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      if (bandStats.length > 0) return bandStats;

      const prices = validRows.map((row) => row.price);
      return [{
        band: fallbackBand,
        count: prices.length,
        avgPrice: Math.round(prices.reduce((sum, value) => sum + value, 0) / prices.length),
        medianPrice: toMedian(prices),
      }];
    };

    const buildSegmentDistanceStats = (rows: SegmentMetricRow[]) => {
      const segmentMap = new Map<string, SegmentMetricRow[]>();
      for (const row of rows) {
        const key = `${row.realEstateTypeName}__${row.tradeTypeName}`;
        const current = segmentMap.get(key) || [];
        current.push(row);
        segmentMap.set(key, current);
      }

      return Array.from(segmentMap.entries())
        .flatMap(([key, items]) => {
          const [realEstateTypeName, tradeTypeName] = key.split('__');
          return buildDistanceStats(items, `${realEstateTypeName} ${tradeTypeName}`).map((stat) => ({
            realEstateTypeName,
            tradeTypeName,
            ...stat,
          }));
        });
    };

    const sanitizeAddressQuery = (value: string) =>
      value
        .replace(/\([^)]*\)/g, ' ')
        .replace(/\b\d{1,3}(층|호|동)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const buildAddressCandidates = (base: string) => {
      const candidates = new Set<string>();
      const pushIfValid = (value: string) => {
        const trimmed = value.trim();
        if (trimmed.length >= 5) candidates.add(trimmed);
      };

      pushIfValid(base);
      pushIfValid(sanitizeAddressQuery(base));

      const tokens = sanitizeAddressQuery(base).split(' ').filter((token) => token.length > 1);
      if (tokens.length >= 3) {
        pushIfValid(tokens.slice(0, 3).join(' '));
        pushIfValid(tokens.slice(0, 4).join(' '));
      }

      return Array.from(candidates);
    };

    const resolvePointFromDb = async (query: string) => {
      const [propertyMatches, complexMatches] = await Promise.all([
        prisma.property.findMany({
          where: {
            userId,
            latitude: { not: null },
            longitude: { not: null },
            OR: [
              { buildingName: { contains: query, mode: 'insensitive' } },
              { cortarAddress: { contains: query, mode: 'insensitive' } },
              { roadAddress: { contains: query, mode: 'insensitive' } },
              { detailAddress: { contains: query, mode: 'insensitive' } },
            ],
          },
          select: {
            latitude: true,
            longitude: true,
          },
          take: 60,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.complex.findMany({
          where: {
            OR: [
              { complexName: { contains: query, mode: 'insensitive' } },
              { cortarAddress: { contains: query, mode: 'insensitive' } },
              { roadAddress: { contains: query, mode: 'insensitive' } },
              { detailAddress: { contains: query, mode: 'insensitive' } },
            ],
          },
          select: {
            latitude: true,
            longitude: true,
          },
          take: 60,
          orderBy: { updatedAt: 'desc' },
        }),
      ]);

      const points = [
        ...propertyMatches.map((row) => ({ latitude: row.latitude!, longitude: row.longitude! })),
        ...complexMatches.map((row) => ({ latitude: row.latitude, longitude: row.longitude })),
      ].filter((row) =>
        Number.isFinite(row.latitude) && Number.isFinite(row.longitude)
      );

      if (points.length === 0) return null;

      return {
        latitude: points.reduce((sum, row) => sum + row.latitude, 0) / points.length,
        longitude: points.reduce((sum, row) => sum + row.longitude, 0) / points.length,
      };
    };

    const geocodeByVworld = async (query: string, logPrefix: string) => {
      if (!vworldApiKey) return null;

      const requestTypes = ['ROAD', 'PARCEL'] as const;
      for (const type of requestTypes) {
        const params = new URLSearchParams({
          service: 'address',
          request: 'getCoord',
          version: '2.0',
          crs: 'EPSG:4326',
          format: 'json',
          errorformat: 'json',
          refine: 'true',
          simple: 'false',
          type,
          address: query,
          key: vworldApiKey,
        });

        const response = await fetch(`https://api.vworld.kr/req/address?${params.toString()}`);
        if (!response.ok) {
          const body = await response.text();
          console.warn(`${logPrefix} VWorld geocode failed:`, response.status, body.slice(0, 200));
          continue;
        }

        const payload = await response.json() as {
          response?: {
            status?: string;
            error?: { text?: string };
            result?: {
              point?: { x?: string | number; y?: string | number };
            };
          };
        };

        const point = payload.response?.result?.point;
        const latitude = Number(point?.y);
        const longitude = Number(point?.x);
        if (
          payload.response?.status === 'OK'
          && Number.isFinite(latitude)
          && Number.isFinite(longitude)
        ) {
          return { latitude, longitude };
        }
      }

      return null;
    };

    let centerLat = Number.isFinite(latRaw) ? latRaw : null;
    let centerLng = Number.isFinite(lngRaw) ? lngRaw : null;
    let centerSource: 'query' | 'address' = 'query';

    if (centerLat === null || centerLng === null) {
      if (!address) {
        return c.json({ error: 'lat/lng 또는 address 중 하나는 필요합니다.' }, 400);
      }

      const candidates = buildAddressCandidates(address);
      for (const query of candidates) {
        const point = await geocodeByVworld(query, '[AddressMarket]') || await resolvePointFromDb(query);
        if (!point) continue;

        centerLat = point.latitude;
        centerLng = point.longitude;
        centerSource = 'address';
        break;
      }

      if (centerLat === null || centerLng === null) {
        return c.json({ error: '입력한 주소로 중심 좌표를 찾지 못했습니다.' }, 404);
      }
    }

    const normalizeText = (value: string) => value.replace(/\s+/g, '').toLowerCase();

    const TRADE_TYPE_HINTS: Record<string, string[]> = {
      A1: ['매매', '매매거래', 'sale'],
      B1: ['전세', '임대차', 'lease', '전월세'],
      B2: ['월세', '월임대', 'rent', '전월세'],
      B3: ['단기임대', '단기', 'short'],
    };
    const PROPERTY_TYPE_HINTS: Record<string, string[]> = {
      APT: ['아파트', '공동주택', 'apt'],
      OPST: ['오피스텔', 'officetel'],
      SG: ['상가', '근린', '점포', '상업시설', '상가점포', '상업업무용'],
      TJ: ['토지', '대지', '임야', '전', '답', 'land'],
      MIXED_USE: ['주상복합', '복합건물', '복합시설'],
      DDDGG: ['단독', '다가구', '단독다가구', '단독/다가구'],
      ONEROOM: ['원룸'],
      DSD: ['다세대', '연립', '빌라'],
      COMMERCIAL_LAND: ['상업용부지', '상업용지', '업무용지', '상업용 토지'],
      GJCG: ['공장', '창고', '지식산업'],
      HOTEL_MOTEL: ['호텔', '모텔', '숙박'],
      OTHER: ['기타', 'misc'],
      VL: ['빌라', '연립', '다세대'],
      TWOROOM: ['투룸'],
    };
    const PRIMARY_PROPERTY_FILTER_CODES = [
      'APT',
      'OPST',
      'SG',
      'TJ',
      'MIXED_USE',
      'DDDGG',
      'ONEROOM',
      'DSD',
      'COMMERCIAL_LAND',
      'GJCG',
      'HOTEL_MOTEL',
    ];

    const matchesAnyHint = (haystacks: string[], hints: string[]) => {
      if (hints.length === 0) return false;
      const normalizedHaystacks = haystacks
        .map((value) => normalizeText(value))
        .filter((value) => value.length > 0);

      return hints.some((hint) => {
        const token = normalizeText(hint);
        return normalizedHaystacks.some((value) => value.includes(token));
      });
    };

    const matchesSelectedTradeType = (haystacks: string[], tradeTypeCode?: string | null) => {
      if (selectedTradeTypes.length === 0) return true;
      if (tradeTypeCode && selectedTradeTypes.includes(tradeTypeCode as 'A1' | 'B1' | 'B2' | 'B3')) {
        return true;
      }

      return selectedTradeTypes.some((code) => matchesAnyHint(haystacks, TRADE_TYPE_HINTS[code] || []));
    };

    const matchesSelectedPropertyType = (haystacks: string[], propertyTypeCode?: string | null) => {
      if (!realEstateType) return true;
      if (propertyTypeCode && propertyTypeCode === realEstateType) return true;

      if (realEstateType === 'OTHER') {
        return !PRIMARY_PROPERTY_FILTER_CODES.some((code) =>
          matchesAnyHint(haystacks, PROPERTY_TYPE_HINTS[code] || [])
        );
      }

      return matchesAnyHint(haystacks, PROPERTY_TYPE_HINTS[realEstateType] || []);
    };

    const toNumberOrNull = (value: unknown) => {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value !== 'string') return null;
      const trimmed = value.trim();
      if (!trimmed) return null;
      const normalized = trimmed
        .replace(/,/g, '')
        .replace(/\s+/g, '')
        .replace(/원|만원|건|%/g, '');
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const parseMonthKey = (value: unknown): string | null => {
      if (typeof value !== 'string' && typeof value !== 'number') return null;
      const raw = String(value).trim();
      if (!raw) return null;

      const compact = raw.replace(/[^0-9]/g, '');
      if (/^\d{8}$/.test(compact)) return `${compact.slice(0, 4)}-${compact.slice(4, 6)}`;
      if (/^\d{6}$/.test(compact)) return `${compact.slice(0, 4)}-${compact.slice(4, 6)}`;

      const isoLike = raw.match(/(\d{4})[-./년 ]\s*(\d{1,2})/);
      if (isoLike) {
        const year = isoLike[1];
        const month = isoLike[2].padStart(2, '0');
        return `${year}-${month}`;
      }
      return null;
    };

    const pickFirstString = (row: Record<string, unknown>, candidateKeys: string[]) => {
      for (const key of candidateKeys) {
        const value = row[key];
        if (typeof value === 'string' && value.trim()) return value.trim();
      }
      return null;
    };

    const extractStringBag = (row: Record<string, unknown>) =>
      Object.values(row)
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .join(' ');

    const pickMetricValue = (row: Record<string, unknown>) => {
      const prioritizedKeys = [
        'DTA_VAL',
        'VAL',
        'DTVAL_CO',
        'TRD_AMT',
        'DEAL_AMT',
        'PRICE',
        '거래금액',
        '실거래가',
      ];
      for (const key of prioritizedKeys) {
        const value = toNumberOrNull(row[key]);
        if (value !== null) return value;
      }

      for (const value of Object.values(row)) {
        const parsed = toNumberOrNull(value);
        if (parsed !== null) return parsed;
      }
      return null;
    };

    let regionContext: {
      sido: string | null;
      sigungu: string | null;
      dong: string | null;
      bCode: string | null;
      display: string | null;
    } | null = null;
    let nearbyRegionNames: string[] = [];
    let nearbyLawdCodes: string[] = [];

    // 중심점 반경에 걸쳐있는 인접 행정구역(법정동/시군구)을 확보해 외부 거래 필터에 사용
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const haversineMeters = (lat1: number, lng1: number, lat2: number, lng2: number) => {
      const R = 6371000;
      const dLat = toRad(lat2 - lat1);
      const dLng = toRad(lng2 - lng1);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const cVal = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * cVal;
    };

    const normalizeRealEstateTypeCode = (value: string) => {
      const normalized = normalizeText(value);
      if (!normalized) return null;
      if (normalized.includes('주상복합') || normalized.includes('복합건물')) return 'MIXED_USE';
      if (normalized.includes('아파트') || normalized.includes('apt')) return 'APT';
      if (normalized.includes('오피스텔') || normalized.includes('officetel')) return 'OPST';
      if (normalized.includes('호텔') || normalized.includes('모텔') || normalized.includes('숙박')) return 'HOTEL_MOTEL';
      if (normalized.includes('상업용부지') || normalized.includes('상업용지') || normalized.includes('업무용지')) return 'COMMERCIAL_LAND';
      if (normalized.includes('토지') || normalized.includes('land')) return 'TJ';
      if (normalized.includes('공장') || normalized.includes('창고') || normalized.includes('지식산업')) return 'GJCG';
      if (normalized.includes('단독') || normalized.includes('다가구')) return 'DDDGG';
      if (normalized.includes('다세대')) return 'DSD';
      if (normalized.includes('빌라') || normalized.includes('연립')) return 'VL';
      if (normalized.includes('원룸')) return 'ONEROOM';
      if (normalized.includes('투룸')) return 'TWOROOM';
      if (normalized.includes('상가') || normalized.includes('근린') || normalized.includes('점포') || normalized.includes('상업업무')) return 'SG';
      if (normalized.includes('기타')) return 'OTHER';
      return null;
    };

    const buildMapSampleQueries = (args: {
      articleName: string;
      addressText: string;
      realEstateTypeCode: string | null;
    }) => {
      const article = args.articleName.trim();
      const addressOnly = sanitizeAddressQuery(args.addressText);
      const addressCandidates = buildAddressCandidates(addressOnly);
      const queries = new Set<string>();
      const pushIfValid = (value: string) => {
        const trimmed = value.trim();
        if (trimmed.length >= 3) queries.add(trimmed);
      };

      if (
        args.realEstateTypeCode === 'APT'
        || args.realEstateTypeCode === 'OPST'
        || args.realEstateTypeCode === 'MIXED_USE'
      ) {
        addressCandidates.forEach((candidate) => {
          pushIfValid(`${article} ${candidate}`);
          pushIfValid(`${candidate} ${article}`);
        });
        pushIfValid(article);
      } else {
        addressCandidates.forEach((candidate) => {
          pushIfValid(`${candidate} ${article}`);
          pushIfValid(candidate);
        });
        pushIfValid(article);
      }

      return Array.from(queries);
    };

    const buildMapLocationKey = (args: {
      articleName: string;
      addressText: string;
      realEstateTypeCode: string | null;
    }) => {
      const addressKey = sanitizeAddressQuery(args.addressText);
      const articleKey = args.articleName.trim();
      const typeKey = args.realEstateTypeCode || 'unknown';

      if (addressKey.length >= 5) return `${typeKey}__${addressKey}`;
      if (articleKey.length >= 2) return `${typeKey}__${articleKey}`;
      return `${typeKey}__sample`;
    };

    type PublicMapSampleSeed = {
      idSeed: string;
      locationKey: string;
      geocodeQueries: string[];
      articleNo: string;
      articleName: string;
      buildingName: string | null;
      tradeTypeCode: string | null;
      tradeTypeName: string;
      realEstateTypeCode: string | null;
      realEstateTypeName: string;
      price: number | null;
      rentPrc: number | null;
      area: number | null;
      articleConfirmYmd: string | null;
      address: string;
    };

    const buildPublicMapSamples = async (rows: PublicMapSampleSeed[]) => {
      if (rows.length === 0) return [];

      const uniqueLocations = Array.from(
        new Map(rows.map((row) => [row.locationKey, row.geocodeQueries])).entries()
      ).slice(0, 80);

      const geocodedLocations = new Map<string, { latitude: number; longitude: number }>();

      for (const [locationKey, queries] of uniqueLocations) {
        for (const query of queries) {
          const point = await geocodeByVworld(query, '[AddressMarket][MapSamples]') || await resolvePointFromDb(query);
          if (!point) continue;

          geocodedLocations.set(locationKey, point);
          break;
        }
      }

      return rows.flatMap((row, idx) => {
        const point = geocodedLocations.get(row.locationKey);
        if (!point) return [];

        return [{
          id: `${row.idSeed}-${idx}`,
          articleNo: row.articleNo,
          articleName: row.articleName,
          buildingName: row.buildingName,
          tradeTypeCode: row.tradeTypeCode,
          tradeTypeName: row.tradeTypeName,
          realEstateTypeCode: row.realEstateTypeCode,
          realEstateTypeName: row.realEstateTypeName,
          price: row.price,
          rentPrc: row.rentPrc,
          area: row.area,
          latitude: point.latitude,
          longitude: point.longitude,
          distanceM: Math.round(haversineMeters(centerLat, centerLng, point.latitude, point.longitude)),
          articleConfirmYmd: row.articleConfirmYmd,
          address: row.address,
        }];
      });
    };

    try {
      const regionSearchMeters = Math.max(radiusMeters + 800, Math.round(radiusMeters * 1.5));
      const safeCos = Math.max(Math.cos((centerLat * Math.PI) / 180), 0.01);
      const latDelta = regionSearchMeters / 111320;
      const lngDelta = regionSearchMeters / (111320 * safeCos);

      const nearbyRegions = await prisma.region.findMany({
        where: {
          centerLat: {
            not: null,
            gte: centerLat - latDelta,
            lte: centerLat + latDelta,
          },
          centerLon: {
            not: null,
            gte: centerLng - lngDelta,
            lte: centerLng + lngDelta,
          },
          depth: {
            gte: 1,
            lte: 2,
          },
        },
        select: {
          cortarNo: true,
          cortarName: true,
          parentCortarNo: true,
          depth: true,
          centerLat: true,
          centerLon: true,
        },
        take: 300,
      });

      const intersectedRegions = nearbyRegions.filter((region) => {
        if (region.centerLat === null || region.centerLon === null) return false;
        return haversineMeters(centerLat, centerLng, region.centerLat, region.centerLon) <= regionSearchMeters;
      });
      nearbyLawdCodes = Array.from(
        new Set(
          intersectedRegions
            .map((region) => region.cortarNo?.slice(0, 5))
            .filter((code): code is string => !!code && /^\d{5}$/.test(code))
        )
      );

      const parentIds = Array.from(
        new Set(
          intersectedRegions
            .map((region) => region.parentCortarNo)
            .filter((value): value is string => !!value)
        )
      );

      const parentMap = new Map<string, string>();
      if (parentIds.length > 0) {
        const parents = await prisma.region.findMany({
          where: {
            cortarNo: {
              in: parentIds,
            },
          },
          select: {
            cortarNo: true,
            cortarName: true,
          },
        });
        for (const parent of parents) {
          parentMap.set(parent.cortarNo, parent.cortarName);
        }
      }

      const names = new Set<string>();
      for (const region of intersectedRegions) {
        if (region.cortarName) names.add(region.cortarName);
        const parentName = region.parentCortarNo ? parentMap.get(region.parentCortarNo) : null;
        if (parentName && region.cortarName && region.depth >= 2) {
          names.add(`${parentName} ${region.cortarName}`);
        }
      }
      nearbyRegionNames = Array.from(names);

      const regionCandidates = (intersectedRegions.length > 0 ? intersectedRegions : nearbyRegions)
        .filter((region) => region.centerLat !== null && region.centerLon !== null)
        .sort((a, b) => {
          const aDistance = haversineMeters(centerLat, centerLng, a.centerLat!, a.centerLon!);
          const bDistance = haversineMeters(centerLat, centerLng, b.centerLat!, b.centerLon!);
          return aDistance - bDistance;
        });

      const primaryRegion = regionCandidates[0] || null;
      if (primaryRegion) {
        const parentName = primaryRegion.parentCortarNo ? parentMap.get(primaryRegion.parentCortarNo) : null;
        const displayName = parentName && primaryRegion.depth >= 2
          ? `${parentName} ${primaryRegion.cortarName}`
          : primaryRegion.cortarName;

        regionContext = {
          sido: parentName || null,
          sigungu: primaryRegion.depth >= 2 ? parentName || null : primaryRegion.cortarName || null,
          dong: primaryRegion.depth >= 2 ? primaryRegion.cortarName || null : null,
          bCode: primaryRegion.cortarNo || null,
          display: displayName || null,
        };
      }
    } catch (nearbyRegionError) {
      console.warn('Address market nearby-region resolve failed:', nearbyRegionError);
    }

    const infrastructureMessage = '이 페이지에서는 외부 인프라 집계를 사용하지 않음';
    const summaryInfrastructure = undefined;

    const externalStatblId = (c.req.query('statblId') || process.env.REB_ADDRESS_MARKET_STATBL_ID || 'A_2024_00900').trim();
    const pageSizeRaw = parseInt(c.req.query('externalPageSize') || process.env.REB_ADDRESS_MARKET_PAGE_SIZE || '1000', 10);
    const maxPagesRaw = parseInt(c.req.query('externalPages') || process.env.REB_ADDRESS_MARKET_MAX_PAGES || '3', 10);
    const pageSize = Number.isFinite(pageSizeRaw) ? Math.min(1000, Math.max(100, pageSizeRaw)) : 1000;
    const maxPages = Number.isFinite(maxPagesRaw) ? Math.min(5, Math.max(1, maxPagesRaw)) : 3;
    let externalRows: Record<string, unknown>[] = [];
    let listTotalCount: number | null = null;
    let serviceName: string | null = null;
    let rebLoaded = false;

    const loadRebRows = async () => {
      if (rebLoaded) return;
      const pageResults = await Promise.all(
        Array.from({ length: maxPages }, (_, idx) =>
          fetchRebTableData({
            statblId: externalStatblId,
            page: idx + 1,
            size: pageSize,
            type: 'json',
          })
        )
      );

      externalRows = pageResults.flatMap((result) => result.rows as Record<string, unknown>[]);
      listTotalCount = pageResults[0]?.listTotalCount ?? null;
      serviceName = pageResults[0]?.serviceName ?? null;
      rebLoaded = true;
    };

    const molitConfig = getMolitApiConfigStatus();
    const rebConfig = getRebApiConfigStatus();

    const createEmptyResponse = (fetchedSize: number = 0) => ({
      center: {
        latitude: centerLat,
        longitude: centerLng,
        source: centerSource,
        address: address || null,
      },
      filters: {
        radiusMeters,
        realEstateType: realEstateType || null,
        tradeType: tradeType || null,
      },
      summary: {
        totalCount: 0,
        avgPrice: 0,
        medianPrice: 0,
        minPrice: 0,
        maxPrice: 0,
        avgPricePerArea: 0,
        infrastructure: summaryInfrastructure,
      },
      tradeDistribution: [],
      propertyTypeDistribution: [],
      segmentStats: [],
      segmentMonthlyTrend: [],
      segmentDistanceStats: [],
      distanceStats: [],
      monthlyTrend: [],
      recentTransactions: [],
      mapSamples: [],
      sourceMeta: {
        sourceType: 'PUBLIC_DATA_EMPTY',
        statblId: externalStatblId,
        serviceName,
        listTotalCount,
        fetchedRows: fetchedSize,
        scopedRows: 0,
        analyzedRows: 0,
        region: regionContext?.display || null,
        nearbyRegionCount: nearbyRegionNames.length,
        nearbyRegions: nearbyRegionNames,
        infrastructureMessage,
      },
    });

    if (source === 'molit' || source === 'auto') {
      if (molitConfig.configured) {
        const lawdCdFromRegion = regionContext?.bCode?.slice(0, 5) || null;
        const molitLawdCd = lawdCdFromRegion && /^\d{5}$/.test(lawdCdFromRegion)
          ? lawdCdFromRegion
          : nearbyLawdCodes[0] || null;

        if (molitLawdCd) {
          const buildDealMonths = () => {
            const now = new Date();
            const ym: string[] = [];
            for (let back = molitMonthsBack; back >= 0; back -= 1) {
              const date = new Date(now.getFullYear(), now.getMonth() - back, 1);
              const y = String(date.getFullYear());
              const m = String(date.getMonth() + 1).padStart(2, '0');
              ym.push(`${y}${m}`);
            }
            return ym;
          };

          // 기본(전체) 조회는 실사용 빈도가 높고 응답 안정성이 높은 유형 중심으로 우선 수집한다.
          // 기타 유형은 realEstateType 필터를 선택했을 때만 조회한다.
          const defaultSaleCategories: MolitCategory[] = [
            'apt-sale',
            'offi-sale',
          ];
          const defaultRentCategories: MolitCategory[] = [
            'apt-rent',
            'offi-rent',
          ];

          const saleByType: Record<string, MolitCategory[]> = {
            APT: ['apt-sale'],
            OPST: ['offi-sale'],
            SG: ['bldg-sale'],
            TJ: ['land-sale'],
            MIXED_USE: ['apt-sale', 'offi-sale', 'bldg-sale'],
            DDDGG: ['indvdland-sale'],
            DSD: ['indvdland-sale'],
            COMMERCIAL_LAND: ['land-sale'],
            GJCG: ['indvdland-sale'],
            HOTEL_MOTEL: ['bldg-sale'],
            OTHER: ['land-sale', 'indvdland-sale', 'bldg-sale'],
            VL: ['indvdland-sale'],
            ONEROOM: ['indvdland-sale'],
            TWOROOM: ['indvdland-sale'],
          };
          const rentByType: Record<string, MolitCategory[]> = {
            APT: ['apt-rent'],
            OPST: ['offi-rent'],
            SG: ['bldg-rent'],
            TJ: ['land-rent'],
            MIXED_USE: ['apt-rent', 'offi-rent', 'bldg-rent'],
            DDDGG: ['sh-rent'],
            DSD: ['sh-rent'],
            COMMERCIAL_LAND: ['land-rent'],
            GJCG: ['indvdland-rent'],
            HOTEL_MOTEL: ['bldg-rent'],
            OTHER: ['land-rent', 'indvdland-rent', 'bldg-rent', 'sh-rent'],
            VL: ['sh-rent'],
            ONEROOM: ['sh-rent'],
            TWOROOM: ['sh-rent'],
          };

          const saleCategories = saleByType[realEstateType] || defaultSaleCategories;
          const rentCategories = rentByType[realEstateType] || defaultRentCategories;
          let categories: MolitCategory[] = [];

          const wantsSale = selectedTradeTypes.length === 0 || selectedTradeTypes.includes('A1');
          const wantsRent =
            selectedTradeTypes.length === 0
            || selectedTradeTypes.includes('B1')
            || selectedTradeTypes.includes('B2')
            || selectedTradeTypes.includes('B3');

          if (wantsSale) {
            categories.push(...saleCategories);
          }
          if (wantsRent) {
            categories.push(...rentCategories);
          }
          categories = Array.from(new Set(categories));

          const dealMonths = buildDealMonths();
          const requests = dealMonths.flatMap((dealYm) =>
            categories.map((category) => ({ dealYm, category }))
          );

          const parseMolitErrorMeta = (error: unknown) => {
            const message = error instanceof Error ? error.message : String(error ?? '');
            const matched = message.match(/MOLIT API error \(([^)]+)\):\s*(.*)$/);
            const httpMatched = message.match(/MOLIT API HTTP\s+(\d{3})\s*:\s*(.*)$/i);
            return {
              resultCode: matched?.[1] || null,
              resultMessage: matched?.[2] || null,
              httpStatus: httpMatched?.[1] || null,
              httpMessage: httpMatched?.[2] || null,
            };
          };

          const results = await Promise.all(
            requests.map(async ({ dealYm, category }) => {
              try {
                const result = await fetchMolitCategoryRows({
                  lawdCd: molitLawdCd,
                  dealYm,
                  category,
                  maxPages: molitPages,
                  numOfRows: molitRows,
                });
                return { dealYm, result };
              } catch (molitError) {
                const { resultCode, resultMessage, httpStatus, httpMessage } = parseMolitErrorMeta(molitError);
                console.warn('[AddressMarket][MOLIT] fetch failed:', {
                  dealYm,
                  category,
                  resultCode,
                  resultMessage,
                  httpStatus,
                  httpMessage,
                  molitError,
                });
                return null;
              }
            })
          );

          const validResults = results.filter(
            (entry): entry is { dealYm: string; result: Awaited<ReturnType<typeof fetchMolitCategoryRows>> } =>
              entry !== null
          );

          const fetchedRows = validResults.reduce((sum, entry) => sum + entry.result.rows.length, 0);

          const pickText = (row: Record<string, unknown>, keys: string[]) => {
            for (const key of keys) {
              const value = row[key];
              if (typeof value === 'string' && value.trim()) return value.trim();
            }
            return null;
          };

          const pickNum = (row: Record<string, unknown>, keys: string[]) => {
            for (const key of keys) {
              const value = toNumberOrNull(row[key]);
              if (value !== null) return value;
            }
            return null;
          };

          const normalizedMolit = validResults.flatMap(({ dealYm, result }, resultIndex) => {
            return result.rows.flatMap((row, rowIndex) => {
              const dealAmount = pickNum(row, ['거래금액', '거래금액(만원)', '거래가액', 'dealAmount']);
              const depositAmount = pickNum(row, ['보증금액', '보증금', '임대보증금', 'deposit']);
              const rentAmount = pickNum(row, ['월세금액', '월세', 'monthlyRent']);

              const value = result.tradeMode === 'sale'
                ? dealAmount
                : (depositAmount ?? dealAmount);

              if (value === null || value <= 0) return [];

              const dealYearText = pickText(row, ['년', '계약년도', 'dealYear']) || dealYm.slice(0, 4);
              const dealMonthText = pickText(row, ['월', '계약월', 'dealMonth']) || dealYm.slice(4, 6);
              const dealDayText = pickText(row, ['일', '계약일', 'dealDay']) || '01';
              const dealMonth = parseMonthKey(`${dealYearText}${dealMonthText.padStart(2, '0')}`)
                || parseMonthKey(row['계약년월'])
                || parseMonthKey(row['dealYearMonth'])
                || `${dealYm.slice(0, 4)}-${dealYm.slice(4, 6)}`;
              const articleConfirmYmd = `${dealMonth.replace('-', '')}${dealDayText.padStart(2, '0')}`;

              const addressParts = [
                pickText(row, ['시군구']),
                pickText(row, ['sggNm']),
                pickText(row, ['법정동']),
                pickText(row, ['umdNm']),
                pickText(row, ['도로명']),
                pickText(row, ['roadNm']),
                pickText(row, ['지번']),
                pickText(row, ['jibun']),
              ].filter((v): v is string => !!v);

              const tradeTypeCode = result.tradeMode === 'sale'
                ? 'A1'
                : (rentAmount && rentAmount > 0 ? 'B2' : 'B1');

              const tradeTypeName = tradeTypeCode === 'A1'
                ? '매매'
                : (tradeTypeCode === 'B1' ? '전세' : '월세');

              const articleName = pickText(row, ['아파트', '단지', '건물명', '건축물대장건물명', '법정동', 'aptNm', 'offiNm', 'mhouseNm'])
                || `${result.propertyTypeName} ${tradeTypeName}`;
              const addressText = addressParts.length > 0 ? addressParts.join(' ') : (regionContext?.display || '-');
              const realEstateTypeCode = normalizeRealEstateTypeCode(`${result.propertyTypeName} ${articleName}`);

              if (!matchesSelectedTradeType([tradeTypeName, articleName], tradeTypeCode)) return [];
              if (!matchesSelectedPropertyType([result.propertyTypeName, articleName, addressText], realEstateTypeCode)) return [];

              const area = pickNum(row, ['전용면적', '대지면적', '건물면적', '연면적', 'excluUseAr', 'landAr']);

              return [{
                index: resultIndex * 100000 + rowIndex,
                month: dealMonth,
                value,
                tradeTypeCode,
                tradeTypeName,
                realEstateTypeCode,
                realEstateTypeName: result.propertyTypeName,
                articleName,
                addressText,
                articleConfirmYmd,
                rentPrc: rentAmount,
                area,
              }];
            });
          });

          if (normalizedMolit.length > 0) {
            const priceValues = normalizedMolit.map((row) => row.value);
            const totalCount = normalizedMolit.length;
            const avgPrice = Math.round(priceValues.reduce((sum, value) => sum + value, 0) / totalCount);
            const medianPrice = toMedian(priceValues);
            const minPrice = Math.min(...priceValues);
            const maxPrice = Math.max(...priceValues);

            const validAreaPrices = normalizedMolit
              .filter((row) => row.area !== null && row.area > 0)
              .map((row) => row.value / row.area!);
            const avgPricePerArea = validAreaPrices.length > 0
              ? Math.round(validAreaPrices.reduce((sum, value) => sum + value, 0) / validAreaPrices.length)
              : 0;

            const tradeMap = new Map<string, number>();
            const typeMap = new Map<string, number>();
            for (const row of normalizedMolit) {
              tradeMap.set(row.tradeTypeName, (tradeMap.get(row.tradeTypeName) || 0) + 1);
              typeMap.set(row.realEstateTypeName, (typeMap.get(row.realEstateTypeName) || 0) + 1);
            }

            const tradeDistribution = Array.from(tradeMap.entries())
              .map(([name, count]) => ({
                name,
                count,
                ratio: Number(((count / totalCount) * 100).toFixed(1)),
              }))
              .sort((a, b) => b.count - a.count);

            const propertyTypeDistribution = Array.from(typeMap.entries())
              .map(([name, count]) => ({
                name,
                count,
                ratio: Number(((count / totalCount) * 100).toFixed(1)),
              }))
              .sort((a, b) => b.count - a.count);

            const segmentStats = buildSegmentStats(
              normalizedMolit.map((row) => ({
                tradeTypeName: row.tradeTypeName,
                realEstateTypeName: row.realEstateTypeName,
                price: row.value,
                rentPrc: row.rentPrc,
                area: row.area,
                month: row.month,
                articleConfirmYmd: row.articleConfirmYmd,
              })),
              totalCount
            );
            const monthlyTrend = buildMonthlyTrend(
              normalizedMolit.map((row) => ({ month: row.month, price: row.value }))
            );
            const segmentMonthlyTrend = buildSegmentMonthlyTrends(
              normalizedMolit.map((row) => ({
                tradeTypeName: row.tradeTypeName,
                realEstateTypeName: row.realEstateTypeName,
                price: row.value,
                rentPrc: row.rentPrc,
                area: row.area,
                month: row.month,
                articleConfirmYmd: row.articleConfirmYmd,
              }))
            );

            const recentTransactions = [...normalizedMolit]
              .sort((a, b) => b.articleConfirmYmd.localeCompare(a.articleConfirmYmd))
              .slice(0, 30)
              .map((row, idx) => ({
                articleNo: `molit-${idx + 1}`,
                articleName: row.articleName,
                buildingName: null,
                tradeTypeName: row.tradeTypeName,
                realEstateTypeName: row.realEstateTypeName,
                price: Math.round(row.value),
                rentPrc: row.rentPrc,
                area: row.area,
                distanceM: null,
                articleConfirmYmd: row.articleConfirmYmd,
                address: row.addressText,
              }));

            const mapSamples = await buildPublicMapSamples(
              [...normalizedMolit]
                .sort((a, b) => b.articleConfirmYmd.localeCompare(a.articleConfirmYmd))
                .slice(0, 80)
                .map((row, idx) => ({
                  idSeed: `molit-${idx + 1}`,
                  locationKey: buildMapLocationKey({
                    articleName: row.articleName,
                    addressText: row.addressText,
                    realEstateTypeCode: row.realEstateTypeCode,
                  }),
                  geocodeQueries: buildMapSampleQueries({
                    articleName: row.articleName,
                    addressText: row.addressText,
                    realEstateTypeCode: row.realEstateTypeCode,
                  }),
                  articleNo: `molit-${idx + 1}`,
                  articleName: row.articleName,
                  buildingName: row.realEstateTypeCode === 'APT' ? row.articleName : null,
                  tradeTypeCode: row.tradeTypeCode,
                  tradeTypeName: row.tradeTypeName,
                  realEstateTypeCode: row.realEstateTypeCode,
                  realEstateTypeName: row.realEstateTypeName,
                  price: Math.round(row.value),
                  rentPrc: row.rentPrc,
                  area: row.area,
                  articleConfirmYmd: row.articleConfirmYmd,
                  address: row.addressText,
                }))
            );

            return c.json({
              center: {
                latitude: centerLat,
                longitude: centerLng,
                source: centerSource,
                address: address || null,
              },
              filters: {
                radiusMeters,
                realEstateType: realEstateType || null,
                tradeType: tradeType || null,
              },
              summary: {
                totalCount,
                avgPrice,
                medianPrice,
                minPrice,
                maxPrice,
                avgPricePerArea,
                infrastructure: summaryInfrastructure,
              },
              tradeDistribution,
              propertyTypeDistribution,
              segmentStats,
              segmentMonthlyTrend,
              segmentDistanceStats: [],
              distanceStats: [
                {
                  band: regionContext?.display ? `${regionContext.display} 집계` : '법정동 집계',
                  count: totalCount,
                  avgPrice,
                  medianPrice,
                },
              ],
              monthlyTrend,
              recentTransactions,
              mapSamples,
              sourceMeta: {
                sourceType: 'external-molit-rtms',
                statblId: null,
                serviceName: '국토교통부 실거래가 API (공공데이터포털)',
                listTotalCount: null,
                fetchedRows,
                scopedRows: normalizedMolit.length,
                analyzedRows: normalizedMolit.length,
                region: regionContext?.display || null,
                nearbyRegionCount: nearbyRegionNames.length,
                nearbyRegions: nearbyRegionNames.slice(0, 10),
                lawdCd: molitLawdCd,
                months: dealMonths,
                infrastructureMessage,
              },
            });
          }

          if (source === 'molit') {
            const empty = createEmptyResponse(fetchedRows);
            return c.json({
              ...empty,
              sourceMeta: {
                ...(empty.sourceMeta || {}),
                sourceType: 'PUBLIC_DATA_EMPTY',
                serviceName: '국토부 실거래가 조회 결과 없음 (API 권한/승인 상태 확인 필요)',
              },
            });
          }
        }
      }

      if (source === 'molit') {
        const empty = createEmptyResponse(0);
        return c.json({
          ...empty,
          sourceMeta: {
            ...(empty.sourceMeta || {}),
            sourceType: 'PUBLIC_DATA_EMPTY',
            serviceName: molitConfig.configured
              ? '국토부 실거래가 조회 조건 미충족 또는 API 권한 미승인'
              : '국토부 API 키 미설정',
          },
        });
      }
    }

    if (!rebConfig.configured) {
      const empty = createEmptyResponse(0);
      return c.json({
        ...empty,
        sourceMeta: {
          ...(empty.sourceMeta || {}),
          serviceName: source === 'reb'
            ? 'REB API 키 미설정'
            : '공공 API 키 미설정',
        },
      });
    }

    try {
      await loadRebRows();
    } catch (rebError) {
      console.warn('[AddressMarket][REB] fetch failed:', rebError);
      const empty = createEmptyResponse(0);
      return c.json({
        ...empty,
        sourceMeta: {
          ...(empty.sourceMeta || {}),
          serviceName: source === 'reb'
            ? 'REB 통계 조회 실패'
            : '공공 통계 조회 실패',
        },
      });
    }

    if (externalRows.length === 0) {
      const empty = createEmptyResponse(0);
      return c.json({
        ...empty,
        sourceMeta: {
          ...(empty.sourceMeta || {}),
          serviceName: '공공데이터 조회 결과 없음',
        },
      });
    }

    const regionTokens = Array.from(
      new Set(
        [regionContext?.sido, regionContext?.sigungu, regionContext?.dong, ...nearbyRegionNames]
          .filter((value): value is string => !!value && value.trim().length > 0)
          .map((value) => normalizeText(value))
      )
    );

    const scopedRows = externalRows.filter((row) => {
      if (regionTokens.length === 0) return true;
      const bag = normalizeText(extractStringBag(row));
      if (!bag) return false;
      return regionTokens.some((token) => bag.includes(token));
    });

    const sourceRows = scopedRows.length > 0 ? scopedRows : externalRows;

    const externalData = sourceRows
      .map((row, index) => {
        const value = pickMetricValue(row);
        if (value === null) return null;

        const month =
          parseMonthKey(row.WRTTIME_IDTFR_ID) ||
          parseMonthKey(row.WRTTIME_IDTFR) ||
          parseMonthKey(row.BASE_DE) ||
          parseMonthKey(row.DEAL_YMD) ||
          parseMonthKey(row.DEAL_DATE);

        const tradeTypeName =
          pickFirstString(row, ['TRD_SE_NM', 'TRADE_TYPE_NM', 'ITM_NM', 'ITM_TAG']) ||
          '확정거래';
        const realEstateTypeName =
          pickFirstString(row, ['RLET_TY_NM', 'HOUSE_TY_NM', 'CLS_NM', 'C1_NM', 'C2_NM']) ||
          '주택';
        const articleName =
          pickFirstString(row, ['APT_NM', 'COMPLEX_NM', 'STATBL_NM', 'ITM_NM']) ||
          `${realEstateTypeName} ${tradeTypeName}`;
        const addressText =
          pickFirstString(row, ['SIGUNGU_NM', 'LEGALDONG_NM', 'ADDR']) ||
          regionContext?.display ||
          address ||
          '-';

        const articleConfirmYmd = month ? `${month.replace('-', '')}01` : null;

        return {
          index,
          month,
          value,
          tradeTypeName,
          realEstateTypeName,
          articleName,
          addressText,
          articleConfirmYmd,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (externalData.length === 0) {
      return c.json({
        ...createEmptyResponse(externalRows.length),
        sourceMeta: {
          ...(createEmptyResponse(externalRows.length).sourceMeta || {}),
          sourceType: 'PUBLIC_DATA_EMPTY',
          serviceName: '공공데이터 정규화 결과 없음',
        },
      });
    }

    const normalizedExternal = externalData.map((row) => ({
      ...row,
      normalizedTrade: normalizeText(row.tradeTypeName),
      normalizedType: normalizeText(row.realEstateTypeName),
      normalizedBag: normalizeText(`${row.realEstateTypeName} ${row.tradeTypeName} ${row.articleName} ${row.addressText}`),
    }));

    const filteredExternalData = normalizedExternal.filter((row) => {
      return matchesSelectedTradeType(
        [row.tradeTypeName, `${row.realEstateTypeName} ${row.tradeTypeName} ${row.articleName} ${row.addressText}`]
      ) && matchesSelectedPropertyType(
        [row.realEstateTypeName, row.articleName, row.addressText],
        normalizeRealEstateTypeCode(`${row.realEstateTypeName} ${row.articleName}`)
      );
    });

    if (filteredExternalData.length === 0) { // If filtering by tradeType or realEstateType results in no data
      return c.json({
        ...createEmptyResponse(externalRows.length),
        sourceMeta: {
          ...(createEmptyResponse(externalRows.length).sourceMeta || {}),
          sourceType: 'PUBLIC_DATA_EMPTY',
          serviceName: '공공데이터 필터 결과 없음',
        },
      });
    }

    const scopedExternalData = filteredExternalData.map(({ normalizedTrade, normalizedType, normalizedBag, ...row }) => row);

    if (scopedExternalData.length === 0) { // If after mapping, there's still no data (should be covered by previous check but as a safeguard)
      return c.json({
        ...createEmptyResponse(externalRows.length),
        sourceMeta: {
          ...(createEmptyResponse(externalRows.length).sourceMeta || {}),
          sourceType: 'PUBLIC_DATA_EMPTY',
          serviceName: '공공데이터 분석 결과 없음',
        },
      });
    }

    const priceValues = scopedExternalData.map((row) => row.value);
    const totalCount = scopedExternalData.length;
    const avgPrice = Math.round(priceValues.reduce((sum, value) => sum + value, 0) / totalCount);
    const medianPrice = toMedian(priceValues);
    const minPrice = Math.min(...priceValues);
    const maxPrice = Math.max(...priceValues);
    const avgPricePerArea = 0;

    const tradeTypeMap = new Map<string, number>();
    const propertyTypeMap = new Map<string, number>();
    for (const row of scopedExternalData) {
      tradeTypeMap.set(row.tradeTypeName, (tradeTypeMap.get(row.tradeTypeName) || 0) + 1);
      propertyTypeMap.set(row.realEstateTypeName, (propertyTypeMap.get(row.realEstateTypeName) || 0) + 1);
    }

    const tradeDistribution = Array.from(tradeTypeMap.entries())
      .map(([name, count]) => ({
        name,
        count,
        ratio: Number(((count / totalCount) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.count - a.count);

    const propertyTypeDistribution = Array.from(propertyTypeMap.entries())
      .map(([name, count]) => ({
        name,
        count,
        ratio: Number(((count / totalCount) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.count - a.count);

    const segmentStats = buildSegmentStats(
      scopedExternalData.map((row) => ({
        tradeTypeName: row.tradeTypeName,
        realEstateTypeName: row.realEstateTypeName,
        price: row.value,
        rentPrc: null,
        area: null,
        month: row.month,
        articleConfirmYmd: row.articleConfirmYmd,
      })),
      totalCount
    );
    const segmentMonthlyTrend = buildSegmentMonthlyTrends(
      scopedExternalData.map((row) => ({
        tradeTypeName: row.tradeTypeName,
        realEstateTypeName: row.realEstateTypeName,
        price: row.value,
        rentPrc: null,
        area: null,
        month: row.month,
        articleConfirmYmd: row.articleConfirmYmd,
      }))
    );

    const distanceStats = [
      {
        band: regionContext?.display ? `${regionContext.display} 집계` : '지역 집계',
        count: totalCount,
        avgPrice,
        medianPrice,
      },
    ];

    const monthlyTrend = buildMonthlyTrend(
      scopedExternalData.map((row) => ({ month: row.month, price: row.value }))
    );

    const recentTransactions = scopedExternalData
      .sort((a, b) => {
        const aKey = a.articleConfirmYmd || '';
        const bKey = b.articleConfirmYmd || '';
        if (aKey && bKey) return bKey.localeCompare(aKey);
        return a.index - b.index;
      })
      .slice(0, 30)
      .map((row, idx) => ({
        articleNo: `external-${idx + 1}`,
        articleName: row.articleName,
        buildingName: null,
        tradeTypeName: row.tradeTypeName,
        realEstateTypeName: row.realEstateTypeName,
        price: Math.round(row.value),
        rentPrc: null,
        area: null,
        distanceM: null,
        articleConfirmYmd: row.articleConfirmYmd,
        address: row.addressText,
      }));

    return c.json({
      center: {
        latitude: centerLat,
        longitude: centerLng,
        source: centerSource,
        address: address || null,
      },
      filters: {
        radiusMeters,
        realEstateType: realEstateType || null,
        tradeType: tradeType || null,
      },
      summary: {
        totalCount,
        avgPrice,
        medianPrice,
        minPrice,
        maxPrice,
        avgPricePerArea,
        infrastructure: summaryInfrastructure,
      },
      tradeDistribution,
      propertyTypeDistribution,
      segmentStats,
      segmentMonthlyTrend,
      segmentDistanceStats: [],
      distanceStats,
      monthlyTrend,
      recentTransactions,
      mapSamples: [],
      sourceMeta: {
        sourceType: 'external-reb-confirmed',
        statblId: externalStatblId,
        serviceName,
        listTotalCount,
        fetchedRows: externalRows.length,
        scopedRows: sourceRows.length,
        analyzedRows: scopedExternalData.length,
        region: regionContext?.display || null,
        nearbyRegionCount: nearbyRegionNames.length,
        nearbyRegions: nearbyRegionNames.slice(0, 10),
        radiusMeters,
        filters: {
          realEstateType: realEstateType || null,
          tradeType: tradeType || null,
        },
        infrastructureMessage,
      },
    });
  } catch (error) {
    console.error('Address market statistics error:', error);
    const rawMessage = error instanceof Error ? error.message : 'Failed to fetch address market statistics';
    const shouldMaskDetail =
      /(api\s*key|service[_\s-]*key|open[_\s-]*api|molit|reb|public[_\s-]*data|configured|set one of)/i.test(rawMessage);
    const safeMessage = shouldMaskDetail
      ? '공공데이터 조회 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
      : rawMessage;

    return c.json(
      {
        error: safeMessage,
      },
      500
    );
  }
});

// ============================================
// 8. 사용자 관련 API
// ============================================

/**
 * GET /api/user/saved-properties
 * 저장한 매물 목록 조회
 */
app.get('/api/user/saved-properties', async (c) => {
  try {
    // TODO: 인증에서 userId 추출 (현재는 임시)
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }

    const savedProperties = await prisma.savedProperty.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return c.json({ savedProperties });
  } catch (error) {
    console.error('Saved properties fetch error:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch saved properties',
      },
      500
    );
  }
});

/**
 * POST /api/user/saved-properties
 * 매물 저장 (단건)
 */
app.post('/api/user/saved-properties', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }
    const body = await c.req.json();
    const { articleNo, complexNo, complexName, cachedName, cachedPrice, cachedType, cachedTrade, articleData } = body;

    if (!articleNo) {
      return c.json({ error: 'articleNo is required' }, 400);
    }

    const saved = await prisma.savedProperty.upsert({
      where: {
        userId_articleNo: {
          userId,
          articleNo,
        },
      },
      update: {
        isFavorite: true,
        cachedName,
        cachedPrice,
        cachedType,
        cachedTrade,
        complexName,
        articleData: articleData ? JSON.stringify(articleData) : undefined,
      },
      create: {
        userId,
        articleNo,
        complexNo,
        complexName,
        cachedName,
        cachedPrice,
        cachedType,
        cachedTrade,
        articleData: articleData ? JSON.stringify(articleData) : undefined,
      },
    });

    return c.json({ saved, success: true });
  } catch (error) {
    console.error('Save property error:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to save property',
      },
      500
    );
  }
});

/**
 * POST /api/user/saved-properties/bulk
 * 매물 일괄 저장 (정규 매물 저장용)
 * Body: { articles: Article[], complexNo?: string, complexName?: string }
 * NOTE: /bulk 경로가 단건 POST보다 먼저 정의되어야 함
 */
app.post('/api/user/saved-properties/bulk', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }
    const body = await c.req.json();
    const { articles, complexNo, complexName } = body;

    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      return c.json({ error: 'articles array is required' }, 400);
    }

    let savedCount = 0;
    let skippedCount = 0;

    for (const article of articles) {
      try {
        await prisma.savedProperty.upsert({
          where: {
            userId_articleNo: {
              userId,
              articleNo: article.articleNo,
            },
          },
          update: {
            cachedName: article.articleName || article.buildingName,
            cachedType: article.realEstateTypeName,
            cachedTrade: article.tradeTypeName,
            complexNo: complexNo || undefined,
            complexName: complexName || article.buildingName,
            articleData: JSON.stringify(article),
          },
          create: {
            userId,
            articleNo: article.articleNo,
            complexNo: complexNo || undefined,
            complexName: complexName || article.buildingName,
            cachedName: article.articleName || article.buildingName,
            cachedType: article.realEstateTypeName,
            cachedTrade: article.tradeTypeName,
            articleData: JSON.stringify(article),
          },
        });
        savedCount++;
      } catch (err) {
        console.error(`Failed to save article ${article.articleNo}:`, err);
        skippedCount++;
      }
    }

    return c.json({
      success: true,
      savedCount,
      skippedCount,
      totalRequested: articles.length,
    });
  } catch (error) {
    console.error('Bulk save error:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to bulk save properties',
      },
      500
    );
  }
});

/**
 * DELETE /api/user/saved-properties/:articleNo
 * 매물 저장 취소 (단건)
 */
app.delete('/api/user/saved-properties/:articleNo', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }
    const articleNo = c.req.param('articleNo');

    await prisma.savedProperty.deleteMany({
      where: { userId, articleNo },
    });

    return c.json({ success: true });
  } catch (error) {
    console.error('Unsave property error:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to unsave property',
      },
      500
    );
  }
});

/**
 * DELETE /api/user/saved-properties
 * 매물 일괄 삭제
 * Body: { articleNos: string[] }
 */
app.delete('/api/user/saved-properties', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }
    const body = await c.req.json();
    const { articleNos } = body;

    if (!articleNos || !Array.isArray(articleNos) || articleNos.length === 0) {
      return c.json({ error: 'articleNos array is required' }, 400);
    }

    const result = await prisma.savedProperty.deleteMany({
      where: {
        userId,
        articleNo: { in: articleNos },
      },
    });

    return c.json({ success: true, deletedCount: result.count });
  } catch (error) {
    console.error('Bulk delete error:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to bulk delete properties',
      },
      500
    );
  }
});

/**
 * GET /api/user/search-conditions
 * 저장한 검색 조건 목록
 */
app.get('/api/user/search-conditions', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }

    const conditions = await prisma.searchCondition.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return c.json({ conditions });
  } catch (error) {
    console.error('Search conditions fetch error:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch search conditions',
      },
      500
    );
  }
});

/**
 * POST /api/user/search-conditions
 * 검색 조건 저장
 */
app.post('/api/user/search-conditions', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }
    const body = await c.req.json();
    const { name, cortarNo, regionName, realEstateTypes, tradeTypes, priceMin, priceMax, areaMin, areaMax, defaultOrder } = body;

    const condition = await prisma.searchCondition.create({
      data: {
        userId,
        name,
        cortarNo,
        regionName,
        realEstateTypes: realEstateTypes ? String(realEstateTypes) : undefined,
        tradeTypes: tradeTypes ? String(tradeTypes) : undefined,
        priceMin,
        priceMax,
        areaMin,
        areaMax,
        defaultOrder,
      },
    });

    return c.json({ condition, success: true });
  } catch (error) {
    console.error('Save search condition error:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to save search condition',
      },
      500
    );
  }
});

/**
 * POST /api/user/price-alerts
 * 가격 알림 설정
 */
app.post('/api/user/price-alerts', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }
    const body = await c.req.json();
    const { name, articleNo, complexNo, cortarNo, alertType, targetPrice, changeRate } = body;

    const alert = await prisma.priceAlert.create({
      data: {
        userId,
        name,
        articleNo,
        complexNo,
        cortarNo,
        alertType,
        targetPrice,
        changeRate,
      },
    });

    return c.json({ alert, success: true });
  } catch (error) {
    console.error('Create price alert error:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create price alert',
      },
      500
    );
  }
});

/**
 * GET /api/user/price-alerts
 * 가격 알림 목록
 */
app.get('/api/user/price-alerts', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }

    const alerts = await prisma.priceAlert.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return c.json({ alerts });
  } catch (error) {
    console.error('Price alerts fetch error:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch price alerts',
      },
      500
    );
  }
});

/**
 * GET /api/user/summary
 * 사용자 요약 정보
 */
app.get('/api/user/summary', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }

    const [savedCount, alertCount, conditionCount] = await Promise.all([
      prisma.savedProperty.count({ where: { userId } }),
      prisma.priceAlert.count({ where: { userId, isActive: true } }),
      prisma.searchCondition.count({ where: { userId } }),
    ]);

    return c.json({
      savedCount,
      activeAlertCount: alertCount,
      conditionCount,
    });
  } catch (error) {
    console.error('User summary fetch error:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch user summary',
      },
      500
    );
  }
});

/**
 * GET /api/user/profile
 * 사용자 프로필 조회
 */
app.get('/api/user/profile', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        zipCode: true,
        address: true,
        detailAddress: true,
        companyName: true,
        businessNumber: true,
      },
    });

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json(user);
  } catch (error) {
    console.error('Profile fetch error:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch profile',
      },
      500
    );
  }
});

/**
 * PUT /api/user/profile
 * 사용자 프로필 수정
 */
app.put('/api/user/profile', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }
    const body = await c.req.json();
    const { name, email, phone, zipCode, address, detailAddress, companyName, businessNumber } = body;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        name: name || undefined,
        email: email || undefined,
        phone: phone || undefined,
        zipCode: zipCode || undefined,
        address: address || undefined,
        detailAddress: detailAddress || undefined,
        companyName: companyName || undefined,
        businessNumber: businessNumber || undefined,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        zipCode: true,
        address: true,
        detailAddress: true,
        companyName: true,
        businessNumber: true,
      },
    });

    return c.json(updated);
  } catch (error) {
    console.error('Profile update error:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to update profile',
      },
      500
    );
  }
});

/**
 * DELETE /api/user/profile
 * 사용자 프로필 삭제
 */
app.delete('/api/user/profile', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }

    await prisma.user.delete({
      where: { id: userId },
    });

    return c.json({ success: true });
  } catch (error) {
    console.error('Profile delete error:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to delete profile',
      },
      500
    );
  }
});

// ============================================
// 9. 인증 API (회원가입/로그인)
// ============================================

// 비밀번호 해시 함수 (Web Crypto API 사용)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 비밀번호 검증 함수
async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  const inputHash = await hashPassword(password);
  return inputHash === hashedPassword;
}

// JWT 토큰 생성/검증 (간단한 구현)
function generateToken(userId: string): string {
  const payload = {
    userId,
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7일
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

function decodeToken(token: string): { userId: string; exp: number } | null {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString());
    if (payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

// Auth endpoints moved to src/server/auth.ts to avoid duplication

/**
 * POST /api/auth/logout
 * 로그아웃 (클라이언트에서 토큰 삭제)
 */
app.post('/api/auth/logout', async (c) => {
  return c.json({ success: true });
});

/**
 * POST /api/auth/make-admin
 * 관리자 권한 부여 (개발용)
 */
app.post('/api/auth/make-admin', async (c) => {
  try {
    const body = await c.req.json();
    const { email } = body;

    if (!email) {
      return c.json({ error: '이메일은 필수입니다.' }, 400);
    }

    const user = await prisma.user.update({
      where: { email },
      data: { role: 'admin' },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!user) {
      return c.json({ error: '사용자를 찾을 수 없습니다.' }, 404);
    }

    return c.json({ success: true, user });
  } catch (error) {
    console.error('Make admin error:', error);
    return c.json(
      { error: error instanceof Error ? error.message : '관리자 권한 부여에 실패했습니다.' },
      500
    );
  }
});

/**
 * PUT /api/user/theme
 * 테마 설정 저장
 */
app.put('/api/user/theme', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }

    const token = authHeader.substring(7);
    const payload = JSON.parse(atob(token));

    const body = await c.req.json();
    const { themeMode, accentColor, fontSize, borderRadius, compactMode } = body;

    // 유효성 검사
    const validThemeModes = ['light', 'dark', 'system', 'smart'];
    const validAccentColors = ['cyan', 'indigo', 'pink', 'orange', 'green', 'red'];
    const validFontSizes = ['small', 'medium', 'large'];
    const validBorderRadii = ['sharp', 'medium', 'rounded'];

    if (themeMode && !validThemeModes.includes(themeMode)) {
      return c.json({ error: '잘못된 테마 모드입니다.' }, 400);
    }
    if (accentColor && !validAccentColors.includes(accentColor)) {
      return c.json({ error: '잘못된 강조 색상입니다.' }, 400);
    }
    if (fontSize && !validFontSizes.includes(fontSize)) {
      return c.json({ error: '잘못된 글자 크기입니다.' }, 400);
    }
    if (borderRadius && !validBorderRadii.includes(borderRadius)) {
      return c.json({ error: '잘못된 모서리 둥글기입니다.' }, 400);
    }
    if (typeof compactMode !== 'undefined' && typeof compactMode !== 'boolean') {
      return c.json({ error: '잘못된 컴팩트 모드 값입니다.' }, 400);
    }

    const updateData: any = {};
    if (themeMode) updateData.themeMode = themeMode;
    if (accentColor) updateData.accentColor = accentColor;
    if (fontSize) updateData.fontSize = fontSize;
    if (borderRadius) updateData.borderRadius = borderRadius;
    if (typeof compactMode !== 'undefined') updateData.compactMode = compactMode;

    const user = await prisma.user.update({
      where: { id: payload.userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        themeMode: true,
        accentColor: true,
        fontSize: true,
        borderRadius: true,
        compactMode: true,
      },
    });

    return c.json({ success: true, user });
  } catch (error) {
    console.error('Theme update error:', error);
    return c.json(
      { error: error instanceof Error ? error.message : '테마 설정 저장에 실패했습니다.' },
      500
    );
  }
});

// ============================================
// 지도 프록시 (네이버/카카오)
// ============================================

/**
 * GET /api/proxy/naver-map
 * 네이버 지도 JS 프록시 (인증 우회)
 */
app.get('/api/proxy/naver-map', async (c) => {
  try {
    const clientId = process.env.VITE_NAVER_MAP_CLIENT_ID || '8e5c59zw88';
    const url = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}`;

    const response = await fetch(url);
    const content = await response.text();

    return c.html(content);
  } catch (error) {
    console.error('Naver Map proxy error:', error);
    return c.html('console.error("Failed to load naver map");', 500);
  }
});

/**
 * GET /api/proxy/kakao-map
 * 카카오 맵 SDK 프록시 (CORS 우회)
 */
app.get('/api/proxy/kakao-map/*', async (c) => {
  try {
    const appKey = c.req.query('appkey') || process.env.VITE_KAKAO_MAP_APP_KEY || process.env.KAKAO_MAP_APP_KEY || 'dedee21cec058fab2ff59137baaa0d1b';
    const libraries = c.req.query('libraries');
    const autoload = c.req.query('autoload') || 'false';
    const url = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=${autoload}${libraries ? `&libraries=${libraries}` : ''}`;

    const upstreamHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    const response = await fetch(url, {
      headers: upstreamHeaders,
    });

    if (!response.ok) {
      console.error('[Kakao Map Proxy] Fetch failed:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('[Kakao Map Proxy] Error response:', errorText);
      return c.text(`console.error("[Kakao Map Proxy] Fetch failed: ${response.status}");`, 500);
    }

    const content = await response.text();
    const appKeyLiteral = JSON.stringify(appKey);
    const patchedContentStep1 = content.replace(
      /m=l\.appkey,m&&\(e\.apikey=m\),e\.version=/,
      `m=l.appkey||${appKeyLiteral},m&&(e.apikey=m),e.version=`
    );
    const patchedContentStep2 = patchedContentStep1.replace(
      /m=l\.appkey,m&&\(e\.apikey=m\)/,
      `m=l.appkey||${appKeyLiteral},m&&(e.apikey=m)`
    );
    const patchedContent = patchedContentStep2;
    // JavaScript로 반환하고 CORS 헤더 추가
    return c.text(patchedContent, 200, {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    });
  } catch (error) {
    console.error('Kakao Map proxy error:', error);
    return c.text('console.error("[Kakao Map Proxy] Failed to load");', 500, {
      'Content-Type': 'application/javascript; charset=utf-8',
    });
  }
});

// ============================================
// 글로벌 테마 설정 (모든 사용자 공유)
// ============================================

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const GLOBAL_THEME_FILE = join(process.cwd(), 'global-theme.json');

const DEFAULT_GLOBAL_THEME = {
  mode: 'smart',
  accentColor: 'cyan',
  fontSize: 'medium',
  borderRadius: 'medium',
  compactMode: false,
};

function loadGlobalTheme() {
  try {
    if (existsSync(GLOBAL_THEME_FILE)) {
      const data = readFileSync(GLOBAL_THEME_FILE, 'utf-8');
      return { ...DEFAULT_GLOBAL_THEME, ...JSON.parse(data) };
    }
  } catch (e) {
    console.error('Failed to load global theme:', e);
  }
  return { ...DEFAULT_GLOBAL_THEME };
}

function saveGlobalTheme(theme: any) {
  try {
    writeFileSync(GLOBAL_THEME_FILE, JSON.stringify(theme, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('Failed to save global theme:', e);
    return false;
  }
}

/**
 * GET /api/global-theme
 * 글로벌 테마 조회
 */
app.get('/api/global-theme', (c) => {
  const theme = loadGlobalTheme();
  return c.json(theme);
});

/**
 * PUT /api/global-theme
 * 글로벌 테마 저장
 */
app.put('/api/global-theme', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, role: true },
    });

    const isThemeAdmin = user?.role === 'admin' || user?.email === 'jowoosung@gmail.com';
    if (!isThemeAdmin) {
      return c.json({ error: '전역 테마는 최고관리자만 변경할 수 있습니다.' }, 403);
    }

    const body = await c.req.json();
    const { themeMode, accentColor, fontSize, borderRadius, compactMode } = body;

    const currentTheme = loadGlobalTheme();

    if (themeMode) currentTheme.mode = themeMode;
    if (accentColor) currentTheme.accentColor = accentColor;
    if (fontSize) currentTheme.fontSize = fontSize;
    if (borderRadius) currentTheme.borderRadius = borderRadius;
    if (typeof compactMode === 'boolean') currentTheme.compactMode = compactMode;

    if (saveGlobalTheme(currentTheme)) {
      console.log('[Global Theme] 저장:', JSON.stringify(currentTheme));
      return c.json({ success: true, theme: currentTheme });
    } else {
      return c.json({ error: '테마 저장 실패' }, 500);
    }
  } catch (error) {
    console.error('Global theme save error:', error);
    return c.json({ error: '테마 저장 실패' }, 500);
  }
});

// ============================================
// 관심 매물 API (독립 - 네이버 데이터 무관)
// ============================================

app.get('/api/favorite-properties', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }
    const properties = await prisma.favoriteProperty.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return c.json({ success: true, properties });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Failed to fetch' }, 500);
  }
});

app.post('/api/favorite-properties', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }
    const body = await c.req.json();
    if (!body.articleName) return c.json({ error: '매물명은 필수입니다' }, 400);

    const property = await prisma.favoriteProperty.create({
      data: {
        userId,
        articleName: body.articleName,
        buildingName: body.buildingName || null,
        address: body.address || null,
        propertyType: body.propertyType || null,
        tradeType: body.tradeType || null,
        price: body.price || null,
        area: body.area || null,
        notes: body.notes || null,
      },
    });
    return c.json({ success: true, property });
  } catch (error) {
    console.error('Favorite property create error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to create' }, 500);
  }
});

app.put('/api/favorite-properties/:id', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }
    const id = c.req.param('id');
    const body = await c.req.json();
    const updateData: any = {};
    for (const field of ['articleName', 'buildingName', 'address', 'propertyType', 'tradeType', 'price', 'area', 'notes']) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }
    const result = await prisma.favoriteProperty.updateMany({
      where: { id, userId },
      data: updateData,
    });
    if (result.count === 0) {
      return c.json({ error: '관심매물을 찾을 수 없습니다.' }, 404);
    }
    const property = await prisma.favoriteProperty.findFirst({ where: { id, userId } });
    return c.json({ success: true, property });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Failed to update' }, 500);
  }
});

app.delete('/api/favorite-properties/:id', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }
    const id = c.req.param('id');
    const result = await prisma.favoriteProperty.deleteMany({ where: { id, userId } });
    if (result.count === 0) {
      return c.json({ error: '관심매물을 찾을 수 없습니다.' }, 404);
    }
    return c.json({ success: true, message: 'Deleted' });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Failed to delete' }, 500);
  }
});

app.post('/api/favorite-properties/:id/convert-to-managed', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }

    const id = c.req.param('id');
    const body = await c.req.json();
    const favoriteProperty = await prisma.favoriteProperty.findFirst({
      where: { id, userId },
    });

    if (!favoriteProperty) {
      return c.json({ error: '관심매물을 찾을 수 없습니다.' }, 404);
    }

    if (!body.articleName || !body.contractType || !body.contractDate || !body.contractEndDate) {
      return c.json({ error: '매물명, 거래유형, 계약시작일, 계약만료일은 필수입니다' }, 400);
    }

    const parsedPropertyId = body.propertyId === undefined || body.propertyId === null || body.propertyId === ''
      ? null
      : Number(body.propertyId);

    const managedProperty = await prisma.$transaction(async (tx) => {
      const created = await tx.managedProperty.create({
        data: {
          userId,
          articleName: body.articleName,
          buildingName: body.buildingName || null,
          address: body.address || null,
          propertyId: Number.isNaN(parsedPropertyId) ? null : parsedPropertyId,
          contractType: body.contractType,
          propertyType: body.propertyType || null,
          downPayment: body.downPayment ?? null,
          downPaymentDate: body.downPaymentDate ? new Date(body.downPaymentDate) : null,
          interimPayment: body.interimPayment ?? null,
          interimPaymentDate: body.interimPaymentDate ? new Date(body.interimPaymentDate) : null,
          finalPayment: body.finalPayment ?? null,
          finalPaymentDate: body.finalPaymentDate ? new Date(body.finalPaymentDate) : null,
          contractDate: new Date(body.contractDate),
          contractEndDate: new Date(body.contractEndDate),
          totalPrice: body.totalPrice ?? null,
          depositAmount: body.depositAmount ?? null,
          monthlyRent: body.monthlyRent ?? null,
          tenantName: body.tenantName || null,
          tenantPhone: body.tenantPhone || null,
          managerName: body.managerName || null,
          managerPhone: body.managerPhone || null,
          notes: body.notes ?? favoriteProperty.notes ?? null,
          status: body.status || 'active',
        },
      });

      await tx.favoriteProperty.deleteMany({
        where: { id, userId },
      });

      return created;
    });

    return c.json({ success: true, property: managedProperty });
  } catch (error) {
    console.error('Favorite property convert error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to convert favorite property' }, 500);
  }
});

// ============================================
// 관리 매물 API (계약 관리)
// ============================================

/**
 * GET /api/customer-info
 * 관리매물 기준 고객 정보 조회 및 고객 테이블 동기화
 */
app.get('/api/customer-info', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }

    const result = await syncCustomerInfoForUser(userId);
    return c.json({ success: true, customers: result.customers });
  } catch (error) {
    console.error('Customer info fetch error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to fetch customer info' }, 500);
  }
});

/**
 * GET /api/customer-info/saved-customer-keys
 * 등록된 고객의 customerKey 목록 조회
 */
app.get('/api/customer-info/saved-customer-keys', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }

    const customerInfos = await prisma.customerInfo.findMany({
      where: { userId },
      select: { customerKey: true },
    });

    const customerKeys = customerInfos.map((ci) => ci.customerKey);
    return c.json({ success: true, customerKeys });
  } catch (error) {
    console.error('Customer info saved keys fetch error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to fetch' }, 500);
  }
});

/**
 * POST /api/customer-info/save-property/:propertyId
 * 특정 관리매물의 책임자를 고객으로 등록
 */
app.post('/api/customer-info/save-property/:propertyId', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }

    const propertyId = c.req.param('propertyId');
    const customerInfo = await saveCustomerInfoForProperty(userId, propertyId);

    return c.json({
      success: true,
      customerInfo,
    });
  } catch (error) {
    console.error('Customer info save error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to save customer info' }, 500);
  }
});

/**
 * PUT /api/customer-info/:id
 * 고객 정보 수정
 */
app.put('/api/customer-info/:id', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }

    const id = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const currentCustomerInfo = await prisma.customerInfo.findFirst({
      where: { id, userId },
    });

    if (!currentCustomerInfo) {
      return c.json({ error: '고객 정보를 찾을 수 없습니다.' }, 404);
    }

    const updateData: {
      customerName?: string;
      customerPhone?: string | null;
      customerKey?: string;
      memo?: string | null;
    } = {};

    const nextCustomerName =
      typeof body.customerName === 'string' && body.customerName.trim()
        ? body.customerName.trim()
        : currentCustomerInfo.customerName;

    const nextCustomerPhone =
      body.customerPhone === undefined
        ? currentCustomerInfo.customerPhone
        : typeof body.customerPhone === 'string' && body.customerPhone.trim()
          ? body.customerPhone.trim()
          : null;

    if (body.customerName !== undefined) {
      if (typeof body.customerName !== 'string' || !body.customerName.trim()) {
        return c.json({ error: '고객명은 비워둘 수 없습니다.' }, 400);
      }
      updateData.customerName = nextCustomerName;
    }

    if (body.customerPhone !== undefined) {
      updateData.customerPhone = nextCustomerPhone;
    }

    if (body.memo !== undefined) {
      if (typeof body.memo !== 'string') {
        return c.json({ error: '메모 형식이 올바르지 않습니다.' }, 400);
      }
      updateData.memo = body.memo.trim() ? body.memo.trim() : null;
    }

    if (body.customerName !== undefined || body.customerPhone !== undefined) {
      updateData.customerKey = buildCustomerInfoKey(nextCustomerName, nextCustomerPhone);
    }

    const customerInfo = await prisma.customerInfo.update({
      where: { id: currentCustomerInfo.id },
      data: updateData,
    });

    return c.json({ success: true, customerInfo });
  } catch (error) {
    console.error('Customer info update error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to update customer info' }, 500);
  }
});

/**
 * DELETE /api/customer-info/:id
 * 고객 정보 삭제
 */
app.delete('/api/customer-info/:id', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }

    const id = c.req.param('id');
    const result = await prisma.customerInfo.deleteMany({
      where: { id, userId },
    });

    if (result.count === 0) {
      return c.json({ error: '고객 정보를 찾을 수 없습니다.' }, 404);
    }

    return c.json({ success: true, message: 'Deleted' });
  } catch (error) {
    console.error('Customer info delete error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to delete customer info' }, 500);
  }
});

/**
 * GET /api/customer-consultations
 * 고객 상담 기록 조회
 */
app.get('/api/customer-consultations', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }

    const consultations = await prisma.customerConsultation.findMany({
      where: { userId },
      orderBy: [{ consultedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return c.json({ success: true, consultations });
  } catch (error) {
    console.error('Customer consultations fetch error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to fetch customer consultations' }, 500);
  }
});

/**
 * POST /api/customer-consultations
 * 고객 상담 기록 등록
 */
app.post('/api/customer-consultations', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }

    const body = await c.req.json().catch(() => ({}));
    const requestedCustomerInfoId = typeof body.customerInfoId === 'string' && body.customerInfoId.trim()
      ? body.customerInfoId.trim()
      : null;
    const requestedCustomerName = typeof body.customerName === 'string' ? body.customerName.trim() : '';
    const requestedCustomerPhone = typeof body.customerPhone === 'string' && body.customerPhone.trim()
      ? body.customerPhone.trim()
      : null;
    const content = typeof body.content === 'string' ? body.content.trim() : '';

    if (!content) {
      return c.json({ error: '상담 내용을 입력해야 합니다.' }, 400);
    }

    let customerInfo = null;
    if (requestedCustomerInfoId) {
      customerInfo = await prisma.customerInfo.findFirst({
        where: { id: requestedCustomerInfoId, userId },
      });

      if (!customerInfo) {
        return c.json({ error: '선택한 고객 정보를 찾을 수 없습니다.' }, 404);
      }
    }

    const customerName = customerInfo?.customerName || requestedCustomerName;
    const customerPhone = requestedCustomerPhone ?? customerInfo?.customerPhone ?? null;

    if (!customerName) {
      return c.json({ error: '고객명을 입력해야 합니다.' }, 400);
    }

    const resolvedCustomerInfo = await upsertCustomerInfoForConsultation(userId, customerName, customerPhone);
    const consultation = await prisma.customerConsultation.create({
      data: {
        userId,
        customerInfoId: resolvedCustomerInfo.id,
        customerName: resolvedCustomerInfo.customerName,
        customerPhone: resolvedCustomerInfo.customerPhone,
        content,
      },
    });

    return c.json({ success: true, consultation });
  } catch (error) {
    console.error('Customer consultation create error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to create customer consultation' }, 500);
  }
});

/**
 * PUT /api/customer-consultations/:id
 * 고객 상담 기록 수정
 */
app.put('/api/customer-consultations/:id', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }

    const id = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const content = typeof body.content === 'string' ? body.content.trim() : '';

    if (!content) {
      return c.json({ error: '상담 내용을 입력해야 합니다.' }, 400);
    }

    const currentConsultation = await prisma.customerConsultation.findFirst({
      where: { id, userId },
    });

    if (!currentConsultation) {
      return c.json({ error: '상담 기록을 찾을 수 없습니다.' }, 404);
    }

    const consultation = await prisma.customerConsultation.update({
      where: { id: currentConsultation.id },
      data: { content },
    });

    return c.json({ success: true, consultation });
  } catch (error) {
    console.error('Customer consultation update error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to update customer consultation' }, 500);
  }
});

/**
 * DELETE /api/customer-consultations/:id
 * 고객 상담 기록 삭제
 */
app.delete('/api/customer-consultations/:id', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }

    const id = c.req.param('id');
    const result = await prisma.customerConsultation.deleteMany({
      where: { id, userId },
    });

    if (result.count === 0) {
      return c.json({ error: '상담 기록을 찾을 수 없습니다.' }, 404);
    }

    return c.json({ success: true, message: 'Deleted' });
  } catch (error) {
    console.error('Customer consultation delete error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to delete customer consultation' }, 500);
  }
});

/**
 * GET /api/managed-properties
 * 관리 매물 목록 조회
 * @query renewalDays - 재계약 만료 N일 이내 필터 (90, 30, 15, 7, 3, 1)
 * @query paymentType - 납부 알림 필터 (interim, final)
 * @query paymentDays - 납부 N일 이내 필터
 * @query status - 상태 필터 (active, expired, renewed)
 */
app.get('/api/managed-properties', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }
    const renewalDays = c.req.query('renewalDays') ? parseInt(c.req.query('renewalDays')!) : undefined;
    const paymentType = c.req.query('paymentType');
    const paymentDays = c.req.query('paymentDays') ? parseInt(c.req.query('paymentDays')!) : undefined;
    const status = c.req.query('status') || 'active';

    const where: any = { userId };
    if (status !== 'all') {
      where.status = status;
    }

    // 재계약 만료일 기준 필터
    if (renewalDays !== undefined) {
      const now = new Date();
      const futureDate = new Date(now.getTime() + renewalDays * 24 * 60 * 60 * 1000);
      where.contractEndDate = {
        gte: now,
        lte: futureDate,
      };
    }

    // 납부일 기준 필터 (중도금/잔금)
    if (paymentType && paymentDays !== undefined) {
      const now = new Date();
      const futureDate = new Date(now.getTime() + paymentDays * 24 * 60 * 60 * 1000);
      if (paymentType === 'interim') {
        where.interimPaymentDate = { gte: now, lte: futureDate };
      } else if (paymentType === 'final') {
        where.finalPaymentDate = { gte: now, lte: futureDate };
      }
    }

    const properties = await prisma.managedProperty.findMany({
      where,
      orderBy: { contractEndDate: 'asc' },
    });

    return c.json({ success: true, properties });
  } catch (error) {
    console.error('Managed properties fetch error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to fetch' }, 500);
  }
});

/**
 * POST /api/managed-properties/:id/test-notification
 * 관리매물 만료 알림 테스트 발송
 */
app.post('/api/managed-properties/:id/test-notification', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }

    const id = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const template = typeof body?.template === 'string' ? body.template.trim() : '';
    const notificationType = body?.notificationType;

    if (!template) {
      return c.json({ error: '전송할 메시지 템플릿이 비어 있습니다.' }, 400);
    }

    if (!isManagedPropertyNotificationType(notificationType)) {
      return c.json({ error: '유효한 알림 종류를 선택해야 합니다.' }, 400);
    }

    const property = await prisma.managedProperty.findFirst({
      where: { id, userId },
      select: {
        id: true,
        articleName: true,
        contractType: true,
        contractEndDate: true,
        managerName: true,
        managerPhone: true,
        tenantName: true,
        tenantPhone: true,
        address: true,
        notificationHistory: true,
      },
    });

    if (!property) {
      return c.json({ error: '관리매물을 찾을 수 없습니다.' }, 404);
    }

    const recipientPhone = property.managerPhone;
    if (!recipientPhone) {
      return c.json({ error: '책임자 연락처가 없어 알림을 보낼 수 없습니다.' }, 400);
    }

    const message = renderManagedPropertyNotificationTemplate(template, property);
    const sentAt = new Date();

    console.log('[KAKAO NOTIFY TEST]', {
      propertyId: property.id,
      articleName: property.articleName,
      recipientPhone,
      message,
    });

    await prisma.managedProperty.update({
      where: { id: property.id },
      data: {
        lastNotificationSentAt: sentAt,
        notificationHistory: {
          ...normalizeNotificationHistory(property.notificationHistory),
          [notificationType]: sentAt.toISOString(),
        },
      },
    });

    return c.json({
      success: true,
      simulated: true,
      notificationType,
      recipientPhone,
      message,
      messageLength: message.length,
      sentAt: sentAt.toISOString(),
      info: '현재는 테스트 발송 단계로 서버 로그에 기록됩니다. 카카오 발송 어댑터 연결 후 실제 발송으로 전환됩니다.',
    });
  } catch (error) {
    console.error('Managed property notification test error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to send test notification' }, 500);
  }
});

/**
 * POST /api/managed-properties/test-notifications
 * 현재 선택된 관리매물 목록에 대해 책임자 일괄 알림 테스트 발송
 */
app.post('/api/managed-properties/test-notifications', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }

    const body = await c.req.json().catch(() => ({}));
    const template = typeof body?.template === 'string' ? body.template.trim() : '';
    const notificationType = body?.notificationType;
    const propertyIds = Array.isArray(body?.propertyIds)
      ? body.propertyIds.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
      : [];

    if (!template) {
      return c.json({ error: '전송할 메시지 템플릿이 비어 있습니다.' }, 400);
    }

    if (propertyIds.length === 0) {
      return c.json({ error: '알림을 보낼 관리매물을 먼저 선택해야 합니다.' }, 400);
    }

    if (!isManagedPropertyNotificationType(notificationType)) {
      return c.json({ error: '유효한 알림 종류를 선택해야 합니다.' }, 400);
    }

    const properties = await prisma.managedProperty.findMany({
      where: {
        userId,
        id: { in: propertyIds },
      },
      select: {
        id: true,
        articleName: true,
        contractType: true,
        contractEndDate: true,
        managerName: true,
        managerPhone: true,
        address: true,
        notificationHistory: true,
      },
      orderBy: { contractEndDate: 'asc' },
    });

    const readyTargets = properties.filter((property) => property.managerPhone);
    const skippedTargets = properties
      .filter((property) => !property.managerPhone)
      .map((property) => ({
        propertyId: property.id,
        articleName: property.articleName,
        reason: '책임자 연락처 없음',
      }));

    for (const property of readyTargets) {
      const message = renderManagedPropertyNotificationTemplate(template, property);
      console.log('[KAKAO NOTIFY BATCH TEST]', {
        propertyId: property.id,
        articleName: property.articleName,
        recipientPhone: property.managerPhone,
        message,
      });
    }

    const sentAt = new Date();
    if (readyTargets.length > 0) {
      await prisma.$transaction(
        readyTargets.map((property) =>
          prisma.managedProperty.update({
            where: { id: property.id },
            data: {
              lastNotificationSentAt: sentAt,
              notificationHistory: {
                ...normalizeNotificationHistory(property.notificationHistory),
                [notificationType]: sentAt.toISOString(),
              },
            },
          })
        )
      );
    }

    return c.json({
      success: true,
      simulated: true,
      notificationType,
      requestedCount: propertyIds.length,
      matchedCount: properties.length,
      sentCount: readyTargets.length,
      skippedCount: skippedTargets.length,
      sentTargets: readyTargets.map((property) => ({
        propertyId: property.id,
        articleName: property.articleName,
        recipientPhone: property.managerPhone,
        sentAt: sentAt.toISOString(),
      })),
      skippedTargets,
      info: '현재는 테스트 발송 단계로 서버 로그에 기록됩니다. 카카오 발송 어댑터 연결 후 실제 발송으로 전환됩니다.',
    });
  } catch (error) {
    console.error('Managed property batch notification test error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to send batch notification' }, 500);
  }
});

/**
 * POST /api/managed-properties
 * 관리 매물 등록
 */
app.post('/api/managed-properties', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }
    const body = await c.req.json();

    if (!body.articleName || !body.contractType || !body.contractDate || !body.contractEndDate) {
      return c.json({ error: '매물명, 거래유형, 계약시작일, 계약만료일은 필수입니다' }, 400);
    }

    const property = await prisma.managedProperty.create({
      data: {
        userId,
        articleName: body.articleName,
        buildingName: body.buildingName || null,
        address: body.address || null,
        propertyId: body.propertyId || null,
        contractType: body.contractType,
        propertyType: body.propertyType || null,
        downPayment: body.downPayment || null,
        downPaymentDate: body.downPaymentDate ? new Date(body.downPaymentDate) : null,
        interimPayment: body.interimPayment || null,
        interimPaymentDate: body.interimPaymentDate ? new Date(body.interimPaymentDate) : null,
        finalPayment: body.finalPayment || null,
        finalPaymentDate: body.finalPaymentDate ? new Date(body.finalPaymentDate) : null,
        contractDate: new Date(body.contractDate),
        contractEndDate: new Date(body.contractEndDate),
        totalPrice: body.totalPrice || null,
        depositAmount: body.depositAmount || null,
        monthlyRent: body.monthlyRent || null,
        tenantName: body.tenantName || null,
        tenantPhone: body.tenantPhone || null,
        managerName: body.managerName || null,
        managerPhone: body.managerPhone || null,
        notes: body.notes || null,
        status: body.status || 'active',
      },
    });

    return c.json({ success: true, property });
  } catch (error) {
    console.error('Managed property create error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to create' }, 500);
  }
});

/**
 * PUT /api/managed-properties/:id
 * 관리 매물 수정
 */
app.put('/api/managed-properties/:id', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }
    const id = c.req.param('id');
    const body = await c.req.json();

    const updateData: any = {};
    const fields = [
      'articleName', 'buildingName', 'address', 'contractType', 'propertyType',
      'downPayment', 'interimPayment', 'finalPayment',
      'totalPrice', 'depositAmount', 'monthlyRent',
      'tenantName', 'tenantPhone', 'managerName', 'managerPhone',
      'notes', 'status', 'propertyId',
    ];

    for (const field of fields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }

    // 날짜 필드는 Date 변환
    const dateFields = [
      'downPaymentDate', 'interimPaymentDate', 'finalPaymentDate',
      'contractDate', 'contractEndDate',
    ];
    for (const field of dateFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field] ? new Date(body[field]) : null;
      }
    }

    const result = await prisma.managedProperty.updateMany({
      where: { id, userId },
      data: updateData,
    });
    if (result.count === 0) {
      return c.json({ error: '관리매물을 찾을 수 없습니다.' }, 404);
    }
    const property = await prisma.managedProperty.findFirst({ where: { id, userId } });

    return c.json({ success: true, property });
  } catch (error) {
    console.error('Managed property update error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to update' }, 500);
  }
});

/**
 * DELETE /api/managed-properties/:id
 * 관리 매물 삭제
 */
app.delete('/api/managed-properties/:id', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }
    const id = c.req.param('id');
    const result = await prisma.managedProperty.deleteMany({ where: { id, userId } });
    if (result.count === 0) {
      return c.json({ error: '관리매물을 찾을 수 없습니다.' }, 404);
    }
    return c.json({ success: true, message: 'Deleted' });
  } catch (error) {
    console.error('Managed property delete error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to delete' }, 500);
  }
});

// ============================================
// 대시보드 API
// ============================================

/**
 * GET /api/dashboard/summary
 * 대시보드 요약 (총 매물수, 관심매물수, 관리매물수)
 */
app.get('/api/dashboard/summary', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }

    const [totalProperties, favoriteCount, managedCount] = await Promise.all([
      prisma.property.count(),
      prisma.favoriteProperty.count({ where: { userId } }),
      prisma.managedProperty.count({ where: { userId } }),
    ]);

    return c.json({ totalProperties, favoriteCount, managedCount });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to fetch summary' }, 500);
  }
});

/**
 * GET /api/dashboard/recent-properties
 * 최근 N일 동안 등록한 매물 목록
 */
app.get('/api/dashboard/recent-properties', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }
    const days = parseInt(c.req.query('days') || '10');
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const properties = await prisma.property.findMany({
      where: {
        userId,
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        articleNo: true,
        articleName: true,
        realEstateTypeName: true,
        tradeTypeName: true,
        dealOrWarrantPrc: true,
        rentPrc: true,
        area1: true,
        createdAt: true,
      },
    });

    return c.json({ properties });
  } catch (error) {
    console.error('Recent properties error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to fetch recent properties' }, 500);
  }
});

/**
 * GET /api/dashboard/recent-favorites
 * 최근 N일 동안 등록한 관심 매물 목록
 */
app.get('/api/dashboard/recent-favorites', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }
    const days = parseInt(c.req.query('days') || '10');
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const favorites = await prisma.favoriteProperty.findMany({
      where: { userId, createdAt: { gte: startDate } },
      orderBy: { createdAt: 'desc' },
    });

    return c.json({ favorites });
  } catch (error) {
    console.error('Recent favorites error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to fetch recent favorites' }, 500);
  }
});

/**
 * GET /api/dashboard/recent-managed
 * 최근 N일 동안 등록한 관리 매물 목록
 */
app.get('/api/dashboard/recent-managed', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }
    const days = parseInt(c.req.query('days') || '10');
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const managed = await prisma.managedProperty.findMany({
      where: { userId, createdAt: { gte: startDate } },
      orderBy: { createdAt: 'desc' },
    });

    return c.json({ managed });
  } catch (error) {
    console.error('Recent managed properties error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to fetch recent managed' }, 500);
  }
});

/**
 * GET /api/dashboard/recent-contracts
 * 최근 N일 동안 계약한 계약 매물 목록
 */
app.get('/api/dashboard/recent-contracts', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }
    const days = parseInt(c.req.query('days') || '30');
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const contracts = await prisma.managedProperty.findMany({
      where: { userId, contractDate: { gte: startDate } },
      orderBy: { contractDate: 'desc' },
    });

    return c.json({ contracts });
  } catch (error) {
    console.error('Recent contracts error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to fetch recent contracts' }, 500);
  }
});

// ============================================
// 일정(Schedule) API
// ============================================

/**
 * GET /api/schedules
 * 일정 목록 조회
 * Query: startDate, endDate (필터링)
 */
app.get('/api/schedules', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');

    const whereClause: any = { userId };
    if (startDate && endDate) {
      whereClause.startTime = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const schedules = await prisma.schedule.findMany({
      where: whereClause,
      orderBy: { startTime: 'asc' },
    });

    return c.json({ schedules });
  } catch (error) {
    console.error('Schedules fetch error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to fetch schedules' }, 500);
  }
});

/**
 * GET /api/schedules/today
 * 오늘의 일정 조회
 */
app.get('/api/schedules/today', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }

    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const schedules = await prisma.schedule.findMany({
      where: {
        userId,
        startTime: { gte: startOfDay, lte: endOfDay }
      },
      orderBy: { startTime: 'asc' },
    });

    return c.json({ schedules });
  } catch (error) {
    console.error('Today schedules error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to fetch today schedules' }, 500);
  }
});

/**
 * POST /api/schedules
 * 일정 생성
 */
app.post('/api/schedules', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }
    const body = await c.req.json();

    const schedule = await prisma.schedule.create({
      data: {
        userId,
        title: body.title,
        description: body.description,
        startTime: new Date(body.startTime),
        endTime: body.endTime ? new Date(body.endTime) : null,
        type: body.type || 'default',
        location: body.location,
        isAllDay: body.isAllDay || false,
        reminderMinutes: body.reminderMinutes,
      },
    });

    return c.json({ schedule });
  } catch (error) {
    console.error('Schedule create error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to create schedule' }, 500);
  }
});

/**
 * PUT /api/schedules/:id
 * 일정 수정
 */
app.put('/api/schedules/:id', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }
    const id = c.req.param('id');
    const body = await c.req.json();

    const existing = await prisma.schedule.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!existing) {
      return c.json({ error: '일정을 찾을 수 없습니다.' }, 404);
    }

    const schedule = await prisma.schedule.update({
      where: { id: existing.id },
      data: {
        title: body.title,
        description: body.description,
        startTime: body.startTime ? new Date(body.startTime) : undefined,
        endTime: body.endTime !== undefined ? (body.endTime ? new Date(body.endTime) : null) : undefined,
        type: body.type,
        location: body.location,
        isAllDay: body.isAllDay,
        reminderMinutes: body.reminderMinutes,
      },
    });

    return c.json({ schedule });
  } catch (error) {
    console.error('Schedule update error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to update schedule' }, 500);
  }
});

/**
 * DELETE /api/schedules/:id
 * 일정 삭제
 */
app.delete('/api/schedules/:id', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }
    const id = c.req.param('id');
    const result = await prisma.schedule.deleteMany({
      where: { id, userId },
    });
    if (result.count === 0) {
      return c.json({ error: '일정을 찾을 수 없습니다.' }, 404);
    }
    return c.json({ success: true, message: 'Deleted' });
  } catch (error) {
    console.error('Schedule delete error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to delete schedule' }, 500);
  }
});

// ============================================
// 프로덕션: 정적 파일 서빙 (Vite 빌드 결과물)
// ============================================
// (existsSync, join은 위에서 이미 import됨)

const DIST_DIR = join(process.cwd(), 'dist');
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && existsSync(DIST_DIR)) {
  console.log(`[Static] Serving frontend from: ${DIST_DIR}`);

  // 정적 파일 서빙 (CSS, JS, 이미지 등)
  app.get('/assets/*', async (c) => {
    const filePath = join(DIST_DIR, c.req.path);
    if (existsSync(filePath)) {
      const content = readFileSync(filePath);
      const ext = filePath.split('.').pop() || '';
      const mimeTypes: Record<string, string> = {
        js: 'application/javascript',
        css: 'text/css',
        html: 'text/html',
        json: 'application/json',
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        svg: 'image/svg+xml',
        ico: 'image/x-icon',
        webp: 'image/webp',
        woff: 'font/woff',
        woff2: 'font/woff2',
        ttf: 'font/ttf',
      };
      return new Response(content, {
        headers: { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' },
      });
    }
    return c.notFound();
  });

  // SPA 폴백: API가 아닌 모든 경로는 index.html 반환
  app.get('*', async (c) => {
    if (c.req.path.startsWith('/api/')) {
      return c.notFound();
    }
    const indexPath = join(DIST_DIR, 'index.html');
    if (existsSync(indexPath)) {
      const html = readFileSync(indexPath, 'utf-8');
      return c.html(html);
    }
    return c.text('index.html not found', 404);
  });
}

// Bun 서버용 내보내기
const PORT = parseInt(process.env.PORT || '3001');
export default {
  port: PORT,
  hostname: '0.0.0.0',
  fetch: app.fetch,
  idleTimeout: 120,
};

console.log(`[Server] Running on port ${PORT} (${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'})`);
