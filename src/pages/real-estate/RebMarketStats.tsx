import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  Database,
  Loader2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import HudCard from '../../components/common/HudCard';
import Button from '../../components/common/Button';
import { API_BASE } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';

type RebRow = Record<string, unknown>;

interface RebTableDataResponse {
  success: boolean;
  rows: RebRow[];
  listTotalCount: number | null;
  serviceName: string | null;
  resultCode?: string | null;
  resultMessage?: string | null;
  error?: string;
}

interface ChangePoint {
  month: string;
  rate: number;
  indexValue: number;
}

interface LabelMomentum {
  label: string;
  latestMonth: string;
  latestValue: number;
  prevMonth: string | null;
  prevValue: number | null;
  change: number | null;
  changeRate: number | null;
  sampleCount: number;
}

const TABLE_PRESETS = [
  { label: '주택종합 매매수급동향', value: 'A_2024_00041', description: '매수·매도 심리 온도' },
  { label: '주택종합 전세수급동향', value: 'A_2024_00042', description: '전세 수요·공급 압력' },
  { label: '주택종합 월세수급동향', value: 'A_2024_00043', description: '월세 수요·공급 압력' },
  { label: '주택종합 매매가격지수', value: 'A_2024_00016', description: '가격 레벨 추세' },
];
const DEFAULT_STATBL_ID = TABLE_PRESETS[0]?.value ?? '';
const NATIONAL_COMPOSITE_STATBL_ID = 'A_2024_00016';
const NATIONAL_CLS_ID = '500001';

const MONTH_WINDOW_OPTIONS = [
  { label: '최근 12개월', value: 12 },
  { label: '최근 24개월', value: 24 },
  { label: '최근 36개월', value: 36 },
  { label: '전체', value: 0 },
];

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function extractMonthKey(raw: unknown): string | null {
  if (!raw) return null;
  const value = String(raw).trim();

  if (/^\d{6}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}`;
  }

  if (/^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}`;
  }

  const matched = value.match(/(\d{4})[^\d]?(\d{1,2})/);
  if (!matched) return null;

  const year = matched[1];
  const month = matched[2].padStart(2, '0');
  if (Number(month) < 1 || Number(month) > 12) return null;

  return `${year}-${month}`;
}

function extractValue(row: RebRow): number | null {
  const preferredKeys = [
    'DTA_VAL',
    'DTVAL_CO',
    'VAL',
    'INDEX_VAL',
    'IDX_VAL',
    'VALUE',
    '지수값',
  ];

  for (const key of preferredKeys) {
    const parsed = toNumber(row[key]);
    if (parsed !== null) return parsed;
  }

  for (const [key, raw] of Object.entries(row)) {
    if (!/(VAL|IDX|PRICE|VALUE|지수|가격)/i.test(key)) continue;
    const parsed = toNumber(raw);
    if (parsed !== null) return parsed;
  }

  return null;
}

function extractLabel(row: RebRow): string {
  const keys = ['CLS_NM', 'C1_NM', 'C2_NM', 'SIGUNGU_NM', 'ADM_SECT_NM', 'ITM_NM'];
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '미분류';
}

function formatNumber(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return value.toLocaleString('ko-KR', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function formatSigned(value: number | null | undefined, digits = 2, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${formatNumber(value, digits)}${suffix}`;
}

function pickColumns(rows: RebRow[]) {
  if (rows.length === 0) return [] as string[];

  const preferred = [
    'WRTTIME_IDTFR_ID',
    'WRTTIME_IDTFR',
    'BASE_DE',
    'CLS_NM',
    'C1_NM',
    'ITM_NM',
    'DTA_VAL',
    'DTVAL_CO',
    'VAL',
  ];

  const keys = Object.keys(rows[0]);
  const selected = preferred.filter((key) => keys.includes(key));

  for (const key of keys) {
    if (selected.length >= 6) break;
    if (!selected.includes(key)) selected.push(key);
  }

  return selected.slice(0, 6);
}

function getLatestMonthFromRows(rows: RebRow[]): string | null {
  let latest: string | null = null;
  rows.forEach((row) => {
    const month =
      extractMonthKey(row.WRTTIME_IDTFR_ID) ||
      extractMonthKey(row.WRTTIME_IDTFR) ||
      extractMonthKey(row.BASE_DE) ||
      extractMonthKey(row.DEAL_YMD);
    if (!month) return;
    if (!latest || month > latest) {
      latest = month;
    }
  });
  return latest;
}

function getLatestAndPreviousWrttimeIdFromRows(rows: RebRow[]) {
  const monthIdMap = new Map<string, Set<string>>();

  rows.forEach((row) => {
    const wrttimeIdRaw = row.WRTTIME_IDTFR_ID;
    if (wrttimeIdRaw === null || wrttimeIdRaw === undefined) return;

    const wrttimeId = String(wrttimeIdRaw).trim();
    if (!wrttimeId) return;

    const month = extractMonthKey(wrttimeId);
    if (!month) return;

    const idSet = monthIdMap.get(month) || new Set<string>();
    idSet.add(wrttimeId);
    monthIdMap.set(month, idSet);
  });

  const monthsDesc = Array.from(monthIdMap.keys()).sort((a, b) => b.localeCompare(a));
  const latestMonth = monthsDesc[0] ?? null;
  const previousMonth = monthsDesc[1] ?? null;

  const pickLatestIdInMonth = (month: string | null) => {
    if (!month) return null;
    const ids = Array.from(monthIdMap.get(month) || []);
    if (ids.length === 0) return null;
    ids.sort((a, b) => b.localeCompare(a));
    return ids[0];
  };

  return {
    latestMonth,
    previousMonth,
    latestWrttimeId: pickLatestIdInMonth(latestMonth),
    previousWrttimeId: pickLatestIdInMonth(previousMonth),
  };
}

const RebMarketStats = () => {
  const authFetch = useAuthStore((state) => state.authFetch);

  const [statblId, setStatblId] = useState(DEFAULT_STATBL_ID);
  const [hasUserSelectedStatbl, setHasUserSelectedStatbl] = useState(false);
  const [sampleSize, setSampleSize] = useState(300);
  const [monthWindow, setMonthWindow] = useState(24);

  const [rows, setRows] = useState<RebRow[]>([]);
  const [listTotalCount, setListTotalCount] = useState<number | null>(null);
  const [serviceName, setServiceName] = useState<string | null>(null);
  const [resultCode, setResultCode] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [nationalChangeTrend, setNationalChangeTrend] = useState<ChangePoint[]>([]);

  const setDataState = (data: RebTableDataResponse) => {
    const normalizedRows = Array.isArray(data.rows) ? data.rows : [];
    setRows(normalizedRows);
    setListTotalCount(data.listTotalCount ?? null);
    setServiceName(data.serviceName ?? null);
    setResultCode(data.resultCode ?? null);
    setResultMessage(data.resultMessage ?? null);
  };

  const fetchTableDataPage = async (
    selectedStatblId: string,
    page: number,
    options?: {
      size?: number;
      wrttimeIdtfrId?: string;
      clsId?: string;
    }
  ) => {
    const params = new URLSearchParams({
      statblId: selectedStatblId,
      size: String(options?.size ?? sampleSize),
      page: String(page),
      type: 'json',
    });
    if (options?.wrttimeIdtfrId) {
      params.set('wrttimeIdtfrId', options.wrttimeIdtfrId);
    }
    if (options?.clsId) {
      params.set('clsId', options.clsId);
    }

    const response = await authFetch(`${API_BASE}/api/public/reb/table-data?${params.toString()}`);
    const data = (await response.json()) as RebTableDataResponse;

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'REB 통계 데이터를 불러오지 못했습니다.');
    }

    return data;
  };

  const fetchLatestSidePageData = async (
    selectedStatblId: string,
    options?: {
      size?: number;
      clsId?: string;
    }
  ) => {
    const pageSize = Math.max(1, options?.size ?? sampleSize);
    const firstPageData = await fetchTableDataPage(selectedStatblId, 1, options);
    const total = firstPageData.listTotalCount ?? firstPageData.rows.length;
    const lastPage = Math.max(1, Math.ceil(total / pageSize));
    if (lastPage <= 1) return firstPageData;

    try {
      const lastPageData = await fetchTableDataPage(selectedStatblId, lastPage, options);
      const firstLatest = getLatestMonthFromRows(firstPageData.rows);
      const lastLatest = getLatestMonthFromRows(lastPageData.rows);
      if (lastLatest && (!firstLatest || lastLatest > firstLatest)) {
        return lastPageData;
      }
      return firstPageData;
    } catch {
      return firstPageData;
    }
  };

  const fetchTableData = async (selectedStatblId: string) => {
    // 일부 REB 통계표는 page=1이 과거 데이터일 수 있어, 최신 시점이 있는 쪽 페이지를 우선 선택한다.
    const latestSideData = await fetchLatestSidePageData(selectedStatblId, {
      size: Math.max(500, sampleSize),
    });
    const latestPair = getLatestAndPreviousWrttimeIdFromRows(latestSideData.rows);

    try {
      if (latestPair.latestWrttimeId) {
        // 최신월과 직전월을 같이 가져와 비교형 지표를 계산한다.
        const latestData = await fetchTableDataPage(selectedStatblId, 1, {
          size: 1000,
          wrttimeIdtfrId: latestPair.latestWrttimeId,
        });

        let mergedRows = Array.isArray(latestData.rows) ? [...latestData.rows] : [];

        if (latestPair.previousWrttimeId && latestPair.previousWrttimeId !== latestPair.latestWrttimeId) {
          const prevData = await fetchTableDataPage(selectedStatblId, 1, {
            size: 1000,
            wrttimeIdtfrId: latestPair.previousWrttimeId,
          });
          if (Array.isArray(prevData.rows) && prevData.rows.length > 0) {
            mergedRows = [...mergedRows, ...prevData.rows];
          }
        }

        if (mergedRows.length > 0) {
          return {
            ...latestData,
            rows: mergedRows,
          };
        }
      }

      return latestSideData;
    } catch {
      return latestSideData;
    }
  };

  const fetchNationalCompositeChangeTrend = async () => {
    const data = await fetchLatestSidePageData(NATIONAL_COMPOSITE_STATBL_ID, {
      clsId: NATIONAL_CLS_ID,
      size: 1000,
    });

    const monthMap = new Map<string, { sum: number; count: number }>();
    (Array.isArray(data.rows) ? data.rows : []).forEach((row) => {
      const month =
        extractMonthKey(row.WRTTIME_IDTFR_ID) ||
        extractMonthKey(row.WRTTIME_IDTFR) ||
        extractMonthKey(row.BASE_DE) ||
        extractMonthKey(row.DEAL_YMD);
      const value = extractValue(row);
      if (!month || value === null) return;

      const prev = monthMap.get(month) || { sum: 0, count: 0 };
      prev.sum += value;
      prev.count += 1;
      monthMap.set(month, prev);
    });

    const indexSeries = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, stat]) => ({
        month,
        value: stat.count > 0 ? stat.sum / stat.count : null,
      }))
      .filter((item): item is { month: string; value: number } => item.value !== null);

    const points: ChangePoint[] = [];
    for (let i = 1; i < indexSeries.length; i += 1) {
      const prev = indexSeries[i - 1].value;
      const current = indexSeries[i].value;
      if (prev === 0) continue;
      points.push({
        month: indexSeries[i].month,
        rate: ((current - prev) / prev) * 100,
        indexValue: current,
      });
    }

    return points;
  };

  const fetchRebStats = async (refresh = false) => {
    const selectedStatblId = statblId.trim();
    if (!selectedStatblId) {
      setRows([]);
      setListTotalCount(null);
      setServiceName(null);
      setResultCode(null);
      setResultMessage(null);
      setError(null);
      setNotice(null);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);

    setError(null);
    setNotice(null);
    let nationalPromise: Promise<ChangePoint[]> | null = null;

    try {
      nationalPromise = fetchNationalCompositeChangeTrend();
      const data = await fetchTableData(selectedStatblId);
      const hasRows = Array.isArray(data.rows) && data.rows.length > 0;

      // 초기에 기본 통계표가 비는 경우 preset을 순회해 첫 유효 데이터를 자동 선택한다.
      if (!hasRows && !hasUserSelectedStatbl) {
        const fallbackIds = TABLE_PRESETS
          .map((preset) => preset.value)
          .filter((value) => value !== selectedStatblId);

        for (const fallbackId of fallbackIds) {
          try {
            const fallbackData = await fetchTableData(fallbackId);
            if (!Array.isArray(fallbackData.rows) || fallbackData.rows.length === 0) continue;

            setDataState(fallbackData);
            setStatblId(fallbackId);
            const fallbackLabel = TABLE_PRESETS.find((preset) => preset.value === fallbackId)?.label || fallbackId;
            setNotice(`기본 통계표 데이터가 없어 "${fallbackLabel}"로 자동 전환했습니다.`);
            if (nationalPromise) {
              const points = await nationalPromise.catch(() => []);
              setNationalChangeTrend(points);
            }
            return;
          } catch {
            // 다음 preset 후보를 계속 시도
          }
        }
      }

      setDataState(data);
      if (nationalPromise) {
        const points = await nationalPromise.catch(() => []);
        setNationalChangeTrend(points);
      }
    } catch (fetchError) {
      setRows([]);
      setListTotalCount(null);
      setServiceName(null);
      setResultCode(null);
      setResultMessage(null);
      if (nationalPromise) {
        const points = await nationalPromise.catch(() => []);
        setNationalChangeTrend(points);
      }
      const message = fetchError instanceof Error ? fetchError.message : '통계 조회 실패';
      const isNetworkError = /(network error|fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT)/i.test(message);
      setError(
        isNetworkError
          ? 'REB 서버 연결에 실패했습니다. API 서버/도메인/DNS 상태를 확인해주세요.'
          : message
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!statblId.trim()) {
      setIsLoading(false);
      return;
    }
    void fetchRebStats();
  }, [statblId, sampleSize]);

  const nationalChangeWindowed = useMemo(
    () => (monthWindow > 0 ? nationalChangeTrend.slice(-monthWindow) : nationalChangeTrend),
    [nationalChangeTrend, monthWindow]
  );

  const nationalChangeLinePoints = useMemo(() => {
    if (nationalChangeWindowed.length === 0) return '';

    const min = Math.min(...nationalChangeWindowed.map((point) => point.rate));
    const max = Math.max(...nationalChangeWindowed.map((point) => point.rate));
    const span = Math.max(1e-6, max - min);

    return nationalChangeWindowed
      .map((point, idx) => {
        const x = (idx / Math.max(1, nationalChangeWindowed.length - 1)) * 100;
        const y = 100 - ((point.rate - min) / span) * 100;
        return `${x},${y}`;
      })
      .join(' ');
  }, [nationalChangeWindowed]);

  const nationalChangeMetrics = useMemo(() => {
    const latest = nationalChangeWindowed[nationalChangeWindowed.length - 1] ?? null;
    const prev = nationalChangeWindowed[nationalChangeWindowed.length - 2] ?? null;
    return {
      latestMonth: latest?.month ?? null,
      latestRate: latest?.rate ?? null,
      latestIndexValue: latest?.indexValue ?? null,
      prevRate: prev?.rate ?? null,
      startMonth: nationalChangeWindowed[0]?.month ?? null,
    };
  }, [nationalChangeWindowed]);

  const labelMomentum = useMemo<LabelMomentum[]>(() => {
    const labelMonthMap = new Map<string, Map<string, { sum: number; count: number }>>();

    rows.forEach((row) => {
      const label = extractLabel(row);
      const month =
        extractMonthKey(row.WRTTIME_IDTFR_ID) ||
        extractMonthKey(row.WRTTIME_IDTFR) ||
        extractMonthKey(row.BASE_DE) ||
        extractMonthKey(row.DEAL_YMD);
      const value = extractValue(row);
      if (!month || value === null) return;

      const monthMap = labelMonthMap.get(label) || new Map<string, { sum: number; count: number }>();
      const monthStat = monthMap.get(month) || { sum: 0, count: 0 };
      monthStat.sum += value;
      monthStat.count += 1;
      monthMap.set(month, monthStat);
      labelMonthMap.set(label, monthMap);
    });

    const list: LabelMomentum[] = [];
    for (const [label, monthMap] of labelMonthMap.entries()) {
      let months = Array.from(monthMap.keys()).sort((a, b) => a.localeCompare(b));
      if (monthWindow > 0) {
        // 변화율 계산을 위해 최소 2개 구간은 확보한다.
        months = months.slice(-Math.max(2, monthWindow));
      }
      if (months.length === 0) continue;

      const latestMonth = months[months.length - 1];
      const prevMonth = months.length >= 2 ? months[months.length - 2] : null;
      const latestStat = monthMap.get(latestMonth);
      const prevStat = prevMonth ? monthMap.get(prevMonth) : null;
      if (!latestStat || latestStat.count === 0) continue;

      const latestValue = latestStat.sum / latestStat.count;
      const prevValue = prevStat && prevStat.count > 0 ? prevStat.sum / prevStat.count : null;
      const change = prevValue !== null ? latestValue - prevValue : null;
      const changeRate = prevValue !== null && prevValue !== 0 ? ((latestValue - prevValue) / prevValue) * 100 : null;
      const sampleCount = months.reduce((sum, month) => sum + (monthMap.get(month)?.count ?? 0), 0);

      list.push({
        label,
        latestMonth,
        latestValue,
        prevMonth,
        prevValue,
        change,
        changeRate,
        sampleCount,
      });
    }

    return list;
  }, [rows, monthWindow]);

  const momentumWithChange = useMemo(
    () => labelMomentum.filter((item) => item.changeRate !== null),
    [labelMomentum]
  );

  const topRisers = useMemo(
    () =>
      momentumWithChange
        .slice()
        .sort((a, b) => (b.changeRate ?? 0) - (a.changeRate ?? 0))
        .slice(0, 6),
    [momentumWithChange]
  );

  const topFallers = useMemo(
    () =>
      momentumWithChange
        .slice()
        .sort((a, b) => (a.changeRate ?? 0) - (b.changeRate ?? 0))
        .slice(0, 6),
    [momentumWithChange]
  );

  const breadth = useMemo(() => {
    const threshold = 0.01;
    let upCount = 0;
    let downCount = 0;
    let flatCount = 0;
    let sumRate = 0;

    momentumWithChange.forEach((item) => {
      const rate = item.changeRate ?? 0;
      sumRate += rate;
      if (rate > threshold) upCount += 1;
      else if (rate < -threshold) downCount += 1;
      else flatCount += 1;
    });

    const avgChangeRate = momentumWithChange.length > 0 ? sumRate / momentumWithChange.length : null;

    return {
      upCount,
      downCount,
      flatCount,
      avgChangeRate,
    };
  }, [momentumWithChange]);

  const marketSignal = useMemo(() => {
    const comparedCount = breadth.upCount + breadth.downCount + breadth.flatCount;
    const upShare = comparedCount > 0 ? (breadth.upCount / comparedCount) * 100 : null;
    const downShare = comparedCount > 0 ? (breadth.downCount / comparedCount) * 100 : null;

    let label = '혼조/관망';
    if (
      upShare !== null &&
      downShare !== null &&
      breadth.avgChangeRate !== null &&
      upShare >= 55 &&
      breadth.avgChangeRate > 0
    ) {
      label = '상승 확산';
    } else if (
      upShare !== null &&
      downShare !== null &&
      breadth.avgChangeRate !== null &&
      downShare >= 55 &&
      breadth.avgChangeRate < 0
    ) {
      label = '하락 확산';
    }

    return {
      comparedCount,
      upShare,
      downShare,
      label,
    };
  }, [breadth]);

  const metrics = useMemo(() => {
    return {
      latestMonth: getLatestMonthFromRows(rows),
    };
  }, [rows]);

  const previewColumns = useMemo(() => pickColumns(rows), [rows]);
  const selectedPreset = useMemo(
    () => TABLE_PRESETS.find((preset) => preset.value === statblId),
    [statblId]
  );

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-hud-text-primary">REB 시장 신호판</h1>
        <p className="text-sm text-hud-text-muted">
          {selectedPreset
            ? `${selectedPreset.label} 기준으로 지역별 상승/하락 랭킹과 최근 흐름을 보여줍니다.`
            : '한국부동산원 Open API 데이터를 월별/지역별로 요약합니다.'}
        </p>
      </div>

      <HudCard>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_220px_180px_auto] gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-hud-text-muted mb-1">통계표</label>
            <select
              value={statblId}
              onChange={(e) => {
                setHasUserSelectedStatbl(true);
                setStatblId(e.target.value);
              }}
              className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:border-hud-accent-primary"
            >
              <option value="">통계표를 선택하세요</option>
              {TABLE_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label} · {preset.description}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-hud-text-muted mb-1">조회 표본</label>
            <select
              value={sampleSize}
              onChange={(e) => setSampleSize(Number(e.target.value) || 300)}
              className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:border-hud-accent-primary"
            >
              <option value={100}>100건</option>
              <option value={300}>300건</option>
              <option value={500}>500건</option>
              <option value={1000}>1000건</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-hud-text-muted mb-1">기간 범위</label>
            <select
              value={monthWindow}
              onChange={(e) => setMonthWindow(Number(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:border-hud-accent-primary"
            >
              {MONTH_WINDOW_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <Button
            variant="primary"
            leftIcon={<RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />}
            onClick={() => void fetchRebStats(true)}
            disabled={isRefreshing}
            className="h-[38px]"
          >
            새로고침
          </Button>
        </div>
        {!error && metrics.latestMonth && (
          <p className="mt-2 text-xs text-hud-text-muted">데이터 기준월: {metrics.latestMonth}</p>
        )}
      </HudCard>

      {error && (
        <div className="rounded-lg border border-hud-accent-danger/40 bg-hud-accent-danger/10 px-4 py-3 text-sm text-hud-accent-danger flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-hud-accent-info/40 bg-hud-accent-info/10 px-4 py-3 text-sm text-hud-text-primary">
          {notice}
        </div>
      )}

      {isLoading ? (
        <HudCard className="p-8">
          <div className="h-48 flex items-center justify-center text-sm text-hud-text-muted gap-2">
            <Loader2 size={16} className="animate-spin" />
            REB 통계를 불러오는 중...
          </div>
        </HudCard>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            <HudCard className="p-4">
              <p className="text-xs text-hud-text-muted">시장 상태</p>
              <p className="text-xl font-bold text-hud-text-primary mt-1">{marketSignal.label}</p>
              <p className="mt-1 text-xs text-hud-text-muted">비교 표본 {marketSignal.comparedCount.toLocaleString()}개</p>
            </HudCard>
            <HudCard className="p-4">
              <p className="text-xs text-hud-text-muted">최근 기준월</p>
              <p className="text-xl font-bold text-hud-text-primary mt-1">{metrics.latestMonth || '-'}</p>
            </HudCard>
            <HudCard className="p-4">
              <p className="text-xs text-hud-text-muted">전국 월 변동률</p>
              <p className={`text-xl font-bold mt-1 ${(nationalChangeMetrics.latestRate ?? 0) >= 0 ? 'text-hud-accent-success' : 'text-hud-accent-danger'}`}>
                {formatSigned(nationalChangeMetrics.latestRate, 3, '%')}
              </p>
            </HudCard>
            <HudCard className="p-4">
              <p className="text-xs text-hud-text-muted">평균 변화율</p>
              <p className={`text-xl font-bold mt-1 ${(breadth.avgChangeRate ?? 0) >= 0 ? 'text-hud-accent-success' : 'text-hud-accent-danger'}`}>
                {formatSigned(breadth.avgChangeRate, 2, '%')}
              </p>
            </HudCard>
            <HudCard className="p-4">
              <p className="text-xs text-hud-text-muted">상승 비중</p>
              <p className="text-xl font-bold text-hud-accent-success mt-1">
                {marketSignal.upShare === null ? '-' : `${formatNumber(marketSignal.upShare, 1)}%`}
              </p>
            </HudCard>
            <HudCard className="p-4">
              <p className="text-xs text-hud-text-muted">하락 비중</p>
              <p className="text-xl font-bold text-hud-accent-danger mt-1">
                {marketSignal.downShare === null ? '-' : `${formatNumber(marketSignal.downShare, 1)}%`}
              </p>
            </HudCard>
          </div>

          <HudCard title="전국주택종합 가격 변동률 추이" subtitle="REB 포털 추이와 동일하게 주택종합 매매가격지수(전국) 기준 월 변동률로 계산">
            {nationalChangeWindowed.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-sm text-hud-text-muted">
                <Database size={16} className="mr-2" />
                전국 변동률 추이 데이터를 계산할 수 없습니다.
              </div>
            ) : (
              <div>
                <div className="h-40 bg-hud-bg-primary border border-hud-border-secondary rounded-lg p-3">
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
                    <polyline
                      points={nationalChangeLinePoints}
                      fill="none"
                      stroke="var(--hud-accent-info)"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-hud-text-muted">
                  <span>시작: {nationalChangeMetrics.startMonth || '-'}</span>
                  <span className="text-right">최근: {nationalChangeMetrics.latestMonth || '-'}</span>
                  <span>최근 지수: {formatNumber(nationalChangeMetrics.latestIndexValue, 2)}</span>
                  <span className="text-right inline-flex flex-wrap items-center justify-end gap-1">
                    {nationalChangeMetrics.latestRate !== null && nationalChangeMetrics.latestRate >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {formatSigned(nationalChangeMetrics.latestRate, 3, '%')}
                    <span className="text-hud-text-muted"> (전월 {formatSigned(nationalChangeMetrics.prevRate, 3, '%')})</span>
                  </span>
                </div>
              </div>
            )}
          </HudCard>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <HudCard title="핵심 해석" subtitle="최근월 기준 요약">
              <div className="space-y-2 text-sm">
                <p className="text-hud-text-primary">
                  {metrics.latestMonth || '-'} 기준 시장 상태는 <span className="font-semibold">{marketSignal.label}</span> 입니다.
                </p>
                <p className="text-hud-text-muted">
                  상승 비중 {marketSignal.upShare === null ? '-' : `${formatNumber(marketSignal.upShare, 1)}%`},
                  {' '}하락 비중 {marketSignal.downShare === null ? '-' : `${formatNumber(marketSignal.downShare, 1)}%`}
                </p>
                <p className="text-hud-text-muted">
                  전국 월 변동률 {formatSigned(nationalChangeMetrics.latestRate, 3, '%')} · 전월 {formatSigned(nationalChangeMetrics.prevRate, 3, '%')}
                </p>
                <p className="text-hud-text-muted">
                  지역 평균 변화율 {formatSigned(breadth.avgChangeRate, 2, '%')} · 비교 표본 {marketSignal.comparedCount.toLocaleString()}개
                </p>
                <p className="text-xs text-hud-text-muted">
                  계산 기준: 최신월과 직전월 동일 지역 매칭값
                </p>
              </div>
            </HudCard>

            <HudCard title="상승 상위 지역" subtitle="최근월 대비 변동률 Top 6">
              {topRisers.length === 0 ? (
                <p className="text-sm text-hud-text-muted">상승 랭킹을 계산할 데이터가 없습니다.</p>
              ) : (
                <div className="space-y-2.5">
                  {topRisers.map((item) => (
                    <div key={`riser-${item.label}`}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-hud-text-secondary truncate max-w-[72%]" title={item.label}>{item.label}</span>
                        <span className="text-hud-accent-success font-semibold">{formatSigned(item.changeRate, 2, '%')}</span>
                      </div>
                      <div className="mt-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-[11px] text-hud-text-muted">
                        <span>{item.prevMonth || '-'} → {item.latestMonth}</span>
                        <span>{formatNumber(item.prevValue, 2)} → {formatNumber(item.latestValue, 2)} · 표본 {item.sampleCount}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </HudCard>

            <HudCard title="하락 상위 지역" subtitle="최근월 대비 변동률 Bottom 6">
              {topFallers.length === 0 ? (
                <p className="text-sm text-hud-text-muted">하락 랭킹을 계산할 데이터가 없습니다.</p>
              ) : (
                <div className="space-y-2.5">
                  {topFallers.map((item) => (
                    <div key={`faller-${item.label}`}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-hud-text-secondary truncate max-w-[72%]" title={item.label}>{item.label}</span>
                        <span className="text-hud-accent-danger font-semibold">{formatSigned(item.changeRate, 2, '%')}</span>
                      </div>
                      <div className="mt-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-[11px] text-hud-text-muted">
                        <span>{item.prevMonth || '-'} → {item.latestMonth}</span>
                        <span>{formatNumber(item.prevValue, 2)} → {formatNumber(item.latestValue, 2)} · 표본 {item.sampleCount}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </HudCard>
          </div>

          <details className="rounded-lg border border-hud-border-secondary bg-hud-bg-secondary">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-hud-text-primary">
              원본/메타 데이터 보기
            </summary>
            <div className="px-4 pb-4 pt-1 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-hud-text-muted">통계표 ID</span>
                  <span className="text-hud-text-primary font-mono break-all text-right">{statblId}</span>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-hud-text-muted">서비스명</span>
                  <span className="text-hud-text-primary text-right">{serviceName || '-'}</span>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-hud-text-muted">API 총건수</span>
                  <span className="text-hud-text-primary text-right">{listTotalCount !== null ? listTotalCount.toLocaleString() : '-'}</span>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-hud-text-muted">resultCode</span>
                  <span className="text-hud-text-primary font-mono">{resultCode || '-'}</span>
                </div>
                <div className="flex items-start justify-between gap-2 md:col-span-2">
                  <span className="text-hud-text-muted">resultMessage</span>
                  <span className="text-hud-text-primary text-right">{resultMessage || '-'}</span>
                </div>
              </div>

              {rows.length === 0 ? (
                <p className="text-sm text-hud-text-muted">조회된 데이터가 없습니다.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-hud-border-secondary">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="bg-hud-bg-primary">
                      <tr>
                        {previewColumns.map((column) => (
                          <th key={column} className="px-3 py-2 text-left text-xs font-semibold text-hud-text-secondary border-b border-hud-border-secondary">{column}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 12).map((row, index) => (
                        <tr key={`row-${index}`} className="bg-hud-bg-secondary">
                          {previewColumns.map((column) => (
                            <td
                              key={`${index}-${column}`}
                              className="px-3 py-2 text-xs text-hud-text-primary border-b border-hud-border-secondary/50 max-w-[220px] truncate"
                              title={String(row[column] ?? '-')}
                            >
                              {row[column] === null || row[column] === undefined || row[column] === '' ? '-' : String(row[column])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </details>
        </>
      )}

      {!isLoading && !error && rows.length === 0 && (
        <HudCard className="p-6 text-center">
          <BarChart3 className="w-7 h-7 text-hud-text-muted mx-auto mb-2" />
          <p className="text-sm text-hud-text-muted">다른 통계표를 선택하거나 표본 크기를 늘려보세요.</p>
        </HudCard>
      )}
    </div>
  );
};

export default RebMarketStats;
