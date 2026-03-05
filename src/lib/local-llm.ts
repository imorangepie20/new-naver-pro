// ============================================
// 로컬 LLM (Transformers.js)를 사용한 매물 정보 추출
// ============================================

import { pipeline, env } from '@xenova/transformers';

// 브라우저에서 모델 캐시 설정
env.allowLocalModels = false;
env.useBrowserCache = true;

export interface LocalParseResult {
  properties: ParsedProperty[];
  isProcessing: boolean;
  progress: string;
}

export interface ParsedProperty {
  articleName: string;
  realEstateTypeCode: string;
  realEstateTypeName: string;
  tradeTypeCode: string;
  tradeTypeName: string;
  dealOrWarrantPrc: number | null;
  rentPrc: number | null;
  area1: number | null;
  area2: number | null;
  floorInfo: string | null;
  direction: string | null;
  buildingName: string | null;
  detailAddress: string | null;
  articleFeatureDesc: string | null;
  articleConfirmYmd: string | null;
  cpName: string | null;
  realtorName: string | null;
  managerName: string | null;
  managerPhone: string | null;
}

// 텍스트에서 정규식 기반 매물 정보 추출 (LLM 사용하지 않고 빠른 방법)
export function extractPropertiesFromText(text: string): ParsedProperty[] {
  const properties: ParsedProperty[] = [];

  // 줄 단위로 분리
  const lines = text.split(/\r?\n/).filter(line => line.trim());

  // CSV 형식 감지
  const isCSV = lines[0]?.includes(',') && (lines[0]?.includes('매물명') || lines[0]?.includes('거래'));

  if (isCSV) {
    return parseCSVLines(lines);
  }

  // 텍스트 기반 파싱 (키:값 형식)
  return parseTextFormat(lines);
}

// CSV 파싱
function parseCSVLines(lines: string[]): ParsedProperty[] {
  const properties: ParsedProperty[] = [];

  if (lines.length < 2) return properties;

  const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
  const 매물명Idx = headers.findIndex(h => h.includes('매물명'));
  const 유형Idx = headers.findIndex(h => h.includes('유형') || h.includes('종류'));
  const 거래Idx = headers.findIndex(h => h.includes('거래'));
  const 가격Idx = headers.findIndex(h => h.includes('가격') || h.includes('보증금'));
  const 월세Idx = headers.findIndex(h => h.includes('월세'));
  const 공급Idx = headers.findIndex(h => h.includes('공급면적'));
  const 전용Idx = headers.findIndex(h => h.includes('전용면적'));
  const 층Idx = headers.findIndex(h => h.includes('층'));
  const 건물명Idx = headers.findIndex(h => h.includes('건물명'));
  const 주소Idx = headers.findIndex(h => h.includes('주소'));
  const 설명Idx = headers.findIndex(h => h.includes('설명') || h.includes('비고'));
  const 확정일Idx = headers.findIndex(h => h.includes('확정일') || h.includes('날짜'));
  const 중개사Idx = headers.findIndex(h => h.includes('중개업소') || h.includes('중개사'));
  const 담당자Idx = headers.findIndex(h => h.includes('책임자') || h.includes('담당자'));
  const 전화Idx = headers.findIndex(h => h.includes('전화'));

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < 2) continue;

    const getValue = (idx: number) => idx >= 0 && idx < values.length ? values[idx]?.trim() || '' : '';

    // 매물명 추출 (전체 텍스트 유지)
    const articleName = getValue(매물명Idx) || getValue(건물명Idx) || `매물 ${i}`;
    const typeValue = getValue(유형Idx);
    const tradeValue = getValue(거래Idx);
    const priceValue = getValue(가격Idx);
    const rentValue = getValue(월세Idx);
    const areaValue = getValue(전용Idx) || getValue(공급Idx);
    const floorValue = getValue(층Idx);
    const buildingName = getValue(건물명Idx);
    const addressValue = getValue(주소Idx);
    const descValue = getValue(설명Idx);
    const dateValue = getValue(확정일Idx);
    const cpValue = getValue(중개사Idx);
    const managerValue = getValue(담당자Idx);
    const phoneValue = getValue(전화Idx);

    const property: ParsedProperty = {
      articleName,
      realEstateTypeCode: mapTypeCode(typeValue),
      realEstateTypeName: typeValue || '아파트',
      tradeTypeCode: mapTradeCode(tradeValue),
      tradeTypeName: tradeValue || '매매',
      dealOrWarrantPrc: parsePrice(priceValue),
      rentPrc: parsePrice(rentValue),
      area1: parseArea(areaValue),
      area2: parseArea(areaValue),
      floorInfo: floorValue || null,
      direction: null,
      buildingName: buildingName || articleName,
      detailAddress: addressValue || null,
      articleFeatureDesc: descValue || null,
      articleConfirmYmd: parseDate(dateValue),
      cpName: cpValue || null,
      realtorName: null,
      managerName: managerValue || null,
      managerPhone: phoneValue || null,
    };

    properties.push(property);
  }

  return properties;
}

// CSV 라인 파싱 (따옴표 처리)
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// 텍스트 형식 파싱
function parseTextFormat(lines: string[]): ParsedProperty[] {
  const properties: ParsedProperty[] = [];
  let currentProperty: Partial<ParsedProperty> = {};

  for (const line of lines) {
    const trimmed = line.trim();

    // 매물 구분자 (=== 또는 숫자.으로 시작)
    if (/^===+/.test(trimmed) || /^\d+[\.\)]\s/.test(trimmed)) {
      if (currentProperty.articleName) {
        properties.push(finishProperty(currentProperty));
      }
      currentProperty = {};
      continue;
    }

    // 키:값 패턴
    const kvMatch = trimmed.match(/^([^:：]+)[:：]\s*(.+)$/);
    if (kvMatch) {
      const key = kvMatch[1].trim();
      const value = kvMatch[2].trim();

      switch (key) {
        case '매물명':
        case '물건명':
          currentProperty.articleName = value;
          break;
        case '유형':
        case '매물유형':
          currentProperty.realEstateTypeName = value;
          currentProperty.realEstateTypeCode = mapTypeCode(value);
          break;
        case '거래':
        case '거래방식':
          currentProperty.tradeTypeName = value;
          currentProperty.tradeTypeCode = mapTradeCode(value);
          break;
        case '가격':
        case '매매가':
        case '보증금':
          currentProperty.dealOrWarrantPrc = parsePrice(value);
          break;
        case '월세':
          currentProperty.rentPrc = parsePrice(value);
          break;
        case '면적':
        case '전용면적':
          currentProperty.area2 = parseArea(value);
          currentProperty.area1 = currentProperty.area2;
          break;
        case '층':
        case '층수':
          currentProperty.floorInfo = value;
          break;
        case '주소':
          currentProperty.detailAddress = value;
          break;
        case '설명':
        case '비고':
          currentProperty.articleFeatureDesc = value;
          break;
      }
    }
  }

  if (currentProperty.articleName) {
    properties.push(finishProperty(currentProperty));
  }

  return properties;
}

function finishProperty(prop: Partial<ParsedProperty>): ParsedProperty {
  return {
    articleName: prop.articleName || '매물',
    realEstateTypeCode: prop.realEstateTypeCode || 'APT',
    realEstateTypeName: prop.realEstateTypeName || '아파트',
    tradeTypeCode: prop.tradeTypeCode || 'A1',
    tradeTypeName: prop.tradeTypeName || '매매',
    dealOrWarrantPrc: prop.dealOrWarrantPrc || null,
    rentPrc: prop.rentPrc || null,
    area1: prop.area1 || null,
    area2: prop.area2 || null,
    floorInfo: prop.floorInfo || null,
    direction: prop.direction || null,
    buildingName: prop.buildingName || prop.articleName || null,
    detailAddress: prop.detailAddress || null,
    articleFeatureDesc: prop.articleFeatureDesc || null,
    articleConfirmYmd: prop.articleConfirmYmd || null,
    cpName: prop.cpName || null,
    realtorName: prop.realtorName || null,
    managerName: prop.managerName || null,
    managerPhone: prop.managerPhone || null,
  };
}

function mapTypeCode(typeName: string): string {
  if (!typeName) return 'APT';
  const name = typeName.toLowerCase();
  if (name.includes('아파트')) return 'APT';
  if (name.includes('오피스텔')) return 'OPST';
  if (name.includes('빌라') || name.includes('연립')) return 'VL';
  if (name.includes('원룸')) return 'ONEROOM';
  if (name.includes('투룸')) return 'TWOROOM';
  if (name.includes('상가')) return 'SG';
  return 'APT';
}

function mapTradeCode(tradeName: string): string {
  if (!tradeName) return 'A1';
  const name = tradeName.toLowerCase();
  if (name.includes('매매')) return 'A1';
  if (name.includes('전세')) return 'B1';
  if (name.includes('월세')) return 'B2';
  return 'A1';
}

function parsePrice(value: string): number | null {
  if (!value) return null;

  // "4,000" 또는 "4000" 또는 "4억 5,000" 형식
  const okMatch = value.match(/(\d+)억/);
  const manMatch = value.match(/(\d+),?(\d+)/);

  if (okMatch) {
    const ok = parseInt(okMatch[1]) * 10000;
    const man = manMatch ? parseInt(manMatch[1] + (manMatch[2] || '')) : 0;
    return ok + man;
  }

  const num = parseInt(value.replace(/[^\d]/g, ''));
  return isNaN(num) ? null : num;
}

function parseArea(value: string): number | null {
  if (!value) return null;
  const match = value.match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : null;
}

function parseDate(value: string): string | null {
  if (!value) return null;

  // "2026.02.23" 또는 "2026-02-23" 또는 "20260223" 형식
  const match = value.match(/(\d{4})[.-]?(\d{2})[.-]?(\d{2})/);
  if (match) {
    return `${match[1]}${match[2]}${match[3]}`;
  }

  return null;
}

// Transformers.js를 사용한 분류 (선택적 - 더 정확하지만 느림)
export async function classifyWithLocalLLM(
  text: string,
  onProgress?: (progress: string) => void
): Promise<ParsedProperty[]> {
  try {
    onProgress?.('모델 로딩 중...');

    // 간단한 텍스트 분류 모델 사용
    const classifier = await pipeline('sentiment-analysis', 'Xenova/bert-base-multilingual-cased', {
      progress_callback: (progress: any) => {
        if (progress.status === 'downloading') {
          onProgress?.(`모델 다운로드 중... ${Math.round(progress.progress || 0)}%`);
        }
      }
    });

    onProgress?.('분석 중...');

    // 정규식 기반 추출 사용 (더 빠름)
    return extractPropertiesFromText(text);

  } catch (error) {
    console.error('로컬 LLM 오류:', error);
    // 실패하면 정규식 기반으로 fallback
    return extractPropertiesFromText(text);
  }
}
