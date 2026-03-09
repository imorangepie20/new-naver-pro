import { loadProjectEnv } from '../env/load-project-env';

loadProjectEnv();

export type MolitCategory =
  | 'apt-sale'
  | 'offi-sale'
  | 'indvdland-sale'
  | 'bldg-sale'
  | 'land-sale'
  | 'apt-rent'
  | 'offi-rent'
  | 'indvdland-rent'
  | 'bldg-rent'
  | 'land-rent'
  | 'sh-rent';

interface MolitCategoryConfig {
  endpoint: string;
  propertyTypeName: string;
  tradeMode: 'sale' | 'rent';
}

const MOLIT_CATEGORY_CONFIG: Record<MolitCategory, MolitCategoryConfig> = {
  'apt-sale': {
    endpoint: 'RTMSDataSvcAptTrade',
    propertyTypeName: '아파트',
    tradeMode: 'sale',
  },
  'offi-sale': {
    endpoint: 'RTMSDataSvcOffiTrade',
    propertyTypeName: '오피스텔',
    tradeMode: 'sale',
  },
  'indvdland-sale': {
    endpoint: 'RTMSDataSvcIndvdLandTrade',
    propertyTypeName: '공장/창고',
    tradeMode: 'sale',
  },
  'bldg-sale': {
    endpoint: 'RTMSDataSvcBldgTrade',
    propertyTypeName: '상업업무용',
    tradeMode: 'sale',
  },
  'land-sale': {
    endpoint: 'RTMSDataSvcLandTrade',
    propertyTypeName: '토지',
    tradeMode: 'sale',
  },
  'apt-rent': {
    endpoint: 'RTMSDataSvcAptRent',
    propertyTypeName: '아파트',
    tradeMode: 'rent',
  },
  'offi-rent': {
    endpoint: 'RTMSDataSvcOffiRent',
    propertyTypeName: '오피스텔',
    tradeMode: 'rent',
  },
  'indvdland-rent': {
    endpoint: 'RTMSDataSvcIndvdLandRent',
    propertyTypeName: '공장/창고',
    tradeMode: 'rent',
  },
  'bldg-rent': {
    endpoint: 'RTMSDataSvcBldgRent',
    propertyTypeName: '상업업무용',
    tradeMode: 'rent',
  },
  'land-rent': {
    endpoint: 'RTMSDataSvcLandRent',
    propertyTypeName: '토지',
    tradeMode: 'rent',
  },
  'sh-rent': {
    endpoint: 'RTMSDataSvcSHRent',
    propertyTypeName: '단독/다가구',
    tradeMode: 'rent',
  },
};

const MOLIT_BASE_URL = 'https://apis.data.go.kr/1613000';

const MOLIT_KEY_ENV_CANDIDATES = [
  'MOLIT_SERVICE_KEY',
  'MOLIT_API_KEY',
  'MOLIT_OPEN_API_KEY',
  'RTMS_SERVICE_KEY',
  'PUBLIC_DATA_SERVICE_KEY',
  'PUBLIC_DATA_API_KEY',
  'SERVICE_KEY',
  'VITE_MOLIT_SERVICE_KEY',
  'VITE_PUBLIC_DATA_SERVICE_KEY',
  'VITE_SERVICE_KEY',
] as const;

export interface MolitFetchParams {
  lawdCd: string;
  dealYm: string;
  category: MolitCategory;
  pageNo?: number;
  numOfRows?: number;
}

export interface MolitFetchResult {
  category: MolitCategory;
  endpoint: string;
  propertyTypeName: string;
  tradeMode: 'sale' | 'rent';
  rows: Record<string, unknown>[];
  totalCount: number | null;
  resultCode: string | null;
  resultMessage: string | null;
  request: {
    lawdCd: string;
    dealYm: string;
    pageNo: number;
    numOfRows: number;
  };
  raw: unknown;
}

export interface MolitCategoryFetchOptions {
  lawdCd: string;
  dealYm: string;
  category: MolitCategory;
  maxPages?: number;
  numOfRows?: number;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(numeric) ? numeric : null;
}

function toRows(value: unknown): Record<string, unknown>[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => asRecord(item))
      .filter((item): item is Record<string, unknown> => item !== null);
  }
  const row = asRecord(value);
  return row ? [row] : [];
}

function getMolitApiKeyWithSource(): { key: string | null; source: string | null } {
  for (const envName of MOLIT_KEY_ENV_CANDIDATES) {
    const value = process.env[envName];
    if (value && value.trim()) {
      return { key: value.trim(), source: envName };
    }
  }
  return { key: null, source: null };
}

function getMolitApiKeyOrThrow() {
  const { key } = getMolitApiKeyWithSource();
  if (!key) {
    // 사용자 응답에는 키/환경변수 상세를 노출하지 않는다.
    throw new Error('Public data source is not available');
  }
  return key;
}

function buildKeyCandidates(rawKey: string) {
  const candidates: string[] = [rawKey];

  if (rawKey.includes('%')) {
    try {
      const decoded = decodeURIComponent(rawKey);
      if (decoded && decoded !== rawKey) {
        candidates.push(decoded);
      }
    } catch {
      // Keep raw key only.
    }
  }

  return Array.from(new Set(candidates));
}

function decodeHtmlEntities(input: string) {
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractHtmlErrorSummary(html: string) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1]).replace(/\s+/g, ' ').trim() : '';

  const withoutScript = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const plain = decodeHtmlEntities(withoutScript.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();

  const snippets = plain
    .split(/(?<=[.?!])\s+|(?<=다\.)\s+/)
    .filter((line) => /(인증키|권한|허용|제한|오류|실패|IP|접근|유효|관리자|신청)/i.test(line))
    .slice(0, 3);

  return [title, ...snippets].filter(Boolean).join(' | ').slice(0, 320);
}

function extractXmlResultCode(xml: string): string | null {
  const codeMatch = xml.match(/<resultCode>([^<]+)<\/resultCode>/i);
  return codeMatch ? codeMatch[1].trim() : null;
}

function extractXmlResultMessage(xml: string): string | null {
  const msgMatch = xml.match(/<resultMsg>([^<]+)<\/resultMsg>/i);
  return msgMatch ? msgMatch[1].trim() : null;
}

function extractXmlTotalCount(xml: string): number | null {
  const totalMatch = xml.match(/<totalCount>([^<]+)<\/totalCount>/i);
  if (!totalMatch) return null;
  return toNumberOrNull(totalMatch[1]);
}

function extractXmlRows(xml: string): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let itemMatch: RegExpExecArray | null = itemRegex.exec(xml);

  while (itemMatch) {
    const row: Record<string, unknown> = {};
    const fieldRegex = /<([^\/>\s]+)>([\s\S]*?)<\/\1>/g;
    let fieldMatch: RegExpExecArray | null = fieldRegex.exec(itemMatch[1]);
    while (fieldMatch) {
      const key = fieldMatch[1].trim();
      const value = decodeHtmlEntities(fieldMatch[2]).replace(/\s+/g, ' ').trim();
      row[key] = value;
      fieldMatch = fieldRegex.exec(itemMatch[1]);
    }

    if (Object.keys(row).length > 0) {
      rows.push(row);
    }

    itemMatch = itemRegex.exec(xml);
  }

  return rows;
}

function clampPage(value: number | undefined) {
  if (!value || Number.isNaN(value)) return 1;
  return Math.max(1, Math.floor(value));
}

function clampRows(value: number | undefined) {
  if (!value || Number.isNaN(value)) return 1000;
  return Math.min(1000, Math.max(1, Math.floor(value)));
}

function buildEndpointPathCandidates(endpoint: string) {
  const normalized = endpoint.trim();
  if (!normalized) return [];

  const endpointBases = [normalized];
  if (!normalized.endsWith('Dev')) {
    endpointBases.push(`${normalized}Dev`);
  }

  const candidates: string[] = [];
  for (const base of endpointBases) {
    const methodName = base.startsWith('get') ? base : `get${base}`;
    candidates.push(base, `${base}/${methodName}`);
  }

  return Array.from(new Set([
    ...candidates,
  ]));
}

function isMolitSuccessResultCode(resultCode: string | null) {
  if (resultCode === null) return true;
  const trimmed = resultCode.trim();
  if (!trimmed) return true;
  if (trimmed === '0' || trimmed === '00' || trimmed === '000') return true;

  // Some responses pad success codes with leading zeros.
  const normalized = trimmed.replace(/^0+/, '');
  return normalized === '' || normalized === '0';
}

export function getMolitApiConfigStatus() {
  const { key, source } = getMolitApiKeyWithSource();
  return {
    configured: !!key,
    keySource: source,
    baseUrl: MOLIT_BASE_URL,
    categories: Object.keys(MOLIT_CATEGORY_CONFIG),
  };
}

export async function fetchMolitRows(params: MolitFetchParams): Promise<MolitFetchResult> {
  const lawdCd = params.lawdCd.trim();
  const dealYm = params.dealYm.trim();
  const pageNo = clampPage(params.pageNo);
  const numOfRows = clampRows(params.numOfRows);
  const categoryConfig = MOLIT_CATEGORY_CONFIG[params.category];

  if (!/^\d{5}$/.test(lawdCd)) {
    throw new Error(`Invalid lawdCd: ${lawdCd}`);
  }
  if (!/^\d{6}$/.test(dealYm)) {
    throw new Error(`Invalid dealYm: ${dealYm}`);
  }

  const rawKey = getMolitApiKeyOrThrow();
  const keyCandidates = buildKeyCandidates(rawKey);
  const endpointCandidates = buildEndpointPathCandidates(categoryConfig.endpoint);

  let lastError: Error | null = null;

  for (const keyCandidate of keyCandidates) {
    for (const endpointPath of endpointCandidates) {
      const searchParams = new URLSearchParams({
        serviceKey: keyCandidate,
        LAWD_CD: lawdCd,
        // 최신 명세(Dev) 호환
        DEAL_YMD: dealYm,
        // 레거시 명세 호환
        DEAL_Y_M: dealYm,
        pageNo: String(pageNo),
        numOfRows: String(numOfRows),
        _type: 'json',
      });

      const requestUrl = `${MOLIT_BASE_URL}/${endpointPath}?${searchParams.toString()}`;

      try {
        const response = await fetch(requestUrl, {
          headers: {
            // 일부 공공데이터 게이트웨이는 기본 런타임 UA를 차단한다.
            'User-Agent': 'Mozilla/5.0 (compatible; ImApplePieBot/1.0; +https://imapplepie20.tplinkdns.com)',
            'Accept': 'application/json, application/xml;q=0.9, */*;q=0.8',
          },
        });
        const contentType = (response.headers.get('content-type') || '').toLowerCase();
        const text = await response.text();

        if (!response.ok) {
          const compact = text.replace(/\s+/g, ' ').slice(0, 300);
          throw new Error(`MOLIT API HTTP ${response.status}: ${compact}`);
        }

        if (contentType.includes('application/json') || text.trim().startsWith('{')) {
          const payload = JSON.parse(text) as Record<string, unknown>;
          const responseObj = asRecord(payload.response) ?? payload;
          const header = asRecord(responseObj.header);
          const body = asRecord(responseObj.body);
          const items = asRecord(body?.items);

          const rows = toRows(items?.item);
          const totalCount = toNumberOrNull(body?.totalCount);
          const resultCode = typeof header?.resultCode === 'string' ? header.resultCode : null;
          const resultMessage = typeof header?.resultMsg === 'string' ? header.resultMsg : null;

          if (!isMolitSuccessResultCode(resultCode)) {
            throw new Error(`MOLIT API error (${resultCode}): ${resultMessage || 'unknown error'}`);
          }

          return {
            category: params.category,
            endpoint: categoryConfig.endpoint,
            propertyTypeName: categoryConfig.propertyTypeName,
            tradeMode: categoryConfig.tradeMode,
            rows,
            totalCount,
            resultCode,
            resultMessage,
            request: { lawdCd, dealYm, pageNo, numOfRows },
            raw: payload,
          };
        }

        const resultCode = extractXmlResultCode(text);
        const resultMessage = extractXmlResultMessage(text);
        const totalCount = extractXmlTotalCount(text);

        if (!isMolitSuccessResultCode(resultCode)) {
          throw new Error(`MOLIT API error (${resultCode}): ${resultMessage || 'unknown error'}`);
        }

        const htmlSummary = extractHtmlErrorSummary(text);
        if (htmlSummary) {
          throw new Error(`MOLIT API returned non-JSON payload: ${htmlSummary}`);
        }

        return {
          category: params.category,
          endpoint: categoryConfig.endpoint,
          propertyTypeName: categoryConfig.propertyTypeName,
          tradeMode: categoryConfig.tradeMode,
          rows: extractXmlRows(text),
          totalCount,
          resultCode,
          resultMessage,
          request: { lawdCd, dealYm, pageNo, numOfRows },
          raw: text,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown MOLIT API request error');
      }
    }
  }

  throw lastError || new Error('MOLIT API request failed');
}

export async function fetchMolitCategoryRows(options: MolitCategoryFetchOptions) {
  const maxPages = Number.isFinite(options.maxPages)
    ? Math.min(10, Math.max(1, Math.floor(options.maxPages || 1)))
    : 1;
  const numOfRows = clampRows(options.numOfRows);

  const rows: Record<string, unknown>[] = [];
  let firstResultCode: string | null = null;
  let firstResultMessage: string | null = null;
  let totalCount: number | null = null;

  for (let pageNo = 1; pageNo <= maxPages; pageNo += 1) {
    const pageResult = await fetchMolitRows({
      lawdCd: options.lawdCd,
      dealYm: options.dealYm,
      category: options.category,
      pageNo,
      numOfRows,
    });

    if (firstResultCode === null) firstResultCode = pageResult.resultCode;
    if (firstResultMessage === null) firstResultMessage = pageResult.resultMessage;
    if (totalCount === null) totalCount = pageResult.totalCount;

    rows.push(...pageResult.rows);

    const pageCount = pageResult.rows.length;
    if (pageCount < numOfRows) break;
    if (totalCount !== null && rows.length >= totalCount) break;
  }

  const config = MOLIT_CATEGORY_CONFIG[options.category];

  return {
    category: options.category,
    endpoint: config.endpoint,
    propertyTypeName: config.propertyTypeName,
    tradeMode: config.tradeMode,
    rows,
    totalCount,
    resultCode: firstResultCode,
    resultMessage: firstResultMessage,
  };
}
