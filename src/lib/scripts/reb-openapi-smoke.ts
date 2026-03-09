// ============================================
// REB OpenAPI 스모크 테스트
// 실행:
//   npm run public:reb:smoke
//   npm run public:reb:smoke -- A_2024_00900
// ============================================

import {
  fetchRebTableData,
  fetchRebTableItems,
  fetchRebTables,
  getRebApiConfigStatus,
} from '../public-data/reb-client';

async function main() {
  const statblId = process.argv[2] || 'A_2024_00900';
  const status = getRebApiConfigStatus();

  console.log('[REB] baseUrl:', status.baseUrl);
  console.log('[REB] key configured:', status.configured);
  console.log('[REB] key source:', status.keySource ?? '(none)');

  if (!status.configured) {
    throw new Error('REB API 키가 없습니다. 환경변수(REB_OPEN_API_KEY 등)를 설정하세요.');
  }

  const tables = await fetchRebTables({ page: 1, size: 5, type: 'json' });
  console.log('[REB] tables resultCode:', tables.resultCode, 'message:', tables.resultMessage);
  console.log('[REB] tables arrayField:', tables.arrayField, 'count:', tables.rows.length);

  const firstTable = tables.rows[0] as Record<string, unknown> | undefined;
  if (firstTable) {
    console.log('[REB] first table sample:', firstTable);
  }

  const items = await fetchRebTableItems({
    statblId,
    page: 1,
    size: 20,
    type: 'json',
  });
  console.log('[REB] items resultCode:', items.resultCode, 'message:', items.resultMessage);
  console.log('[REB] items arrayField:', items.arrayField, 'count:', items.rows.length);

  const firstItem = items.rows[0] as Record<string, unknown> | undefined;
  if (firstItem) {
    console.log('[REB] first item sample:', firstItem);
  }

  const data = await fetchRebTableData({
    statblId,
    page: 1,
    size: 20,
    type: 'json',
  });
  console.log('[REB] data resultCode:', data.resultCode, 'message:', data.resultMessage);
  console.log('[REB] data arrayField:', data.arrayField, 'count:', data.rows.length);
  console.log('[REB] data listTotalCount:', data.listTotalCount);

  const firstData = data.rows[0] as Record<string, unknown> | undefined;
  if (firstData) {
    console.log('[REB] first data sample:', firstData);
  }
}

main().catch((error) => {
  console.error('[REB] smoke failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
