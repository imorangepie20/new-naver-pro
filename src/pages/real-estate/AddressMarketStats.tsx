import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  Building2,
  Loader2,
  MapPin,
  MousePointerClick,
  TrendingUp,
  Train,
  GraduationCap,
  Stethoscope,
  Cross,
  ShoppingBag,
  Coffee,
} from 'lucide-react';
import HudCard from '../../components/common/HudCard';
import Button from '../../components/common/Button';
import MapPointPicker from '../../components/real-estate/MapPointPicker';
import { API_BASE } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';

interface DistributionItem {
  name: string;
  count: number;
  ratio: number;
}

interface DistanceStatItem {
  band: string;
  count: number;
  avgPrice: number;
  medianPrice: number;
}

interface MonthlyTrendItem {
  month: string;
  avgPrice: number;
  transactionCount: number;
}

interface RecentTransactionItem {
  articleNo: string;
  articleName: string;
  buildingName: string | null;
  tradeTypeName: string;
  realEstateTypeName: string;
  price: number | null;
  rentPrc: number | null;
  area: number | null;
  distanceM: number | null;
  articleConfirmYmd: string | null;
  address: string;
}

interface MapSampleItem {
  id: string;
  articleNo: string;
  articleName: string;
  buildingName: string | null;
  tradeTypeCode: string;
  tradeTypeName: string;
  realEstateTypeCode: string;
  realEstateTypeName: string;
  price: number | null;
  rentPrc: number | null;
  area: number | null;
  latitude: number;
  longitude: number;
  distanceM: number;
  articleConfirmYmd: string | null;
  address: string;
}

interface AddressMarketResult {
  center: {
    latitude: number;
    longitude: number;
    source: 'query' | 'address';
    address: string | null;
  };
  filters: {
    radiusMeters: number;
    realEstateType: string | null;
    tradeType: string | null;
  };
  summary: {
    totalCount: number;
    avgPrice: number;
    medianPrice: number;
    minPrice: number;
    maxPrice: number;
    avgPricePerArea: number;
    infrastructure?: {
      subway: number;
      school: number;
      hospital: number;
      pharmacy: number;
      convenience: number;
      cafe: number;
    };
  };
  tradeDistribution: DistributionItem[];
  propertyTypeDistribution: DistributionItem[];
  distanceStats: DistanceStatItem[];
  monthlyTrend: MonthlyTrendItem[];
  recentTransactions: RecentTransactionItem[];
  mapSamples?: MapSampleItem[];
  sourceMeta?: {
    sourceType?: string;
    statblId?: string;
    serviceName?: string | null;
    analyzedRows?: number;
    region?: string | null;
    nearbyRegionCount?: number;
    infrastructureMessage?: string | null;
  };
}

interface MapPoint {
  latitude: number;
  longitude: number;
}

interface OfficeCenterResponse {
  center: {
    latitude: number;
    longitude: number;
  };
  office?: {
    companyName?: string | null;
    address?: string | null;
  };
}

const RADIUS_OPTIONS = [
  { label: '500m', value: 500 },
  { label: '1km', value: 1000 },
  { label: '2km', value: 2000 },
  { label: '3km', value: 3000 },
];

const PROPERTY_TYPE_OPTIONS = [
  { label: '전체', value: '' },
  { label: '아파트', value: 'APT' },
  { label: '오피스텔', value: 'OPST' },
  { label: '빌라', value: 'VL' },
  { label: '원룸', value: 'ONEROOM' },
  { label: '투룸', value: 'TWOROOM' },
  { label: '상가', value: 'SG' },
];

const TRADE_TYPE_OPTIONS = [
  { label: '전체', value: '' },
  { label: '매매', value: 'A1' },
  { label: '전세', value: 'B1' },
  { label: '월세', value: 'B2' },
];

const DISTRIBUTION_COLORS = [
  'var(--hud-accent-primary)',
  'var(--hud-accent-info)',
  'var(--hud-accent-success)',
  'var(--hud-accent-warning)',
  'var(--hud-accent-danger)',
  'var(--hud-text-secondary)',
];

interface DonutSegment extends DistributionItem {
  color: string;
  dashArray: string;
  dashOffset: number;
}

function buildDonutSegments(items: DistributionItem[]): { total: number; segments: DonutSegment[] } {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  if (total <= 0) return { total: 0, segments: [] };

  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  let progress = 0;

  const segments = items.map((item, index) => {
    const fraction = item.count / total;
    const arcLength = fraction * circumference;
    const segment: DonutSegment = {
      ...item,
      color: DISTRIBUTION_COLORS[index % DISTRIBUTION_COLORS.length],
      dashArray: `${arcLength} ${circumference - arcLength}`,
      dashOffset: -progress,
    };
    progress += arcLength;
    return segment;
  });

  return { total, segments };
}

function formatPriceMan(price: number | null | undefined) {
  if (!price || price <= 0) return '-';
  const uk = Math.floor(price / 10000);
  const man = price % 10000;
  if (uk > 0) return man > 0 ? `${uk}억 ${man.toLocaleString()}만` : `${uk}억`;
  return `${price.toLocaleString()}만`;
}

function formatYmd(ymd: string | null) {
  if (!ymd || !/^\d{8}$/.test(ymd)) return '-';
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}

function marketSourceMetaText(sourceType?: string) {
  if (!sourceType) return '국토부 실거래가 기준';
  if (sourceType.includes('molit')) return '국토부 실거래가 기준';
  if (sourceType.includes('LOCAL_DB')) return '내 DB 기반 추정';
  if (sourceType.includes('reb')) return 'REB 통계 기준';
  return '외부 데이터 기준';
}

const AddressMarketStats = () => {
  const authFetch = useAuthStore((state) => state.authFetch);

  const [isInitLoading, setIsInitLoading] = useState(true);
  const [officeInfo, setOfficeInfo] = useState<{ companyName?: string | null; address?: string | null } | null>(null);
  const [officeCenter, setOfficeCenter] = useState<MapPoint | null>(null);

  const [mapCenter, setMapCenter] = useState<MapPoint | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null);
  const [pointOrigin, setPointOrigin] = useState<'office' | 'manual'>('office');

  const [radiusMeters, setRadiusMeters] = useState(1000);
  const [realEstateType, setRealEstateType] = useState('');
  const [tradeType, setTradeType] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AddressMarketResult | null>(null);
  const [selectedMapSample, setSelectedMapSample] = useState<MapSampleItem | null>(null);

  const analyzeAroundPoint = async (point: MapPoint, monthsBack = '2') => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setSelectedMapSample(null);

    try {
      const params = new URLSearchParams({
        lat: String(point.latitude),
        lng: String(point.longitude),
        radiusMeters: String(radiusMeters),
        source: 'molit',
        monthsBack,
      });

      if (realEstateType) params.set('realEstateType', realEstateType);
      if (tradeType) params.set('tradeType', tradeType);

      const response = await authFetch(`${API_BASE}/api/statistics/address-market?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) throw new Error('로그인이 만료되었습니다. 다시 로그인해 주세요.');
        throw new Error(data.error || '지도 기반 통계 조회 실패');
      }

      const parsed = data as AddressMarketResult;
      setResult(parsed);
      setMapCenter(point);
      setSelectedPoint(point);
      return parsed;
    } catch (analyzeError) {
      console.error('Address market analysis failed:', analyzeError);
      setError(analyzeError instanceof Error ? analyzeError.message : '분석 요청 실패');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const loadInitialOfficeCenter = async () => {
      setIsInitLoading(true);
      setError(null);
      try {
        const response = await authFetch(`${API_BASE}/api/statistics/office-center?ts=${Date.now()}`);
        const data = await response.json();

        if (!mounted) return;

        if (!response.ok) {
          if (response.status === 401) {
            setError('로그인이 만료되었습니다. 다시 로그인해 주세요.');
          } else {
            setError(data.error || '사무실 위치를 불러오지 못했습니다. 프로필의 사무실 주소를 확인해 주세요.');
          }
          return;
        }

        const officeData = data as OfficeCenterResponse;
        if (!officeData?.center?.latitude || !officeData?.center?.longitude) {
          setError('사무실 위치를 불러오지 못했습니다. 프로필의 사무실 주소를 확인해 주세요.');
          return;
        }

        setOfficeInfo(officeData.office || null);
        setOfficeCenter(officeData.center);
        setMapCenter(officeData.center);
        setSelectedPoint(officeData.center);
        setPointOrigin('office');
        await analyzeAroundPoint(officeData.center, '2');
      } catch (initError) {
        console.error('Office center load failed:', initError);
        if (mounted) {
          setError('사무실 위치를 불러오지 못했습니다. 프로필의 사무실 주소를 확인해 주세요.');
        }
      } finally {
        if (mounted) setIsInitLoading(false);
      }
    };

    void loadInitialOfficeCenter();
    return () => {
      mounted = false;
    };
  }, [authFetch]);

  useEffect(() => {
    if (!selectedPoint || isInitLoading) return;
    void analyzeAroundPoint(selectedPoint);
  }, [radiusMeters, realEstateType, tradeType]);

  const monthlyChart = useMemo(() => {
    if (!result || result.monthlyTrend.length === 0) return null;

    const series = result.monthlyTrend;
    const priceValues = series.map((x) => x.avgPrice);
    const txValues = series.map((x) => x.transactionCount);
    const minPrice = Math.min(...priceValues);
    const maxPrice = Math.max(...priceValues);
    const maxTx = Math.max(1, ...txValues);
    const priceSpan = Math.max(1, maxPrice - minPrice);

    const left = 6;
    const right = 96;
    const chartWidth = right - left;
    const barTop = 60;
    const barBottom = 94;
    const lineTop = 8;
    const lineBottom = 54;
    const lineHeight = lineBottom - lineTop;
    const step = chartWidth / series.length;
    const barGap = Math.min(1.5, step * 0.2);
    const barWidth = Math.max(1.2, step - barGap);

    const bars = series.map((item, idx) => {
      const x = left + idx * step + barGap / 2;
      const barHeight = Math.max(0.6, (item.transactionCount / maxTx) * (barBottom - barTop));
      const y = barBottom - barHeight;
      const cx = x + barWidth / 2;
      const cy = lineBottom - ((item.avgPrice - minPrice) / priceSpan) * lineHeight;
      return { x, y, width: barWidth, height: barHeight, cx, cy, month: item.month, transactionCount: item.transactionCount };
    });

    const linePoints = bars.map((b) => `${b.cx},${b.cy}`).join(' ');
    const areaPath = `M ${bars[0].cx} ${lineBottom} L ${bars.map((b) => `${b.cx} ${b.cy}`).join(' L ')} L ${bars[bars.length - 1].cx} ${lineBottom} Z`;

    return {
      bars,
      linePoints,
      areaPath,
      minPrice,
      maxPrice,
      maxTx,
      startMonth: series[0]?.month || '',
      endMonth: series[series.length - 1]?.month || '',
    };
  }, [result]);

  const tradeDonut = useMemo(
    () => buildDonutSegments(result?.tradeDistribution || []),
    [result]
  );

  const propertyDonut = useMemo(
    () => buildDonutSegments(result?.propertyTypeDistribution || []),
    [result]
  );

  const mapMarkerPoints = useMemo(() => {
    if (!result?.mapSamples || result.mapSamples.length === 0) return [];
    return result.mapSamples.map((item) => ({
      id: item.id,
      latitude: item.latitude,
      longitude: item.longitude,
      label: item.articleName || '주변 매물',
    }));
  }, [result]);

  const hasDistanceValues = useMemo(() => {
    if (!result) return false;
    return result.recentTransactions.some((tx) => typeof tx.distanceM === 'number' && tx.distanceM > 0);
  }, [result]);

  const handleAnalyze = async () => {
    if (!selectedPoint) {
      setError('사무실 위치를 먼저 확인해 주세요.');
      return;
    }
    await analyzeAroundPoint(selectedPoint);
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-hud-text-primary">통계분석</h1>
        <p className="text-sm text-hud-text-muted mt-1">국토부 실거래가 데이터를 기준으로 지도 반경 통계를 분석합니다.</p>
      </div>

      <HudCard>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm text-hud-text-primary font-medium">{officeInfo?.companyName || '내 사무실'}</p>
            <p className="text-xs text-hud-text-muted">{officeInfo?.address || '프로필의 사무실 주소 기준으로 분석합니다.'}</p>
            <p className="text-xs text-hud-text-muted">
              현재 기준: {pointOrigin === 'office' ? '사무실 위치' : '수동 선택 위치'}
            </p>
          </div>
          {officeCenter && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<MapPin size={14} />}
              onClick={() => {
                setMapCenter(officeCenter);
                setSelectedPoint(officeCenter);
                setPointOrigin('office');
                void analyzeAroundPoint(officeCenter);
              }}
            >
              사무실 위치로 복원
            </Button>
          )}
        </div>
      </HudCard>

      <HudCard>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm text-hud-text-secondary">
            <MousePointerClick size={15} />
            지도에서 비교할 중심점을 클릭할 수 있습니다.
          </div>
          {selectedPoint && (
            <div className="text-xs text-hud-text-muted font-mono">
              {selectedPoint.latitude.toFixed(6)}, {selectedPoint.longitude.toFixed(6)}
            </div>
          )}
        </div>

        {mapCenter ? (
          <MapPointPicker
            center={mapCenter}
            selectedPoint={selectedPoint}
            points={mapMarkerPoints}
            activePointId={selectedMapSample?.id || null}
            onPointClick={(point) => {
              const matched = result?.mapSamples?.find((item) => item.id === point.id) || null;
              setSelectedMapSample(matched);
            }}
            radiusMeters={radiusMeters}
            onSelect={(point) => {
              setSelectedPoint(point);
              setPointOrigin('manual');
              setSelectedMapSample(null);
            }}
          />
        ) : (
          <div className="h-[380px] rounded-xl border border-hud-border-secondary bg-hud-bg-primary flex items-center justify-center text-sm text-hud-text-muted">
            사무실 위치를 불러오지 못했습니다. 프로필의 사무실 주소를 확인해 주세요.
          </div>
        )}

        {result && (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-hud-text-muted">
            <span>지도 표본 마커: {(result.mapSamples || []).length.toLocaleString()}건</span>
            <span>마커 출처: 내 DB 좌표 표본</span>
            <span>마커 클릭 시 상세 정보가 표시됩니다.</span>
          </div>
        )}

        {selectedMapSample && (
          <div className="mt-3 rounded-lg border border-hud-border-secondary bg-transparent p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-hud-text-primary">{selectedMapSample.articleName}</p>
                <p className="text-xs text-hud-text-muted mt-0.5">
                  {selectedMapSample.realEstateTypeName} / {selectedMapSample.tradeTypeName}
                </p>
                <p className="text-xs text-hud-text-muted mt-1">{selectedMapSample.address}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-hud-accent-primary">
                  {formatPriceMan(selectedMapSample.price)}
                  {selectedMapSample.rentPrc ? ` / ${selectedMapSample.rentPrc.toLocaleString()}만` : ''}
                </p>
                <p className="text-xs text-hud-text-muted mt-0.5">
                  {selectedMapSample.area ? `${selectedMapSample.area.toFixed(2)}㎡` : '-'} · {selectedMapSample.distanceM.toLocaleString()}m
                </p>
                <p className="text-xs text-hud-text-muted">{formatYmd(selectedMapSample.articleConfirmYmd)}</p>
              </div>
            </div>
          </div>
        )}
      </HudCard>

      <HudCard>
        <div className="grid grid-cols-1 lg:grid-cols-[180px_180px_180px_auto] gap-3 items-end">
          <select
            value={radiusMeters}
            onChange={(e) => setRadiusMeters(parseInt(e.target.value, 10))}
            className="w-full px-3 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:border-hud-accent-primary"
          >
            {RADIUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <select
            value={realEstateType}
            onChange={(e) => setRealEstateType(e.target.value)}
            className="w-full px-3 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:border-hud-accent-primary"
          >
            {PROPERTY_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <select
            value={tradeType}
            onChange={(e) => setTradeType(e.target.value)}
            className="w-full px-3 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:border-hud-accent-primary"
          >
            {TRADE_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <div className="flex justify-end">
            <Button onClick={handleAnalyze} disabled={isLoading || isInitLoading || !selectedPoint} leftIcon={isLoading ? <Loader2 size={14} className="animate-spin" /> : <BarChart3 size={14} />}>
              {isLoading ? '분석 중...' : '주변 통계 분석'}
            </Button>
          </div>
        </div>
      </HudCard>

      {isInitLoading && (
        <div className="rounded-lg border border-hud-border-secondary bg-hud-bg-secondary px-4 py-3 text-sm text-hud-text-muted flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          사무실 위치를 불러오는 중...
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-hud-accent-danger/40 bg-hud-accent-danger/10 px-4 py-3 text-hud-accent-danger text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <>
          {result.sourceMeta && (
            <HudCard className="p-3">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-2 py-1 rounded-md border border-hud-accent-info/40 bg-hud-accent-info/10 text-hud-accent-info">
                    소스: {marketSourceMetaText(result.sourceMeta.sourceType)}
                  </span>
                  {result.sourceMeta.serviceName && <span className="text-hud-text-muted">제공처: {result.sourceMeta.serviceName}</span>}
                  {result.sourceMeta.region && <span className="text-hud-text-muted">지역: {result.sourceMeta.region}</span>}
                  {result.sourceMeta.statblId && <span className="text-hud-text-muted font-mono">표: {result.sourceMeta.statblId}</span>}
                  {typeof result.sourceMeta.analyzedRows === 'number' && <span className="text-hud-text-muted">분석 표본: {result.sourceMeta.analyzedRows.toLocaleString()}건</span>}
                  {typeof result.sourceMeta.nearbyRegionCount === 'number' && <span className="text-hud-text-muted">인접 지역: {result.sourceMeta.nearbyRegionCount}개</span>}
                </div>
                {result.sourceMeta.infrastructureMessage && (
                  <div className="rounded-md border border-hud-accent-warning/40 bg-hud-accent-warning/10 px-2 py-1 text-xs text-hud-accent-warning">
                    인프라 집계 실패: {result.sourceMeta.infrastructureMessage}
                  </div>
                )}
              </div>
            </HudCard>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <HudCard className="p-4"><p className="text-xs text-hud-text-muted">매물 수</p><p className="text-xl font-bold text-hud-text-primary mt-1">{result.summary.totalCount.toLocaleString()}</p></HudCard>
            <HudCard className="p-4"><p className="text-xs text-hud-text-muted">평균가</p><p className="text-xl font-bold text-hud-accent-primary mt-1">{formatPriceMan(result.summary.avgPrice)}</p></HudCard>
            <HudCard className="p-4"><p className="text-xs text-hud-text-muted">중위가</p><p className="text-xl font-bold text-hud-accent-info mt-1">{formatPriceMan(result.summary.medianPrice)}</p></HudCard>
            <HudCard className="p-4"><p className="text-xs text-hud-text-muted">최저가</p><p className="text-xl font-bold text-hud-accent-success mt-1">{formatPriceMan(result.summary.minPrice)}</p></HudCard>
            <HudCard className="p-4"><p className="text-xs text-hud-text-muted">최고가</p><p className="text-xl font-bold text-hud-accent-warning mt-1">{formatPriceMan(result.summary.maxPrice)}</p></HudCard>
            <HudCard className="p-4"><p className="text-xs text-hud-text-muted">평균 평단가(만원/㎡)</p><p className="text-xl font-bold text-hud-text-primary mt-1">{result.summary.avgPricePerArea.toLocaleString()}</p></HudCard>
          </div>

          {result.summary.infrastructure && (
            <HudCard title="주요 상권 및 표본 인프라" subtitle={`반경 ${result.filters.radiusMeters}m 내외`}>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                <div className="flex flex-col items-center justify-center p-3 bg-hud-bg-primary border border-hud-border-secondary rounded-lg"><Train className="w-5 h-5 text-hud-text-secondary mb-1" /><span className="text-xs text-hud-text-muted">지하철역</span><span className="text-sm font-semibold text-hud-text-primary mt-0.5">{result.summary.infrastructure.subway}개</span></div>
                <div className="flex flex-col items-center justify-center p-3 bg-hud-bg-primary border border-hud-border-secondary rounded-lg"><GraduationCap className="w-5 h-5 text-hud-text-secondary mb-1" /><span className="text-xs text-hud-text-muted">학교</span><span className="text-sm font-semibold text-hud-text-primary mt-0.5">{result.summary.infrastructure.school}개</span></div>
                <div className="flex flex-col items-center justify-center p-3 bg-hud-bg-primary border border-hud-border-secondary rounded-lg"><Stethoscope className="w-5 h-5 text-hud-text-secondary mb-1" /><span className="text-xs text-hud-text-muted">병원</span><span className="text-sm font-semibold text-hud-text-primary mt-0.5">{result.summary.infrastructure.hospital}개</span></div>
                <div className="flex flex-col items-center justify-center p-3 bg-hud-bg-primary border border-hud-border-secondary rounded-lg"><Cross className="w-5 h-5 text-hud-accent-danger mb-1" /><span className="text-xs text-hud-text-muted">약국</span><span className="text-sm font-semibold text-hud-text-primary mt-0.5">{result.summary.infrastructure.pharmacy}개</span></div>
                <div className="flex flex-col items-center justify-center p-3 bg-hud-bg-primary border border-hud-border-secondary rounded-lg"><ShoppingBag className="w-5 h-5 text-hud-accent-warning mb-1" /><span className="text-xs text-hud-text-muted">편의점</span><span className="text-sm font-semibold text-hud-text-primary mt-0.5">{result.summary.infrastructure.convenience}개</span></div>
                <div className="flex flex-col items-center justify-center p-3 bg-hud-bg-primary border border-hud-border-secondary rounded-lg"><Coffee className="w-5 h-5 text-hud-text-secondary mb-1" /><span className="text-xs text-hud-text-muted">카페</span><span className="text-sm font-semibold text-hud-text-primary mt-0.5">{result.summary.infrastructure.cafe}개</span></div>
              </div>
            </HudCard>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <HudCard title="월별 평균가 추이" subtitle={`평균가(선) · 거래건수(막대) / 중심 ${result.center.latitude.toFixed(5)}, ${result.center.longitude.toFixed(5)}`}>
              {result.monthlyTrend.length === 0 ? (
                <p className="text-sm text-hud-text-muted">월별 추이 데이터가 없습니다.</p>
              ) : (
                <div>
                  <div className="h-40 bg-hud-bg-primary border border-hud-border-secondary rounded-lg p-3">
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
                      <defs>
                        <linearGradient id="monthly-area-gradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--hud-accent-primary)" stopOpacity="0.28" />
                          <stop offset="100%" stopColor="var(--hud-accent-primary)" stopOpacity="0.03" />
                        </linearGradient>
                      </defs>
                      <line x1="6" y1="54" x2="96" y2="54" stroke="var(--hud-border-secondary)" strokeOpacity="0.9" strokeWidth="0.6" />
                      <line x1="6" y1="74" x2="96" y2="74" stroke="var(--hud-border-secondary)" strokeOpacity="0.5" strokeWidth="0.4" />
                      <line x1="6" y1="94" x2="96" y2="94" stroke="var(--hud-border-secondary)" strokeOpacity="0.7" strokeWidth="0.5" />
                      {monthlyChart?.bars.map((bar) => (
                        <rect
                          key={`${bar.month}-bar`}
                          x={bar.x}
                          y={bar.y}
                          width={bar.width}
                          height={bar.height}
                          rx="0.9"
                          fill="var(--hud-accent-info)"
                          fillOpacity="0.35"
                        />
                      ))}
                      {monthlyChart && <path d={monthlyChart.areaPath} fill="url(#monthly-area-gradient)" />}
                      {monthlyChart && (
                        <polyline
                          points={monthlyChart.linePoints}
                          fill="none"
                          stroke="var(--hud-accent-primary)"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}
                      {monthlyChart?.bars.map((bar) => (
                        <circle key={`${bar.month}-dot`} cx={bar.cx} cy={bar.cy} r="0.9" fill="var(--hud-accent-primary)" />
                      ))}
                    </svg>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-hud-text-muted">
                    <span>시작: {monthlyChart?.startMonth || '-'}</span>
                    <span className="text-right">최근: {monthlyChart?.endMonth || '-'}</span>
                    <span>최저 평균가: {formatPriceMan(monthlyChart?.minPrice || 0)}</span>
                    <span className="text-right">최대 월 거래: {(monthlyChart?.maxTx || 0).toLocaleString()}건</span>
                  </div>
                </div>
              )}
            </HudCard>

            <HudCard title="거래유형 분포" subtitle="반경 내 비중">
              {tradeDonut.total === 0 ? (
                <p className="text-sm text-hud-text-muted">거래유형 데이터가 없습니다.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-3 items-center">
                  <div className="mx-auto w-[140px] h-[140px]">
                    <svg viewBox="0 0 100 100" className="w-full h-full">
                      <circle cx="50" cy="50" r="34" fill="none" stroke="var(--hud-border-secondary)" strokeOpacity="0.35" strokeWidth="12" />
                      {tradeDonut.segments.map((segment) => (
                        <circle
                          key={`trade-${segment.name}`}
                          cx="50"
                          cy="50"
                          r="34"
                          fill="none"
                          stroke={segment.color}
                          strokeWidth="12"
                          strokeLinecap="butt"
                          strokeDasharray={segment.dashArray}
                          strokeDashoffset={segment.dashOffset}
                          transform="rotate(-90 50 50)"
                        />
                      ))}
                      <text x="50" y="48" textAnchor="middle" className="fill-hud-text-muted text-[5px]">총 표본</text>
                      <text x="50" y="58" textAnchor="middle" className="fill-hud-text-primary text-[8px] font-semibold">{tradeDonut.total.toLocaleString()}건</text>
                    </svg>
                  </div>
                  <div className="space-y-1.5">
                    {tradeDonut.segments.map((item) => (
                      <div key={`trade-legend-${item.name}`} className="flex items-center justify-between text-xs">
                        <span className="inline-flex items-center gap-2 text-hud-text-secondary">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                          {item.name}
                        </span>
                        <span className="text-hud-text-muted">{item.count.toLocaleString()}건 ({item.ratio}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </HudCard>

            <HudCard title="매물유형 분포" subtitle="반경 내 비중">
              {propertyDonut.total === 0 ? (
                <p className="text-sm text-hud-text-muted">매물유형 데이터가 없습니다.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-3 items-center">
                  <div className="mx-auto w-[140px] h-[140px]">
                    <svg viewBox="0 0 100 100" className="w-full h-full">
                      <circle cx="50" cy="50" r="34" fill="none" stroke="var(--hud-border-secondary)" strokeOpacity="0.35" strokeWidth="12" />
                      {propertyDonut.segments.map((segment) => (
                        <circle
                          key={`property-${segment.name}`}
                          cx="50"
                          cy="50"
                          r="34"
                          fill="none"
                          stroke={segment.color}
                          strokeWidth="12"
                          strokeLinecap="butt"
                          strokeDasharray={segment.dashArray}
                          strokeDashoffset={segment.dashOffset}
                          transform="rotate(-90 50 50)"
                        />
                      ))}
                      <text x="50" y="48" textAnchor="middle" className="fill-hud-text-muted text-[5px]">총 표본</text>
                      <text x="50" y="58" textAnchor="middle" className="fill-hud-text-primary text-[8px] font-semibold">{propertyDonut.total.toLocaleString()}건</text>
                    </svg>
                  </div>
                  <div className="space-y-1.5">
                    {propertyDonut.segments.map((item) => (
                      <div key={`property-legend-${item.name}`} className="flex items-center justify-between text-xs">
                        <span className="inline-flex items-center gap-2 text-hud-text-secondary">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                          {item.name}
                        </span>
                        <span className="text-hud-text-muted">{item.count.toLocaleString()}건 ({item.ratio}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </HudCard>
          </div>

          <HudCard title="거리 구간별 시세" subtitle="반경 내 평균가/중위가 비교">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b border-hud-border-secondary">
                    <th className="text-left py-2 text-xs text-hud-text-muted">거리 구간</th>
                    <th className="text-right py-2 text-xs text-hud-text-muted">매물 수</th>
                    <th className="text-right py-2 text-xs text-hud-text-muted">평균가</th>
                    <th className="text-right py-2 text-xs text-hud-text-muted">중위가</th>
                  </tr>
                </thead>
                <tbody>
                  {result.distanceStats.map((item) => (
                    <tr key={item.band} className="border-b border-hud-border-secondary/50">
                      <td className="py-2 text-sm text-hud-text-primary">{item.band}</td>
                      <td className="py-2 text-sm text-hud-text-primary text-right">{item.count.toLocaleString()}</td>
                      <td className="py-2 text-sm text-hud-text-primary text-right">{formatPriceMan(item.avgPrice)}</td>
                      <td className="py-2 text-sm text-hud-text-primary text-right">{formatPriceMan(item.medianPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </HudCard>

          <HudCard title="최근 거래/등록 표본" subtitle="중심점 주변 최신순 30건">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px]">
                <thead>
                  <tr className="border-b border-hud-border-secondary">
                    <th className="text-left py-2 px-1 text-xs text-hud-text-muted">확정일</th>
                    <th className="text-left py-2 px-1 text-xs text-hud-text-muted">매물</th>
                    <th className="text-left py-2 px-1 text-xs text-hud-text-muted">유형/거래</th>
                    <th className="text-right py-2 px-1 text-xs text-hud-text-muted">가격</th>
                    <th className="text-right py-2 px-1 text-xs text-hud-text-muted">면적</th>
                    {hasDistanceValues && (
                      <th className="text-right py-2 px-1 text-xs text-hud-text-muted">거리</th>
                    )}
                    <th className="text-left py-2 px-1 text-xs text-hud-text-muted">주소</th>
                  </tr>
                </thead>
                <tbody>
                  {result.recentTransactions.map((tx) => (
                    <tr key={`${tx.articleNo}-${tx.articleConfirmYmd}`} className="border-b border-hud-border-secondary/40">
                      <td className="py-2 px-1 text-xs text-hud-text-secondary">{formatYmd(tx.articleConfirmYmd)}</td>
                      <td className="py-2 px-1 text-sm text-hud-text-primary">
                        <div className="max-w-[260px] truncate" title={tx.articleName}>{tx.articleName}</div>
                        {tx.buildingName && <div className="text-xs text-hud-text-muted truncate max-w-[260px]" title={tx.buildingName}><Building2 size={11} className="inline mr-1" />{tx.buildingName}</div>}
                      </td>
                      <td className="py-2 px-1 text-xs text-hud-text-secondary">{tx.realEstateTypeName} / {tx.tradeTypeName}</td>
                      <td className="py-2 px-1 text-sm text-hud-accent-primary text-right">{formatPriceMan(tx.price)}{tx.rentPrc ? ` / ${tx.rentPrc}만` : ''}</td>
                      <td className="py-2 px-1 text-sm text-hud-text-primary text-right">{tx.area ? `${tx.area.toFixed(2)}㎡` : '-'}</td>
                      {hasDistanceValues && (
                        <td className="py-2 px-1 text-sm text-hud-text-primary text-right">
                          {typeof tx.distanceM === 'number' && tx.distanceM > 0 ? `${tx.distanceM.toLocaleString()}m` : '-'}
                        </td>
                      )}
                      <td className="py-2 px-1 text-xs text-hud-text-muted"><div className="max-w-[280px] truncate" title={tx.address}>{tx.address || '-'}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </HudCard>
        </>
      )}

      {!result && !isLoading && !isInitLoading && (
        <HudCard className="p-8 text-center">
          <TrendingUp className="w-8 h-8 mx-auto text-hud-accent-primary mb-2" />
          <p className="text-hud-text-primary font-medium">사무실 기준 위치를 확인한 뒤 주변 통계 분석을 실행해 주세요.</p>
        </HudCard>
      )}
    </div>
  );
};

export default AddressMarketStats;
