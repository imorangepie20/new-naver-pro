import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, BarChart3, Loader2, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import HudCard from '../common/HudCard';
import Button from '../common/Button';
import { API_BASE } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';

type RebRow = Record<string, unknown>;

interface RebTableDataResponse {
  success: boolean;
  rows: RebRow[];
  listTotalCount: number | null;
  serviceName: string | null;
  error?: string;
}

interface LabelMomentum {
  label: string;
  latestMonth: string;
  latestValue: number;
  prevMonth: string | null;
  prevValue: number | null;
  changeRate: number | null;
  sampleCount: number;
}

interface PresetSummary {
  key: string;
  label: string;
  description: string;
  latestMonth: string | null;
  latestValue: number | null;
  prevValue: number | null;
  changeRate: number | null;
  comparedCount: number;
  upCount: number;
  downCount: number;
  flatCount: number;
  signal: string;
  insight: string;
  topRiser: LabelMomentum | null;
  topFaller: LabelMomentum | null;
}

const PRESETS = [
  { key: 'sale-demand', label: '매매 수급', description: '매수·매도 심리', value: 'A_2024_00041' },
  { key: 'jeonse-demand', label: '전세 수급', description: '전세 수요·공급 압력', value: 'A_2024_00042' },
  { key: 'monthly-demand', label: '월세 수급', description: '월세 수요·공급 압력', value: 'A_2024_00043' },
  { key: 'sale-price', label: '매매 가격지수', description: '가격 흐름', value: 'A_2024_00016' },
] as const;

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
  if (/^\d{6}$/.test(value)) return `${value.slice(0, 4)}-${value.slice(4, 6)}`;
  if (/^\d{8}$/.test(value)) return `${value.slice(0, 4)}-${value.slice(4, 6)}`;
  const matched = value.match(/(\d{4})[^\d]?(\d{1,2})/);
  if (!matched) return null;
  const month = matched[2].padStart(2, '0');
  if (Number(month) < 1 || Number(month) > 12) return null;
  return `${matched[1]}-${month}`;
}

function extractValue(row: RebRow): number | null {
  const preferredKeys = ['DTA_VAL', 'DTVAL_CO', 'VAL', 'INDEX_VAL', 'IDX_VAL', 'VALUE', '지수값'];
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
  return value.toLocaleString('ko-KR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function formatSigned(value: number | null | undefined, digits = 2, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${formatNumber(value, digits)}${suffix}`;
}

function getLatestMonthFromRows(rows: RebRow[]) {
  let latest: string | null = null;
  rows.forEach((row) => {
    const month =
      extractMonthKey(row.WRTTIME_IDTFR_ID) ||
      extractMonthKey(row.WRTTIME_IDTFR) ||
      extractMonthKey(row.BASE_DE) ||
      extractMonthKey(row.DEAL_YMD);
    if (!month) return;
    if (!latest || month > latest) latest = month;
  });
  return latest;
}

function getLatestAndPreviousWrttimeIdFromRows(rows: RebRow[]) {
  const monthIdMap = new Map<string, Set<string>>();
  rows.forEach((row) => {
    const wrttimeIdRaw = row.WRTTIME_IDTFR_ID;
    if (wrttimeIdRaw === null || wrttimeIdRaw === undefined) return;
    const wrttimeId = String(wrttimeIdRaw).trim();
    const month = extractMonthKey(wrttimeId);
    if (!wrttimeId || !month) return;
    const idSet = monthIdMap.get(month) || new Set<string>();
    idSet.add(wrttimeId);
    monthIdMap.set(month, idSet);
  });

  const monthsDesc = Array.from(monthIdMap.keys()).sort((a, b) => b.localeCompare(a));
  const latestMonth = monthsDesc[0] ?? null;
  const previousMonth = monthsDesc[1] ?? null;
  const pickLatestId = (month: string | null) => {
    if (!month) return null;
    const ids = Array.from(monthIdMap.get(month) || []).sort((a, b) => b.localeCompare(a));
    return ids[0] ?? null;
  };

  return {
    latestWrttimeId: pickLatestId(latestMonth),
    previousWrttimeId: pickLatestId(previousMonth),
  };
}

function buildMomentum(rows: RebRow[]) {
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

  const momentum: LabelMomentum[] = [];
  for (const [label, monthMap] of labelMonthMap.entries()) {
    const months = Array.from(monthMap.keys()).sort((a, b) => a.localeCompare(b));
    if (months.length === 0) continue;
    const latestMonth = months[months.length - 1];
    const prevMonth = months.length >= 2 ? months[months.length - 2] : null;
    const latestStat = monthMap.get(latestMonth);
    const prevStat = prevMonth ? monthMap.get(prevMonth) : null;
    if (!latestStat || latestStat.count === 0) continue;

    const latestValue = latestStat.sum / latestStat.count;
    const prevValue = prevStat && prevStat.count > 0 ? prevStat.sum / prevStat.count : null;
    const changeRate = prevValue !== null && prevValue !== 0 ? ((latestValue - prevValue) / prevValue) * 100 : null;
    const sampleCount = months.reduce((sum, month) => sum + (monthMap.get(month)?.count ?? 0), 0);

    momentum.push({
      label,
      latestMonth,
      latestValue,
      prevMonth,
      prevValue,
      changeRate,
      sampleCount,
    });
  }

  return momentum.filter((item) => item.changeRate !== null);
}

function interpretPreset(presetKey: string, latestValue: number | null, changeRate: number | null, breadth: { upCount: number; downCount: number; comparedCount: number }) {
  if (presetKey === 'sale-price') {
    if (changeRate !== null && changeRate > 0.08) return { signal: '가격 상승 압력', insight: '직전 대비 상승 지역이 우세합니다.' };
    if (changeRate !== null && changeRate < -0.08) return { signal: '가격 조정 구간', insight: '직전 대비 약세 지역 비중이 더 큽니다.' };
    return { signal: '가격 보합권', insight: '가격 변동이 크지 않아 관망 대응이 적합합니다.' };
  }

  if (latestValue !== null && latestValue >= 100.1) {
    return {
      signal: '수요 우위',
      insight: breadth.comparedCount > 0 ? `상승/개선 지역 ${breadth.upCount}곳 기준으로 수요가 더 강합니다.` : '기준선 100을 상회합니다.',
    };
  }
  if (latestValue !== null && latestValue <= 99.9) {
    return {
      signal: '공급 우위',
      insight: breadth.comparedCount > 0 ? `하락/약화 지역 ${breadth.downCount}곳 기준으로 공급 압력이 더 강합니다.` : '기준선 100을 하회합니다.',
    };
  }
  return { signal: '균형권', insight: '수요와 공급이 큰 방향성 없이 맞서는 구간입니다.' };
}

const RebStatsPanel = () => {
  const authFetch = useAuthStore((state) => state.authFetch);
  const navigate = useNavigate();
  const [summaries, setSummaries] = useState<PresetSummary[]>([]);
  const [serviceName, setServiceName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTableDataPage = async (statblId: string, page: number, options?: { size?: number; wrttimeIdtfrId?: string }) => {
    const params = new URLSearchParams({
      statblId,
      size: String(options?.size ?? 1000),
      page: String(page),
      type: 'json',
    });
    if (options?.wrttimeIdtfrId) params.set('wrttimeIdtfrId', options.wrttimeIdtfrId);

    const response = await authFetch(`${API_BASE}/api/public/reb/table-data?${params.toString()}`);
    const data = (await response.json()) as RebTableDataResponse;
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'REB 통계 데이터를 불러오지 못했습니다.');
    }
    return data;
  };

  const fetchLatestSideData = async (statblId: string) => {
    const firstPageData = await fetchTableDataPage(statblId, 1, { size: 1000 });
    const total = firstPageData.listTotalCount ?? firstPageData.rows.length;
    const lastPage = Math.max(1, Math.ceil(total / 1000));
    if (lastPage <= 1) return firstPageData;

    try {
      const lastPageData = await fetchTableDataPage(statblId, lastPage, { size: 1000 });
      const firstLatest = getLatestMonthFromRows(firstPageData.rows);
      const lastLatest = getLatestMonthFromRows(lastPageData.rows);
      return lastLatest && (!firstLatest || lastLatest > firstLatest) ? lastPageData : firstPageData;
    } catch {
      return firstPageData;
    }
  };

  const fetchPresetSummary = async (preset: (typeof PRESETS)[number]) => {
    const latestSideData = await fetchLatestSideData(preset.value);
    const ids = getLatestAndPreviousWrttimeIdFromRows(latestSideData.rows);

    let mergedRows = [...latestSideData.rows];
    if (ids.latestWrttimeId) {
      const latestData = await fetchTableDataPage(preset.value, 1, { wrttimeIdtfrId: ids.latestWrttimeId });
      mergedRows = [...latestData.rows];
      if (ids.previousWrttimeId && ids.previousWrttimeId !== ids.latestWrttimeId) {
        try {
          const prevData = await fetchTableDataPage(preset.value, 1, { wrttimeIdtfrId: ids.previousWrttimeId });
          mergedRows = [...mergedRows, ...prevData.rows];
        } catch {
          // ignore previous page fetch failure
        }
      }
      if (latestData.serviceName) setServiceName(latestData.serviceName);
    } else if (latestSideData.serviceName) {
      setServiceName(latestSideData.serviceName);
    }

    const momentum = buildMomentum(mergedRows);
    const sortedDesc = [...momentum].sort((a, b) => (b.changeRate ?? 0) - (a.changeRate ?? 0));
    const sortedAsc = [...momentum].sort((a, b) => (a.changeRate ?? 0) - (b.changeRate ?? 0));

    const latestMonth = momentum[0]?.latestMonth || getLatestMonthFromRows(mergedRows);
    const latestValues = momentum.filter((item) => item.latestMonth === latestMonth).map((item) => item.latestValue);
    const prevValues = momentum.filter((item) => item.prevMonth !== null && item.prevMonth !== item.latestMonth && item.prevValue !== null).map((item) => item.prevValue as number);

    const latestValue = latestValues.length > 0 ? latestValues.reduce((sum, value) => sum + value, 0) / latestValues.length : null;
    const prevValue = prevValues.length > 0 ? prevValues.reduce((sum, value) => sum + value, 0) / prevValues.length : null;
    const changeRate = latestValue !== null && prevValue !== null && prevValue !== 0
      ? ((latestValue - prevValue) / prevValue) * 100
      : null;

    const breadth = momentum.reduce(
      (acc, item) => {
        const rate = item.changeRate ?? 0;
        if (rate > 0.01) acc.upCount += 1;
        else if (rate < -0.01) acc.downCount += 1;
        else acc.flatCount += 1;
        return acc;
      },
      { upCount: 0, downCount: 0, flatCount: 0 }
    );

    const interpreted = interpretPreset(preset.key, latestValue, changeRate, {
      ...breadth,
      comparedCount: momentum.length,
    });

    return {
      key: preset.key,
      label: preset.label,
      description: preset.description,
      latestMonth,
      latestValue,
      prevValue,
      changeRate,
      comparedCount: momentum.length,
      upCount: breadth.upCount,
      downCount: breadth.downCount,
      flatCount: breadth.flatCount,
      signal: interpreted.signal,
      insight: interpreted.insight,
      topRiser: sortedDesc[0] || null,
      topFaller: sortedAsc[0] || null,
    } satisfies PresetSummary;
  };

  const fetchBrief = async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const result = await Promise.all(PRESETS.map((preset) => fetchPresetSummary(preset)));
      setSummaries(result);
    } catch (fetchError) {
      setSummaries([]);
      setError(fetchError instanceof Error ? fetchError.message : 'REB 통계 조회 실패');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchBrief();
  }, []);

  const priceSummary = useMemo(
    () => summaries.find((item) => item.key === 'sale-price') || null,
    [summaries]
  );

  return (
    <HudCard
      title="REB 시장 브리프"
      subtitle={serviceName ? `${serviceName} 기준 실무형 요약` : '한국부동산원 Open API 기반 지역 흐름 브리핑'}
      action={
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/real-estate/reb-market-stats')}
            leftIcon={<BarChart3 size={14} />}
          >
            상세 보기
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void fetchBrief(true)}
            disabled={isRefreshing}
            leftIcon={<RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />}
          >
            새로고침
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <div className="h-56 rounded-xl border border-hud-border-secondary bg-hud-bg-primary flex items-center justify-center gap-2 text-sm text-hud-text-muted">
          <Loader2 size={16} className="animate-spin" />
          REB 브리프를 불러오는 중...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-hud-accent-danger/40 bg-hud-accent-danger/10 px-4 py-3 text-sm text-hud-accent-danger flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {summaries.map((summary) => {
              const isPositive = (summary.changeRate ?? 0) >= 0;
              return (
                <div key={summary.key} className="rounded-2xl border border-hud-border-secondary bg-hud-bg-primary p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-hud-text-muted">{summary.label}</p>
                      <p className="text-lg font-semibold text-hud-text-primary mt-1">{summary.signal}</p>
                    </div>
                    <div className={`px-2 py-1 rounded-md text-xs ${isPositive ? 'bg-hud-accent-success/10 text-hud-accent-success' : 'bg-hud-accent-danger/10 text-hud-accent-danger'}`}>
                      {formatSigned(summary.changeRate, 2, '%')}
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-hud-text-primary mt-4">{formatNumber(summary.latestValue, 2)}</p>
                  <p className="text-xs text-hud-text-muted mt-1">
                    기준월 {summary.latestMonth || '-'} · 직전 {formatNumber(summary.prevValue, 2)}
                  </p>
                  <p className="text-xs text-hud-text-muted mt-3">{summary.insight}</p>
                  <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                    <div className="rounded-lg bg-hud-bg-secondary px-2 py-2">
                      <p className="text-[11px] text-hud-text-muted">개선</p>
                      <p className="text-sm font-semibold text-hud-accent-success mt-1">{summary.upCount}</p>
                    </div>
                    <div className="rounded-lg bg-hud-bg-secondary px-2 py-2">
                      <p className="text-[11px] text-hud-text-muted">약세</p>
                      <p className="text-sm font-semibold text-hud-accent-danger mt-1">{summary.downCount}</p>
                    </div>
                    <div className="rounded-lg bg-hud-bg-secondary px-2 py-2">
                      <p className="text-[11px] text-hud-text-muted">표본</p>
                      <p className="text-sm font-semibold text-hud-text-primary mt-1">{summary.comparedCount}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] gap-4">
            <div className="rounded-2xl border border-hud-border-secondary bg-hud-bg-primary p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-hud-text-primary">주목 지역</p>
                  <p className="text-xs text-hud-text-muted mt-1">매매 가격지수 기준으로 최근 변동이 큰 지역</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate('/real-estate/reb-market-stats')}>
                  전체 랭킹
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                <div className="rounded-xl border border-hud-accent-success/25 bg-hud-accent-success/5 p-3">
                  <div className="flex items-center gap-2 text-hud-accent-success">
                    <TrendingUp size={16} />
                    <p className="text-sm font-medium">상승 지역</p>
                  </div>
                  <div className="space-y-2 mt-3">
                    {priceSummary?.topRiser ? (
                      <div className="rounded-lg bg-hud-bg-primary px-3 py-3">
                        <p className="text-sm font-semibold text-hud-text-primary">{priceSummary.topRiser.label}</p>
                        <p className="text-xs text-hud-text-muted mt-1">
                          {formatNumber(priceSummary.topRiser.prevValue, 2)} → {formatNumber(priceSummary.topRiser.latestValue, 2)}
                        </p>
                        <p className="text-sm font-semibold text-hud-accent-success mt-2">
                          {formatSigned(priceSummary.topRiser.changeRate, 2, '%')}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-hud-text-muted">표시할 상승 지역이 없습니다.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-hud-accent-danger/25 bg-hud-accent-danger/5 p-3">
                  <div className="flex items-center gap-2 text-hud-accent-danger">
                    <TrendingDown size={16} />
                    <p className="text-sm font-medium">하락 지역</p>
                  </div>
                  <div className="space-y-2 mt-3">
                    {priceSummary?.topFaller ? (
                      <div className="rounded-lg bg-hud-bg-primary px-3 py-3">
                        <p className="text-sm font-semibold text-hud-text-primary">{priceSummary.topFaller.label}</p>
                        <p className="text-xs text-hud-text-muted mt-1">
                          {formatNumber(priceSummary.topFaller.prevValue, 2)} → {formatNumber(priceSummary.topFaller.latestValue, 2)}
                        </p>
                        <p className="text-sm font-semibold text-hud-accent-danger mt-2">
                          {formatSigned(priceSummary.topFaller.changeRate, 2, '%')}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-hud-text-muted">표시할 하락 지역이 없습니다.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-hud-border-secondary bg-hud-bg-primary p-4">
              <p className="text-sm font-semibold text-hud-text-primary">실무 해석</p>
              <div className="space-y-3 mt-4">
                {summaries.map((summary) => (
                  <div key={`insight-${summary.key}`} className="rounded-xl border border-hud-border-secondary bg-hud-bg-secondary px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-hud-text-primary">{summary.label}</p>
                      <span className="text-xs text-hud-text-muted">{summary.latestMonth || '-'}</span>
                    </div>
                    <p className="text-xs text-hud-text-muted mt-2">{summary.insight}</p>
                    {(summary.topRiser || summary.topFaller) && (
                      <div className="mt-3 space-y-1 text-xs">
                        {summary.topRiser && (
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-hud-text-secondary truncate">강한 지역: {summary.topRiser.label}</span>
                            <span className="text-hud-accent-success font-medium">{formatSigned(summary.topRiser.changeRate, 2, '%')}</span>
                          </div>
                        )}
                        {summary.topFaller && (
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-hud-text-secondary truncate">약한 지역: {summary.topFaller.label}</span>
                            <span className="text-hud-accent-danger font-medium">{formatSigned(summary.topFaller.changeRate, 2, '%')}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => navigate('/real-estate/reb-market-stats')}
                className="w-full mt-4 rounded-xl border border-hud-border-secondary bg-hud-bg-secondary px-4 py-3 text-left hover:bg-hud-bg-hover transition-hud"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-hud-text-primary">REB 시장 신호판 열기</p>
                    <p className="text-xs text-hud-text-muted mt-1">지역별 상승/하락 랭킹과 원본 데이터까지 확인</p>
                  </div>
                  <ArrowRight size={16} className="text-hud-text-muted flex-shrink-0" />
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </HudCard>
  );
};

export default RebStatsPanel;
