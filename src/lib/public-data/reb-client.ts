// ============================================
// 한국부동산원(REB) OpenAPI Client
// 문서 기준 엔드포인트:
// - /SttsApiTbl(.do)
// - /SttsApiTblItm(.do)
// - /SttsApiTblData(.do)
// ============================================

import { loadProjectEnv } from '../env/load-project-env';

loadProjectEnv();

export type RebResponseType = 'json' | 'xml';

export interface RebListOptions {
  page?: number;
  size?: number;
  type?: RebResponseType;
}

export interface RebTableListParams extends RebListOptions {
  statblId?: string;
}

export interface RebTableItemParams extends RebListOptions {
  statblId: string;
  itmTag?: string;
}

export interface RebTableDataParams extends RebListOptions {
  statblId: string;
  dtacycleCd?: string;
  wrttimeIdtfrId?: string;
  itmId?: string;
  itmTag?: string;
  clsId?: string;
  filters?: Record<string, string | number | undefined>;
}

export interface RebNormalizedResult<T = Record<string, unknown>> {
  rows: T[];
  resultCode: string | null;
  resultMessage: string | null;
  arrayField: string | null;
  listTotalCount: number | null;
  serviceName: string | null;
  head: Record<string, unknown> | null;
  raw: unknown;
}

function getStringField(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

function isErrorCode(code: string | null | undefined) {
  return typeof code === 'string' && /^ERROR/i.test(code);
}

function isMissingRequiredParamError(result: RebNormalizedResult) {
  const code = (result.resultCode || '').toUpperCase();
  const message = result.resultMessage || '';
  return /ERROR[-_]?300/.test(code) || /필수 값이 누락|required/i.test(message);
}

function isNoDataResult(result: RebNormalizedResult) {
  const code = (result.resultCode || '').toUpperCase();
  const message = result.resultMessage || '';
  return /INFO[-_]?200/.test(code) || /해당하는 데이터가 없습니다|no data/i.test(message);
}

function pickDtacycleCdFromTableRows(rows: Record<string, unknown>[]) {
  const preferredOrder = ['MM', 'WK', 'QY', 'QQ', 'YY', 'DD'];

  for (const row of rows) {
    const value = getStringField(row, ['DTACYCLE_CD', 'dtacycle_cd']);
    if (!value) continue;

    const candidates = value
      .split(/[,\s|/]+/)
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);

    if (candidates.length === 0) continue;

    const preferred = preferredOrder.find((code) => candidates.includes(code));
    if (preferred) return preferred;

    return candidates[0];
  }
  return null;
}

interface RebItemCandidate {
  itmId: string;
  itmTag: string | null;
}

function pickItemCandidates(rows: Record<string, unknown>[]): RebItemCandidate[] {
  const ordered: RebItemCandidate[] = [];
  const parentIds = new Set<string>();
  const keySet = new Set<string>();

  for (const row of rows) {
    const itemId = getStringField(row, ['ITM_ID', 'itm_id', 'ITMID']);
    const itmTag = getStringField(row, ['ITM_TAG', 'itm_tag']);

    if (itemId) {
      const dedupeKey = `${itemId}|${itmTag ?? ''}`;
      if (!keySet.has(dedupeKey)) {
        ordered.push({ itmId: itemId, itmTag });
        keySet.add(dedupeKey);
      }
    }

    const parentId = getStringField(row, ['PAR_ITM_ID', 'par_itm_id', 'PARENT_ITM_ID']);
    if (parentId) parentIds.add(parentId);
  }

  if (ordered.length === 0) return [];

  const leaves = ordered.filter((item) => !parentIds.has(item.itmId));
  const nonLeaves = ordered.filter((item) => parentIds.has(item.itmId));
  return [...leaves, ...nonLeaves];
}

const REB_BASE_URL_CANDIDATES = [
  process.env.REB_BASE_URL,
  process.env.REB_OPEN_API_BASE_URL,
  process.env.R_ONE_OPEN_API_BASE_URL,
  'https://www.reb.or.kr/r-one/openapi',
  'https://reb.or.kr/r-one/openapi',
].filter((value): value is string => !!value && value.trim().length > 0)
  .map((value) => value.trim())
  .filter((value, index, list) => list.indexOf(value) === index);

const REB_KEY_ENV_CANDIDATES = [
  'REB_OPEN_API_KEY',
  'REB_OPENAPI_KEY',
  'REB_OPEN_API_AUTH_KEY',
  'REB_OPENAPI_AUTH_KEY',
  'REB_API_KEY',
  'REB_KEY',
  'REB_SERVICE_KEY',
  'R_ONE_OPEN_API_KEY',
  'RONE_OPEN_API_KEY',
  'PUBLIC_DATA_REB_KEY',
  'PUBLIC_DATA_API_KEY',
  'OPEN_API_KEY',
  'OPENAPI_KEY',
  'OPEN_API_AUTH_KEY',
  'OPENAPI_AUTH_KEY',
  'SERVICE_KEY',
  'VITE_REB_OPEN_API_KEY',
  'VITE_REB_OPENAPI_KEY',
  'VITE_REB_API_KEY',
  'VITE_OPEN_API_KEY',
  'VITE_OPENAPI_KEY',
  'VITE_SERVICE_KEY',
  'VITE_PUBLIC_DATA_API_KEY',
] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function extractResultObject(value: unknown): Record<string, unknown> | null {
  const direct = asRecord(value);
  if (direct) return direct;
  if (!Array.isArray(value)) return null;

  for (const item of value) {
    const obj = asRecord(item);
    if (obj) return obj;
  }

  return null;
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getRebApiKeyWithSource(): { key: string | null; source: string | null } {
  for (const envName of REB_KEY_ENV_CANDIDATES) {
    const value = process.env[envName];
    if (value && value.trim()) {
      return { key: value.trim(), source: envName };
    }
  }
  return { key: null, source: null };
}

export function getRebApiConfigStatus() {
  const { key, source } = getRebApiKeyWithSource();
  return {
    configured: !!key,
    keySource: source,
    baseUrl: REB_BASE_URL_CANDIDATES[0] ?? null,
    baseUrlCandidates: REB_BASE_URL_CANDIDATES,
  };
}

function getRebApiKeyOrThrow() {
  const { key } = getRebApiKeyWithSource();
  if (!key) {
    throw new Error(
      `REB API key is not configured. Set one of: ${REB_KEY_ENV_CANDIDATES.join(', ')}`
    );
  }
  return key;
}

function buildKeyCandidates(rawKey: string) {
  const candidates: string[] = [rawKey];

  // 공공데이터 키는 URL 인코딩된 값으로 발급되는 경우가 있어 이중 인코딩을 방지한다.
  if (rawKey.includes('%')) {
    try {
      const decoded = decodeURIComponent(rawKey);
      if (decoded && decoded !== rawKey) {
        candidates.push(decoded);
      }
    } catch {
      // keep raw key only
    }
  }

  return candidates;
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

  // script/style 제거 후 텍스트만 추출
  const withoutScript = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const plain = decodeHtmlEntities(withoutScript.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();

  const snippets = plain
    .split(/(?<=[.?!])\s+|(?<=다\.)\s+/)
    .filter((line) =>
      /(인증키|권한|허용|제한|오류|실패|IP|접근|유효|관리자|신청)/i.test(line)
    )
    .slice(0, 3);

  const combined = [title, ...snippets].filter(Boolean).join(' | ');
  return combined.slice(0, 320);
}

function buildEndpointCandidates(endpoint: string) {
  const normalized = endpoint.trim();
  if (!normalized) return [];
  if (normalized.toLowerCase().endsWith('.do')) return [normalized];
  return [normalized, `${normalized}.do`];
}

function describeFetchError(error: unknown) {
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: unknown }).cause;
    if (cause && typeof cause === 'object') {
      const c = cause as { code?: string; errno?: string; message?: string };
      const details = [c.code, c.errno, c.message].filter(Boolean).join(' / ');
      if (details) return `${error.message} (${details})`;
    }
    return error.message;
  }
  return String(error);
}

function maskSecret(secret: string) {
  if (secret.length <= 8) return '****';
  return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
}

function sanitizeUrlForLogs(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    const keyValue = parsed.searchParams.get('Key');
    if (keyValue) {
      parsed.searchParams.set('Key', maskSecret(keyValue));
    }
    return parsed.toString();
  } catch {
    return rawUrl.replace(/(Key=)([^&]+)/i, (_, prefix) => `${prefix}****`);
  }
}

function clampPage(value: number | undefined) {
  if (!value || Number.isNaN(value)) return 1;
  return Math.max(1, Math.floor(value));
}

function clampSize(value: number | undefined) {
  if (!value || Number.isNaN(value)) return 100;
  return Math.min(1000, Math.max(1, Math.floor(value)));
}

function extractHeadInfo(headValue: unknown) {
  const heads: Record<string, unknown>[] = [];

  if (Array.isArray(headValue)) {
    for (const entry of headValue) {
      const obj = asRecord(entry);
      if (obj) heads.push(obj);
    }
  } else {
    const obj = asRecord(headValue);
    if (obj) heads.push(obj);
  }

  let mergedHead: Record<string, unknown> | null = heads.length > 0 ? {} : null;
  let resultCode: string | null = null;
  let resultMessage: string | null = null;
  let listTotalCount: number | null = null;

  for (const head of heads) {
    if (mergedHead) {
      mergedHead = { ...mergedHead, ...head };
    }

    if (listTotalCount === null && head.list_total_count !== undefined) {
      listTotalCount = toNumberOrNull(head.list_total_count);
    }

    const resultObj = extractResultObject(head.RESULT) ?? extractResultObject(head.result);
    if (resultObj) {
      resultCode =
        (typeof resultObj.CODE === 'string' ? resultObj.CODE : null) ??
        (typeof resultObj.code === 'string' ? resultObj.code : null) ??
        resultCode;
      resultMessage =
        (typeof resultObj.MESSAGE === 'string' ? resultObj.MESSAGE : null) ??
        (typeof resultObj.message === 'string' ? resultObj.message : null) ??
        resultMessage;
    }
  }

  return {
    head: mergedHead,
    resultCode,
    resultMessage,
    listTotalCount,
  };
}

function extractServiceRows(
  root: Record<string, unknown>
): Omit<RebNormalizedResult, 'raw'> | null {
  for (const [serviceName, serviceValue] of Object.entries(root)) {
    if (serviceName.toUpperCase() === 'RESULT') continue;

    if (Array.isArray(serviceValue)) {
      let headValue: unknown = null;
      let rowValue: unknown = null;

      for (const chunk of serviceValue) {
        const chunkObj = asRecord(chunk);
        if (!chunkObj) continue;
        if (chunkObj.head !== undefined) headValue = chunkObj.head;
        if (chunkObj.row !== undefined) rowValue = chunkObj.row;
      }

      if (Array.isArray(rowValue)) {
        const headInfo = extractHeadInfo(headValue);
        return {
          rows: rowValue as Record<string, unknown>[],
          arrayField: `${serviceName}.row`,
          serviceName,
          resultCode: headInfo.resultCode,
          resultMessage: headInfo.resultMessage,
          listTotalCount: headInfo.listTotalCount,
          head: headInfo.head,
        };
      }
    }

    const serviceObj = asRecord(serviceValue);
    if (serviceObj && Array.isArray(serviceObj.row)) {
      const headInfo = extractHeadInfo(serviceObj.head);
      return {
        rows: serviceObj.row as Record<string, unknown>[],
        arrayField: `${serviceName}.row`,
        serviceName,
        resultCode: headInfo.resultCode,
        resultMessage: headInfo.resultMessage,
        listTotalCount: headInfo.listTotalCount,
        head: headInfo.head,
      };
    }
  }

  return null;
}

function findFirstArray(
  value: unknown,
  path = '',
  depth = 0
): { fieldPath: string; rows: Record<string, unknown>[] } | null {
  if (depth > 4 || value === null || value === undefined) return null;

  if (Array.isArray(value)) {
    return {
      fieldPath: path || 'root',
      rows: value as Record<string, unknown>[],
    };
  }

  const obj = asRecord(value);
  if (!obj) return null;

  for (const [k, v] of Object.entries(obj)) {
    if (k.toUpperCase() === 'RESULT') continue;
    const nextPath = path ? `${path}.${k}` : k;
    const found = findFirstArray(v, nextPath, depth + 1);
    if (found) return found;
  }

  return null;
}

function normalizeRebResponse(raw: unknown): RebNormalizedResult {
  const root = asRecord(raw) ?? {};

  const serviceRows = extractServiceRows(root);
  if (serviceRows) {
    return {
      ...serviceRows,
      raw,
    };
  }

  const rootResult = extractResultObject(root.RESULT) ?? extractResultObject(root.result);
  const foundArray = findFirstArray(root);

  return {
    rows: foundArray?.rows ?? [],
    arrayField: foundArray?.fieldPath ?? null,
    serviceName: foundArray?.fieldPath?.split('.')[0] ?? null,
    resultCode:
      (typeof rootResult?.CODE === 'string' ? rootResult.CODE : null) ??
      (typeof rootResult?.code === 'string' ? rootResult.code : null) ??
      (typeof root.code === 'string' ? root.code : null),
    resultMessage:
      (typeof rootResult?.MESSAGE === 'string' ? rootResult.MESSAGE : null) ??
      (typeof rootResult?.message === 'string' ? rootResult.message : null) ??
      (typeof root.message === 'string' ? root.message : null),
    listTotalCount: toNumberOrNull(root.list_total_count),
    head: null,
    raw,
  };
}

async function callRebApi(
  endpoint: string,
  query: Record<string, string | number | undefined>,
  options: RebListOptions = {}
) {
  const type = options.type ?? 'json';
  const page = clampPage(options.page);
  const size = clampSize(options.size);
  const rawKey = getRebApiKeyOrThrow();
  const keysToTry = buildKeyCandidates(rawKey);
  const typesToTry = type === 'json' ? ['json', 'JSON'] : [type];
  const endpointsToTry = buildEndpointCandidates(endpoint);
  let lastError: Error | null = null;

  for (const baseUrl of REB_BASE_URL_CANDIDATES) {
    for (const endpointName of endpointsToTry) {
      for (const requestType of typesToTry) {
        for (const key of keysToTry) {
          const params = new URLSearchParams({
            Key: key,
            Type: requestType,
            pIndex: String(page),
            pSize: String(size),
          });

          for (const [k, v] of Object.entries(query)) {
            if (v === undefined || v === null || String(v).trim() === '') continue;
            params.set(k, String(v));
          }

          const url = `${baseUrl}/${endpointName}?${params.toString()}`;
          const safeUrl = sanitizeUrlForLogs(url);

          let response: Response;
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 12000);
            try {
              response = await fetch(url, {
                method: 'GET',
                headers: {
                  Accept: 'application/json, text/plain, */*',
                  'User-Agent': 'imapplepie-reb-client/1.0',
                },
                signal: controller.signal,
              });
            } finally {
              clearTimeout(timeout);
            }
          } catch (fetchError) {
            lastError = new Error(
              `REB API network error: ${describeFetchError(fetchError)} | url=${safeUrl}`
            );
            continue;
          }

          const responseText = await response.text();
          const preview = responseText.slice(0, 200).replace(/\s+/g, ' ').trim();

          if (!response.ok) {
            lastError = new Error(
              `REB API request failed: ${response.status} ${response.statusText} | url=${safeUrl} | body=${preview}`
            );
            continue;
          }

          const trimmed = responseText.trim();
          const looksLikeJson = trimmed.startsWith('{') || trimmed.startsWith('[');
          const looksLikeHtml = /^<!doctype|^<html/i.test(trimmed);

          if (!looksLikeJson) {
            if (looksLikeHtml) {
              const summary = extractHtmlErrorSummary(responseText);
              const knownAuthError =
                preview.includes('인증키가 유효하지 않습니다') ||
                preview.includes('인증키 사용이 제한되었습니다') ||
                /인증키|사용이 제한|유효하지 않|관리자/.test(summary);

              lastError = new Error(
                knownAuthError
                  ? `REB API returned HTML auth error page. 인증키 상태(승인/사용제한) 또는 키 인코딩을 확인하세요. summary=${summary || preview}`
                  : `REB API returned HTML instead of JSON. endpoint=${endpointName}, Type=${requestType}, baseUrl=${baseUrl}, summary=${summary || preview}`
              );
            } else {
              lastError = new Error(
                `REB API did not return JSON. endpoint=${endpointName}, Type=${requestType}, baseUrl=${baseUrl}, body=${preview}`
              );
            }
            continue;
          }

          try {
            const json = JSON.parse(responseText);
            return normalizeRebResponse(json);
          } catch {
            lastError = new Error(
              `REB API JSON parse failed. endpoint=${endpointName}, Type=${requestType}, baseUrl=${baseUrl}, body=${preview}`
            );
          }
        }
      }
    }
  }

  throw lastError ?? new Error('REB API request failed for unknown reason');
}

export async function fetchRebTables(params: RebTableListParams = {}) {
  return callRebApi(
    'SttsApiTbl',
    { STATBL_ID: params.statblId },
    {
      page: params.page,
      size: params.size,
      type: params.type ?? 'json',
    }
  );
}

export async function fetchRebTableItems(params: RebTableItemParams) {
  if (!params.statblId?.trim()) {
    throw new Error('statblId is required');
  }

  return callRebApi(
    'SttsApiTblItm',
    {
      STATBL_ID: params.statblId,
      ITM_TAG: params.itmTag,
    },
    {
      page: params.page,
      size: params.size,
      type: params.type ?? 'json',
    }
  );
}

export async function fetchRebTableData(params: RebTableDataParams) {
  if (!params.statblId?.trim()) {
    throw new Error('statblId is required');
  }

  const baseOptions = {
    page: params.page,
    size: params.size,
    type: params.type ?? 'json' as RebResponseType,
  };

  const callWith = (resolved: RebTableDataParams) => callRebApi(
    'SttsApiTblData',
    {
      STATBL_ID: resolved.statblId,
      DTACYCLE_CD: resolved.dtacycleCd,
      WRTTIME_IDTFR_ID: resolved.wrttimeIdtfrId,
      ITM_ID: resolved.itmId,
      ITM_TAG: resolved.itmTag,
      CLS_ID: resolved.clsId,
      ...(resolved.filters ?? {}),
    },
    baseOptions
  );

  const first = await callWith(params);
  const resolved: RebTableDataParams = { ...params };
  let hasPatched = false;
  let lastResult: RebNormalizedResult = first;
  let bestNonMissingResult: RebNormalizedResult | null = isMissingRequiredParamError(first) ? null : first;
  let itemCandidates: RebItemCandidate[] = [];

  const acceptResult = (result: RebNormalizedResult) => {
    lastResult = result;
    if (isMissingRequiredParamError(result)) return false;
    if (!bestNonMissingResult) bestNonMissingResult = result;
    return result.rows.length > 0 || !isNoDataResult(result);
  };

  if (acceptResult(first)) {
    return first;
  }

  if (!resolved.dtacycleCd) {
    try {
      const tableMeta = await fetchRebTables({
        statblId: resolved.statblId,
        page: 1,
        size: 10,
        type: params.type ?? 'json',
      });
      const dtacycleCd = pickDtacycleCdFromTableRows(tableMeta.rows as Record<string, unknown>[]);
      if (dtacycleCd) {
        resolved.dtacycleCd = dtacycleCd;
        hasPatched = true;
        const retried = await callWith(resolved);
        if (acceptResult(retried)) {
          return retried;
        }
      }
    } catch {
      // keep original error path
    }
  }

  if (!resolved.itmTag) {
    try {
      const itemMeta = await fetchRebTableItems({
        statblId: resolved.statblId,
        page: 1,
        size: 1000,
        type: params.type ?? 'json',
      });
      itemCandidates = pickItemCandidates(itemMeta.rows as Record<string, unknown>[]);
      const firstTag = itemCandidates.find((candidate) => !!candidate.itmTag)?.itmTag ?? null;
      if (!resolved.itmTag && firstTag) {
        resolved.itmTag = firstTag;
        hasPatched = true;
        const retried = await callWith(resolved);
        if (acceptResult(retried)) {
          return retried;
        }
      }
    } catch {
      // keep original error path
    }
  }

  // ITM_ID 자동 주입은 마지막 fallback 으로만 시도하고,
  // "필수값 오류"를 벗어나더라도 실제 row가 0이면 성공으로 확정하지 않는다.
  if (isMissingRequiredParamError(lastResult)) {
    if (itemCandidates.length === 0) {
      try {
        const itemMeta = await fetchRebTableItems({
          statblId: resolved.statblId,
          page: 1,
          size: 1000,
          type: params.type ?? 'json',
        });
        itemCandidates = pickItemCandidates(itemMeta.rows as Record<string, unknown>[]);
      } catch {
        // keep current error path
      }
    }

    let nonMissingNoDataResult: RebNormalizedResult | null = null;
    const retryPool = itemCandidates
      .filter((candidate) => candidate.itmId !== resolved.itmId)
      .slice(0, 20);

    for (const candidate of retryPool) {
      const candidateResult = await callWith({
        ...resolved,
        itmId: candidate.itmId,
        itmTag: candidate.itmTag ?? resolved.itmTag,
      });
      lastResult = candidateResult;
      if (candidateResult.rows.length > 0) {
        return candidateResult;
      }
      if (!isMissingRequiredParamError(candidateResult) && !nonMissingNoDataResult) {
        nonMissingNoDataResult = candidateResult;
      }
    }

    if (nonMissingNoDataResult) {
      return nonMissingNoDataResult;
    }
  }

  if (!hasPatched) {
    return bestNonMissingResult ?? first;
  }

  if (isErrorCode(lastResult.resultCode) && isMissingRequiredParamError(lastResult)) {
    const detail = [
      `STATBL_ID=${resolved.statblId}`,
      `DTACYCLE_CD=${resolved.dtacycleCd ?? '-'}`,
      `ITM_ID=${resolved.itmId ?? '-'}`,
      `ITM_TAG=${resolved.itmTag ?? '-'}`,
      `CLS_ID=${resolved.clsId ?? '-'}`,
      `WRTTIME_IDTFR_ID=${resolved.wrttimeIdtfrId ?? '-'}`,
    ].join(', ');
    throw new Error(
      `REB table-data required params unresolved (${lastResult.resultCode}): ${lastResult.resultMessage ?? '요청인자 확인 필요'} | ${detail}`
    );
  }

  return bestNonMissingResult ?? lastResult;
}
