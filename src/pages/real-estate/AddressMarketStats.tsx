import { useEffect, useMemo, useRef, useState } from 'react';
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
import { loadNaverMapsSdk } from '../../lib/map/loadNaverMapsSdk';
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

interface SegmentStatItem {
  realEstateTypeName: string;
  tradeTypeName: string;
  count: number;
  ratio: number;
  avgPrice: number;
  medianPrice: number;
  minPrice: number;
  maxPrice: number;
  avgPricePerArea: number;
  avgRentPrc: number;
  recentMonth: string | null;
}

interface SegmentMonthlyTrendItem extends MonthlyTrendItem {
  realEstateTypeName: string;
  tradeTypeName: string;
}

interface SegmentDistanceStatItem extends DistanceStatItem {
  realEstateTypeName: string;
  tradeTypeName: string;
}

interface ApartmentComplexStatItem {
  complexName: string;
  tradeTypeName: string;
  count: number;
  ratio: number;
  avgPrice: number;
  medianPrice: number;
  minPrice: number;
  maxPrice: number;
  avgPricePerArea: number;
  avgRentPrc: number;
  recentMonth: string | null;
  recentYmd: string | null;
  address: string | null;
}

interface ApartmentComplexPreviewItem {
  complexName: string;
  address: string | null;
  totalCount: number;
  avgPrice: number;
  latestYmd: string | null;
  tradeTypes: string[];
}

interface ApartmentComplexMarkerItem {
  complexName: string;
  address: string | null;
  latitude: number;
  longitude: number;
  totalCount: number;
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
  latitude: number | null;
  longitude: number | null;
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
    regionName?: string | null;
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
  segmentStats?: SegmentStatItem[];
  segmentMonthlyTrend?: SegmentMonthlyTrendItem[];
  segmentDistanceStats?: SegmentDistanceStatItem[];
  apartmentComplexStats?: ApartmentComplexStatItem[];
  distanceStats: DistanceStatItem[];
  monthlyTrend: MonthlyTrendItem[];
  recentTransactions: RecentTransactionItem[];
  sourceMeta?: {
    sourceType?: string;
    statblId?: string;
    serviceName?: string | null;
    analyzedRows?: number;
    region?: string | null;
    nearbyRegionCount?: number;
    nearbyRegions?: string[];
    selectedRegion?: string | null;
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

interface BoundaryPoint {
  latitude: number;
  longitude: number;
}

interface AddressMarketBoundaryResponse {
  regionName: string;
  regionCode: string;
  center: BoundaryPoint;
  boundaryType?: string;
  paths?: number[][][];
  geojson?: {
    type?: string;
    features?: Array<{
      geometry?: {
        type?: string;
        coordinates?: unknown;
      };
    }>;
  };
}

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

const DEFAULT_MAP_CENTER: MapPoint = {
  latitude: 37.5665,
  longitude: 126.978,
};

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

function formatMonthLabel(month: string | null | undefined) {
  if (!month) return '-';
  if (/^\d{4}-\d{2}$/.test(month)) return month.replace('-', '.');
  return month;
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
  const authChecked = useAuthStore((state) => state.authChecked);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [isInitLoading, setIsInitLoading] = useState(true);
  const [officeInfo, setOfficeInfo] = useState<{ companyName?: string | null; address?: string | null } | null>(null);
  const [officeCenter, setOfficeCenter] = useState<MapPoint | null>(null);

  const [mapCenter, setMapCenter] = useState<MapPoint | null>(DEFAULT_MAP_CENTER);
  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null);
  const [pointOrigin, setPointOrigin] = useState<'office' | 'manual'>('office');

  const [selectedRegion, setSelectedRegion] = useState('');
  const [nearbyRegions, setNearbyRegions] = useState<string[]>([]);
  const [realEstateType, setRealEstateType] = useState('');
  const [tradeType, setTradeType] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AddressMarketResult | null>(null);
  const [selectedSegmentKey, setSelectedSegmentKey] = useState<string | null>(null);
  const [boundaryPaths, setBoundaryPaths] = useState<BoundaryPoint[][]>([]);
  const [boundaryLabel, setBoundaryLabel] = useState<string | null>(null);
  const skipRegionAutoAnalyzeRef = useRef(false);

  const analyzeAroundPoint = async (point: MapPoint, monthsBack = '2') => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const params = new URLSearchParams({
        lat: String(point.latitude),
        lng: String(point.longitude),
        source: 'molit',
        monthsBack,
      });

      if (selectedRegion) params.set('regionName', selectedRegion);
      if (realEstateType) params.set('realEstateType', realEstateType);
      if (tradeType) params.set('tradeType', tradeType);

      const response = await authFetch(`${API_BASE}/api/statistics/address-market?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) throw new Error('로그인이 만료되었습니다. 다시 로그인해 주세요.');
        throw new Error(data.error || '지도 기반 통계 조회 실패');
      }

      const parsed = data as AddressMarketResult;
      const regionOptions = parsed.sourceMeta?.nearbyRegions || [];
      const resolvedRegion = parsed.filters.regionName || parsed.sourceMeta?.selectedRegion || parsed.sourceMeta?.region || '';
      setNearbyRegions(regionOptions);
      if (resolvedRegion && resolvedRegion !== selectedRegion) {
        skipRegionAutoAnalyzeRef.current = true;
        setSelectedRegion(resolvedRegion);
      }
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
    if (!authChecked) return;

    if (!isAuthenticated) {
      setIsInitLoading(false);
      setError('로그인이 필요합니다.');
      return;
    }

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
          setPointOrigin('manual');
          return;
        }

        const officeData = data as OfficeCenterResponse;
        if (!officeData?.center?.latitude || !officeData?.center?.longitude) {
          setError('사무실 위치를 불러오지 못했습니다. 프로필의 사무실 주소를 확인해 주세요.');
          setPointOrigin('manual');
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
          setPointOrigin('manual');
        }
      } finally {
        if (mounted) setIsInitLoading(false);
      }
    };

    void loadInitialOfficeCenter();
    return () => {
      mounted = false;
    };
  }, [authChecked, authFetch, isAuthenticated]);

  useEffect(() => {
    if (!authChecked || !isAuthenticated || !selectedPoint || isInitLoading) return;
    void analyzeAroundPoint(selectedPoint);
  }, [authChecked, isAuthenticated, realEstateType, tradeType]);

  useEffect(() => {
    if (!authChecked || !isAuthenticated) return;
    if (skipRegionAutoAnalyzeRef.current) {
      skipRegionAutoAnalyzeRef.current = false;
      return;
    }
    if (!selectedPoint || isInitLoading) return;
    void analyzeAroundPoint(selectedPoint);
  }, [authChecked, isAuthenticated, selectedPoint, isInitLoading, selectedRegion]);

  const tradeDonut = useMemo(
    () => buildDonutSegments(result?.tradeDistribution || []),
    [result]
  );

  const propertyDonut = useMemo(
    () => buildDonutSegments(result?.propertyTypeDistribution || []),
    [result]
  );

  const segmentStats = result?.segmentStats || [];
  const segmentMonthlyTrend = result?.segmentMonthlyTrend || [];
  const segmentDistanceStats = result?.segmentDistanceStats || [];
  const apartmentComplexStats = result?.apartmentComplexStats || [];

  const selectedSegment = useMemo(() => {
    if (segmentStats.length === 0) return null;
    if (!selectedSegmentKey) return segmentStats[0];
    return segmentStats.find((item) => `${item.realEstateTypeName}__${item.tradeTypeName}` === selectedSegmentKey) || segmentStats[0];
  }, [segmentStats, selectedSegmentKey]);

  useEffect(() => {
    if (segmentStats.length === 0) {
      setSelectedSegmentKey(null);
      return;
    }

    const preferred = segmentStats.find((item) => {
      const typeMatches = !realEstateType || item.realEstateTypeName === PROPERTY_TYPE_OPTIONS.find((opt) => opt.value === realEstateType)?.label;
      const tradeMatches = !tradeType || item.tradeTypeName === TRADE_TYPE_OPTIONS.find((opt) => opt.value === tradeType)?.label;
      return typeMatches && tradeMatches;
    }) || segmentStats[0];

    setSelectedSegmentKey(`${preferred.realEstateTypeName}__${preferred.tradeTypeName}`);
  }, [segmentStats, realEstateType, tradeType]);

  const segmentMatrix = useMemo(() => {
    if (!result || segmentStats.length === 0) return null;

    const tradeNames = Array.from(new Set([
      ...result.tradeDistribution.map((item) => item.name),
      ...segmentStats.map((item) => item.tradeTypeName),
    ]));

    const propertyNames = Array.from(new Set([
      ...result.propertyTypeDistribution.map((item) => item.name),
      ...segmentStats.map((item) => item.realEstateTypeName),
    ]));

    const cellMap = new Map(
      segmentStats.map((item) => [`${item.realEstateTypeName}__${item.tradeTypeName}`, item] as const)
    );

    const rows = propertyNames.map((propertyName) => {
      const cells = tradeNames.map((tradeName) => cellMap.get(`${propertyName}__${tradeName}`) || null);
      const totalCount = cells.reduce((sum, cell) => sum + (cell?.count || 0), 0);
      return { propertyName, cells, totalCount };
    });

    const columnTotals = tradeNames.map((tradeName) =>
      rows.reduce((sum, row) => {
        const matched = row.cells.find((cell) => cell?.tradeTypeName === tradeName);
        return sum + (matched?.count || 0);
      }, 0)
    );

    return {
      tradeNames,
      rows,
      columnTotals,
      maxRatio: Math.max(...segmentStats.map((item) => item.ratio), 0),
    };
  }, [result, segmentStats]);

  const segmentHighlights = useMemo(() => {
    if (!result || segmentStats.length === 0) return null;

    const byVolume = [...segmentStats].sort((a, b) => b.count - a.count || b.avgPrice - a.avgPrice);
    const byPrice = [...segmentStats].sort((a, b) => b.avgPrice - a.avgPrice || b.count - a.count);
    const byArea = [...segmentStats]
      .filter((item) => item.avgPricePerArea > 0)
      .sort((a, b) => b.avgPricePerArea - a.avgPricePerArea || b.count - a.count);

    return [
      {
        label: '최다 표본',
        item: byVolume[0] || null,
        value: byVolume[0] ? `${byVolume[0].count.toLocaleString()}건` : '-',
        hint: byVolume[0] ? `비중 ${byVolume[0].ratio}%` : '세그먼트 데이터 없음',
      },
      {
        label: '최고 평균가',
        item: byPrice[0] || null,
        value: byPrice[0] ? formatPriceMan(byPrice[0].avgPrice) : '-',
        hint: byPrice[0] ? `중위가 ${formatPriceMan(byPrice[0].medianPrice)}` : '세그먼트 데이터 없음',
      },
      {
        label: '최고 평단가',
        item: byArea[0] || null,
        value: byArea[0] ? `${byArea[0].avgPricePerArea.toLocaleString()}만/㎡` : '-',
        hint: byArea[0] ? `표본 ${byArea[0].count.toLocaleString()}건` : '면적 기반 데이터 없음',
      },
    ];
  }, [result, segmentStats]);

  const activeMonthlyTrend = useMemo(() => {
    if (!selectedSegment) return result?.monthlyTrend || [];
    const filtered = segmentMonthlyTrend.filter(
      (item) =>
        item.realEstateTypeName === selectedSegment.realEstateTypeName &&
        item.tradeTypeName === selectedSegment.tradeTypeName
    );
    return filtered.length > 0 ? filtered : (result?.monthlyTrend || []);
  }, [selectedSegment, segmentMonthlyTrend, result]);

  const activeDistanceStats = useMemo(() => {
    if (!selectedSegment) return result?.distanceStats || [];
    const filtered = segmentDistanceStats.filter(
      (item) =>
        item.realEstateTypeName === selectedSegment.realEstateTypeName &&
        item.tradeTypeName === selectedSegment.tradeTypeName
    );
    return filtered.length > 0 ? filtered : (result?.distanceStats || []);
  }, [selectedSegment, segmentDistanceStats, result]);

  const activeRecentTransactions = useMemo(() => {
    if (!selectedSegment) return result?.recentTransactions || [];
    const filtered = (result?.recentTransactions || []).filter(
      (item) =>
        item.realEstateTypeName === selectedSegment.realEstateTypeName &&
        item.tradeTypeName === selectedSegment.tradeTypeName
    );
    return filtered.length > 0 ? filtered : (result?.recentTransactions || []);
  }, [selectedSegment, result]);

  const activeApartmentComplexStats = useMemo(() => {
    if (apartmentComplexStats.length === 0) return [];
    if (!selectedSegment || selectedSegment.realEstateTypeName !== '아파트') return apartmentComplexStats;

    const filtered = apartmentComplexStats.filter((item) => item.tradeTypeName === selectedSegment.tradeTypeName);
    return filtered.length > 0 ? filtered : apartmentComplexStats;
  }, [apartmentComplexStats, selectedSegment]);

  const apartmentComplexPreview = useMemo<ApartmentComplexPreviewItem[]>(() => {
    if (apartmentComplexStats.length === 0) return [];

    const grouped = new Map<string, ApartmentComplexPreviewItem & { weightedPriceSum: number }>();

    apartmentComplexStats.forEach((item) => {
      const key = `${item.complexName}__${item.address || ''}`;
      const existing = grouped.get(key);

      if (!existing) {
        grouped.set(key, {
          complexName: item.complexName,
          address: item.address,
          totalCount: item.count,
          avgPrice: item.avgPrice,
          latestYmd: item.recentYmd,
          tradeTypes: [item.tradeTypeName],
          weightedPriceSum: item.avgPrice * item.count,
        });
        return;
      }

      existing.totalCount += item.count;
      existing.weightedPriceSum += item.avgPrice * item.count;
      existing.avgPrice = existing.totalCount > 0 ? Math.round(existing.weightedPriceSum / existing.totalCount) : existing.avgPrice;
      const latestYmdCandidates = [existing.latestYmd, item.recentYmd].filter(Boolean).sort();
      existing.latestYmd = latestYmdCandidates.length > 0 ? latestYmdCandidates[latestYmdCandidates.length - 1] || null : null;
      if (!existing.tradeTypes.includes(item.tradeTypeName)) {
        existing.tradeTypes.push(item.tradeTypeName);
      }
    });

    return Array.from(grouped.values())
      .map(({ weightedPriceSum: _weightedPriceSum, ...item }) => item)
      .sort((a, b) => b.totalCount - a.totalCount || b.avgPrice - a.avgPrice);
  }, [apartmentComplexStats]);

  const apartmentComplexMarkers = useMemo<ApartmentComplexMarkerItem[]>(() => {
    const grouped = new Map<string, ApartmentComplexMarkerItem>();
    (result?.recentTransactions || [])
      .filter((item) => item.realEstateTypeName === '아파트')
      .forEach((item) => {
        const complexName = (item.buildingName || item.articleName || '').trim();
        if (!complexName || typeof item.latitude !== 'number' || typeof item.longitude !== 'number') return;

        const key = `${complexName}__${item.address || ''}`;
        if (grouped.has(key)) return;

        const preview = apartmentComplexPreview.find((candidate) => candidate.complexName === complexName);
        grouped.set(key, {
          complexName,
          address: item.address || preview?.address || null,
          latitude: item.latitude,
          longitude: item.longitude,
          totalCount: preview?.totalCount || 1,
        });
      });

    return Array.from(grouped.values()).sort((a, b) => b.totalCount - a.totalCount);
  }, [apartmentComplexPreview, result]);

  const apartmentComplexHighlights = useMemo(() => {
    if (activeApartmentComplexStats.length === 0) return null;

    const byVolume = [...activeApartmentComplexStats].sort((a, b) => b.count - a.count || b.avgPrice - a.avgPrice);
    const byPrice = [...activeApartmentComplexStats].sort((a, b) => b.avgPrice - a.avgPrice || b.count - a.count);

    return [
      {
        label: '최다 표본 단지',
        item: byVolume[0] || null,
        value: byVolume[0] ? `${byVolume[0].count.toLocaleString()}건` : '-',
        hint: byVolume[0] ? `${byVolume[0].tradeTypeName} · 비중 ${byVolume[0].ratio}%` : '단지 데이터 없음',
      },
      {
        label: '최고 평균가 단지',
        item: byPrice[0] || null,
        value: byPrice[0] ? formatPriceMan(byPrice[0].avgPrice) : '-',
        hint: byPrice[0] ? `${byPrice[0].complexName} · ${byPrice[0].tradeTypeName}` : '단지 데이터 없음',
      },
    ];
  }, [activeApartmentComplexStats]);

  const monthlyChart = useMemo(() => {
    if (activeMonthlyTrend.length === 0) return null;

    const series = activeMonthlyTrend;
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
  }, [activeMonthlyTrend]);

  const hasDistanceValues = useMemo(() => {
    return activeRecentTransactions.some((tx) => typeof tx.distanceM === 'number' && tx.distanceM > 0);
  }, [activeRecentTransactions]);

  const handleAnalyze = async () => {
    if (!selectedPoint) {
      setError('사무실 위치를 먼저 확인해 주세요.');
      return;
    }
    await analyzeAroundPoint(selectedPoint);
  };

  useEffect(() => {
    let cancelled = false;

    if (!authChecked || !isAuthenticated) {
      setBoundaryPaths([]);
      setBoundaryLabel(null);
      return;
    }

    const extractBoundaryCoordinateSets = (geojson: AddressMarketBoundaryResponse['geojson']) => {
      const features = geojson?.features || [];
      const coordinateSets: number[][][] = [];

      for (const feature of features) {
        const geometry = feature.geometry;
        if (!geometry?.coordinates) continue;

        if (geometry.type === 'Polygon') {
          const polygon = geometry.coordinates as number[][][];
          if (Array.isArray(polygon?.[0])) coordinateSets.push(polygon[0]);
        }

        if (geometry.type === 'MultiPolygon') {
          const multiPolygon = geometry.coordinates as number[][][][];
          for (const polygon of multiPolygon) {
            if (Array.isArray(polygon?.[0])) coordinateSets.push(polygon[0]);
          }
        }
      }

      return coordinateSets;
    };

    const loadBoundary = async () => {
      if (!selectedPoint || !selectedRegion) {
        setBoundaryPaths([]);
        setBoundaryLabel(null);
        return;
      }

      try {
        const response = await authFetch(
          `${API_BASE}/api/statistics/address-market/boundary?lat=${selectedPoint.latitude}&lng=${selectedPoint.longitude}&regionName=${encodeURIComponent(selectedRegion)}`
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || '동 경계 조회 실패');
        }

        const boundaryData = data as AddressMarketBoundaryResponse;
        const coordinateSets = Array.isArray(boundaryData.paths) && boundaryData.paths.length > 0
          ? boundaryData.paths
          : extractBoundaryCoordinateSets(boundaryData.geojson);
        if (coordinateSets.length === 0) {
          if (!cancelled) {
            setBoundaryPaths([]);
            setBoundaryLabel(boundaryData.regionName || selectedRegion);
          }
          return;
        }

        await loadNaverMapsSdk();
        const naver = window.naver;

        const convertPoint = async (x: number, y: number) => {
          const utmkPoint = new naver.maps.Point(x, y);
          const latLng = naver.maps.TransCoord.fromUTMKToLatLng(utmkPoint);
          return {
            latitude: Number(latLng.lat()),
            longitude: Number(latLng.lng()),
          };
        };

        const convertedPaths = await Promise.all(
          coordinateSets.map(async (path) => {
            const converted = await Promise.all(
              path.map(([x, y]) => convertPoint(x, y))
            );
            return converted.filter(
              (point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
            );
          })
        );

        if (!cancelled) {
          setBoundaryPaths(convertedPaths.filter((path) => path.length >= 3));
          setBoundaryLabel(boundaryData.regionName || selectedRegion);
        }
      } catch (boundaryError) {
        console.warn('Boundary overlay load failed:', boundaryError);
        if (!cancelled) {
          setBoundaryPaths([]);
          setBoundaryLabel(null);
        }
      }
    };

    void loadBoundary();

    return () => {
      cancelled = true;
    };
  }, [authChecked, isAuthenticated, authFetch, selectedPoint, selectedRegion]);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-hud-text-primary">지역 거래 통계 분석</h1>
        <p className="text-sm text-hud-text-muted mt-1">
          국토부 실거래가 데이터를 기준으로 중심점 주변 동 단위 통계를 분석합니다.
          지도에서 클릭하여 중심점을 변경하고, 동을 선택하여 실시간으로 통계를 확인하세요.
        </p>
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

        <MapPointPicker
          center={mapCenter || DEFAULT_MAP_CENTER}
          selectedPoint={selectedPoint}
          boundaryPaths={boundaryPaths}
          boundaryLabel={boundaryLabel}
          apartmentComplexMarkers={apartmentComplexMarkers}
          onSelect={(point) => {
            setSelectedPoint(point);
            setPointOrigin('manual');
          }}
        />

      </HudCard>

      <HudCard>
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-hud-text-secondary">
            <MousePointerClick size={15} />
            <span>필터를 적용하여 실시간으로 통계를 분석하세요</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[240px_200px_200px_auto] gap-3 items-end">
            <div className="space-y-1">
              <label className="text-xs text-hud-text-muted">분석 동 선택</label>
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="w-full px-3 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:border-hud-accent-primary hover:border-hud-accent-info/50 transition-colors"
              >
                <option value="">
                  {nearbyRegions.length > 0 ? '전체 동' : '주변 동 불러오는 중'}
                </option>
                {nearbyRegions.map((region) => (
                  <option key={region} value={region}>{region}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-hud-text-muted">매물 유형</label>
              <select
                value={realEstateType}
                onChange={(e) => setRealEstateType(e.target.value)}
                className="w-full px-3 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:border-hud-accent-primary hover:border-hud-accent-info/50 transition-colors"
              >
                {PROPERTY_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-hud-text-muted">거래 유형</label>
              <select
                value={tradeType}
                onChange={(e) => setTradeType(e.target.value)}
                className="w-full px-3 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:border-hud-accent-primary hover:border-hud-accent-info/50 transition-colors"
              >
                {TRADE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end gap-2">
              <Button
                onClick={handleAnalyze}
                disabled={isLoading || isInitLoading || !selectedPoint}
                leftIcon={isLoading ? <Loader2 size={14} className="animate-spin" /> : <BarChart3 size={14} />}
                className="flex-1"
              >
                {isLoading ? '분석 중...' : '주변 통계 분석'}
              </Button>
            </div>
          </div>

          {selectedRegion && (
            <div className="flex items-center gap-2 px-3 py-2 bg-hud-accent-info/10 border border-hud-accent-info/30 rounded-lg">
              <MapPin size={14} className="text-hud-accent-info" />
              <span className="text-sm text-hud-accent-info">
                현재 선택된 동: <strong>{selectedRegion}</strong>
              </span>
            </div>
          )}
        </div>
      </HudCard>

      {isInitLoading && (
        <div className="rounded-lg border border-hud-border-secondary bg-hud-bg-secondary px-6 py-4 text-sm text-hud-text-muted flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-hud-accent-primary" />
          <div>
            <p className="font-medium text-hud-text-primary">사무실 위치를 불러오는 중...</p>
            <p className="text-xs text-hud-text-muted mt-1">프로필의 사무실 주소를 기준으로 분석합니다.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-hud-accent-danger/40 bg-hud-accent-danger/10 px-6 py-4 text-hud-accent-danger text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium">오류 발생</p>
            <p className="text-xs mt-1 opacity-90">{error}</p>
          </div>
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

          <HudCard
            title="선택 동 아파트 단지"
            subtitle={selectedRegion
              ? `${selectedRegion} 기준으로 확인된 아파트 단지입니다.`
              : '선택된 동 기준으로 확인된 아파트 단지입니다.'}
          >
            {apartmentComplexPreview.length === 0 ? (
              <p className="text-sm text-hud-text-muted">현재 선택된 동에서 확인된 아파트 단지가 없습니다.</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {apartmentComplexPreview.map((item) => (
                    <div
                      key={`${item.complexName}-${item.address || 'unknown'}`}
                      className="rounded-xl border border-hud-border-secondary bg-hud-bg-primary/70 p-4 hover:border-hud-accent-info/40 transition-colors cursor-pointer"
                      onClick={() => {
                        // 단지 클릭 시 해당 단지 상세 정보 펼침 처리
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-hud-text-primary" title={item.complexName}>
                            {item.complexName}
                          </p>
                          {item.address && (
                            <p className="mt-1 truncate text-xs text-hud-text-muted" title={item.address}>
                              {item.address}
                            </p>
                          )}
                        </div>
                        <div className="rounded-md border border-hud-accent-info/30 bg-hud-accent-info/10 px-2 py-1 text-xs text-hud-accent-info flex-shrink-0">
                          {item.totalCount.toLocaleString()}건
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-hud-border-secondary/70 bg-hud-bg-secondary/60 p-3">
                          <p className="text-[11px] text-hud-text-muted">평균가</p>
                          <p className="mt-1 text-sm font-semibold text-hud-accent-primary">{formatPriceMan(item.avgPrice)}</p>
                        </div>
                        <div className="rounded-lg border border-hud-border-secondary/70 bg-hud-bg-secondary/60 p-3">
                          <p className="text-[11px] text-hud-text-muted">최근 확인</p>
                          <p className="mt-1 text-sm font-semibold text-hud-text-primary">{formatYmd(item.latestYmd)}</p>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.tradeTypes.map((trade) => (
                          <span
                            key={`${item.complexName}-${trade}`}
                            className="rounded-full border border-hud-border-secondary bg-hud-bg-secondary px-2.5 py-1 text-[11px] text-hud-text-secondary"
                          >
                            {trade}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 단지별 상세 거래 정보 테이블 추가 */}
                {activeApartmentComplexStats.length > 0 && (
                  <div className="border-t border-hud-border-secondary pt-4">
                    <h3 className="text-sm font-semibold text-hud-text-primary mb-3">단지별 상세 거래 정보</h3>
                    <div className="overflow-auto">
                      <table className="w-full min-w-[980px]">
                        <thead>
                          <tr className="border-b border-hud-border-secondary">
                            <th className="text-left py-2 px-1 text-xs text-hud-text-muted">단지명</th>
                            <th className="text-left py-2 px-1 text-xs text-hud-text-muted">거래유형</th>
                            <th className="text-right py-2 px-1 text-xs text-hud-text-muted">표본 수</th>
                            <th className="text-right py-2 px-1 text-xs text-hud-text-muted">비중</th>
                            <th className="text-right py-2 px-1 text-xs text-hud-text-muted">평균가</th>
                            <th className="text-right py-2 px-1 text-xs text-hud-text-muted">중위가</th>
                            <th className="text-right py-2 px-1 text-xs text-hud-text-muted">가격범위</th>
                            <th className="text-right py-2 px-1 text-xs text-hud-text-muted">평단가</th>
                            <th className="text-left py-2 px-1 text-xs text-hud-text-muted">최근 거래</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeApartmentComplexStats.map((item) => (
                            <tr key={`${item.complexName}-${item.tradeTypeName}`} className="border-b border-hud-border-secondary/40 hover:bg-hud-bg-primary/50 transition-colors">
                              <td className="py-2 px-1 text-sm text-hud-text-primary">
                                <div className="max-w-[280px] truncate font-medium" title={item.complexName}>{item.complexName}</div>
                                {item.address && (
                                  <div className="max-w-[280px] truncate text-xs text-hud-text-muted" title={item.address}>
                                    {item.address}
                                  </div>
                                )}
                              </td>
                              <td className="py-2 px-1 text-sm text-hud-text-primary">{item.tradeTypeName}</td>
                              <td className="py-2 px-1 text-sm text-hud-text-primary text-right">{item.count.toLocaleString()}건</td>
                              <td className="py-2 px-1 text-sm text-hud-text-primary text-right">{item.ratio}%</td>
                              <td className="py-2 px-1 text-sm text-hud-accent-primary text-right font-medium">{formatPriceMan(item.avgPrice)}</td>
                              <td className="py-2 px-1 text-sm text-hud-text-primary text-right">{formatPriceMan(item.medianPrice)}</td>
                              <td className="py-2 px-1 text-sm text-hud-text-primary text-right">
                                <div className="text-xs">
                                  <span className="text-hud-accent-success">{formatPriceMan(item.minPrice)}</span>
                                  <span className="text-hud-text-muted mx-1">~</span>
                                  <span className="text-hud-accent-warning">{formatPriceMan(item.maxPrice)}</span>
                                </div>
                              </td>
                              <td className="py-2 px-1 text-sm text-hud-text-primary text-right">
                                {item.avgPricePerArea > 0 ? `${item.avgPricePerArea.toLocaleString()}만/㎡` : '-'}
                              </td>
                              <td className="py-2 px-1 text-xs text-hud-text-muted">
                                {formatMonthLabel(item.recentMonth)}
                                {item.recentYmd ? <span className="ml-1">({formatYmd(item.recentYmd)})</span> : null}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </HudCard>

          <HudCard
            title="시장 요약"
            subtitle={selectedRegion
              ? `${selectedRegion}의 부동산 시장 핵심 지표`
              : '선택된 지역의 부동산 시장 핵심 지표'}
          >
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              <HudCard className="p-4 hover:border-hud-accent-info/30 transition-colors">
                <p className="text-xs text-hud-text-muted">총 매물 수</p>
                <p className="text-xl font-bold text-hud-text-primary mt-1">{result.summary.totalCount.toLocaleString()}</p>
                <p className="text-xs text-hud-text-muted mt-1">분석 대상 표본</p>
              </HudCard>
              <HudCard className="p-4 hover:border-hud-accent-primary/30 transition-colors">
                <p className="text-xs text-hud-text-muted">평균가</p>
                <p className="text-xl font-bold text-hud-accent-primary mt-1">{formatPriceMan(result.summary.avgPrice)}</p>
                <p className="text-xs text-hud-text-muted mt-1">전체 평균 시세</p>
              </HudCard>
              <HudCard className="p-4 hover:border-hud-accent-info/30 transition-colors">
                <p className="text-xs text-hud-text-muted">중위가</p>
                <p className="text-xl font-bold text-hud-accent-info mt-1">{formatPriceMan(result.summary.medianPrice)}</p>
                <p className="text-xs text-hud-text-muted mt-1">대표 시세 중심값</p>
              </HudCard>
              <HudCard className="p-4 hover:border-hud-accent-success/30 transition-colors">
                <p className="text-xs text-hud-text-muted">최저가</p>
                <p className="text-xl font-bold text-hud-accent-success mt-1">{formatPriceMan(result.summary.minPrice)}</p>
                <p className="text-xs text-hud-text-muted mt-1">하단 가격대</p>
              </HudCard>
              <HudCard className="p-4 hover:border-hud-accent-warning/30 transition-colors">
                <p className="text-xs text-hud-text-muted">최고가</p>
                <p className="text-xl font-bold text-hud-accent-warning mt-1">{formatPriceMan(result.summary.maxPrice)}</p>
                <p className="text-xs text-hud-text-muted mt-1">상단 가격대</p>
              </HudCard>
              <HudCard className="p-4 hover:border-hud-accent-primary/30 transition-colors">
                <p className="text-xs text-hud-text-muted">평균 평단가</p>
                <p className="text-xl font-bold text-hud-text-primary mt-1">{result.summary.avgPricePerArea.toLocaleString()}만/㎡</p>
                <p className="text-xs text-hud-text-muted mt-1">면적당 가격</p>
              </HudCard>
            </div>
          </HudCard>

          {segmentStats.length > 0 && (
            <HudCard
              title="세그먼트별 분석"
              subtitle="매물 유형과 거래 유형 조합별 상세 통계"
            >
              <div className="space-y-4">
                {/* 세그먼트 선택 탭 */}
                <div className="flex flex-wrap gap-2">
                  {segmentStats.map((segment) => {
                    const key = `${segment.realEstateTypeName}__${segment.tradeTypeName}`;
                    const isActive = key === selectedSegmentKey;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedSegmentKey(key)}
                        className={`px-4 py-2.5 rounded-lg border text-sm transition-all ${isActive
                            ? 'border-hud-accent-primary bg-hud-accent-primary/15 text-hud-accent-primary shadow-sm'
                            : 'border-hud-border-secondary bg-hud-bg-primary text-hud-text-secondary hover:border-hud-accent-info/50'
                          }`}
                      >
                        <div className="flex items-center gap-2">
                          <span>{segment.realEstateTypeName} · {segment.tradeTypeName}</span>
                          <span className={`px-2 py-0.5 rounded text-xs ${isActive ? 'bg-hud-accent-primary/20' : 'bg-hud-bg-secondary'}`}>
                            {segment.count.toLocaleString()}건
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* 선택된 세그먼트 상세 정보 */}
                {selectedSegment && (
                  <div className="border-t border-hud-border-secondary pt-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-hud-text-primary">
                        {selectedSegment.realEstateTypeName} · {selectedSegment.tradeTypeName}
                      </h3>
                      <div className="text-sm text-hud-text-muted">
                        전체의 <span className="text-hud-accent-primary font-semibold">{selectedSegment.ratio}%</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                      <HudCard className="p-4">
                        <p className="text-xs text-hud-text-muted">매물 수</p>
                        <p className="text-xl font-bold text-hud-text-primary mt-1">{selectedSegment.count.toLocaleString()}</p>
                        <p className="text-xs text-hud-text-muted mt-1">전체의 {selectedSegment.ratio}%</p>
                      </HudCard>
                      <HudCard className="p-4">
                        <p className="text-xs text-hud-text-muted">평균가</p>
                        <p className="text-xl font-bold text-hud-accent-primary mt-1">{formatPriceMan(selectedSegment.avgPrice)}</p>
                        <p className="text-xs text-hud-text-muted mt-1">최근 {formatMonthLabel(selectedSegment.recentMonth)}</p>
                      </HudCard>
                      <HudCard className="p-4">
                        <p className="text-xs text-hud-text-muted">중위가</p>
                        <p className="text-xl font-bold text-hud-accent-info mt-1">{formatPriceMan(selectedSegment.medianPrice)}</p>
                        <p className="text-xs text-hud-text-muted mt-1">대표 시세 중심값</p>
                      </HudCard>
                      <HudCard className="p-4">
                        <p className="text-xs text-hud-text-muted">최저가</p>
                        <p className="text-xl font-bold text-hud-accent-success mt-1">{formatPriceMan(selectedSegment.minPrice)}</p>
                        <p className="text-xs text-hud-text-muted mt-1">세그먼트 하단</p>
                      </HudCard>
                      <HudCard className="p-4">
                        <p className="text-xs text-hud-text-muted">최고가</p>
                        <p className="text-xl font-bold text-hud-accent-warning mt-1">{formatPriceMan(selectedSegment.maxPrice)}</p>
                        <p className="text-xs text-hud-text-muted mt-1">세그먼트 상단</p>
                      </HudCard>
                      <HudCard className="p-4">
                        <p className="text-xs text-hud-text-muted">{selectedSegment.avgRentPrc > 0 ? '평균 월세' : '평균 평단가'}</p>
                        <p className="text-xl font-bold text-hud-text-primary mt-1">
                          {selectedSegment.avgRentPrc > 0
                            ? `${selectedSegment.avgRentPrc.toLocaleString()}만`
                            : selectedSegment.avgPricePerArea > 0
                              ? `${selectedSegment.avgPricePerArea.toLocaleString()}만/㎡`
                              : '-'}
                        </p>
                        <p className="text-xs text-hud-text-muted mt-1">
                          {selectedSegment.avgRentPrc > 0 ? '월세 거래 조합 기준' : '면적 정보 포함 표본 기준'}
                        </p>
                      </HudCard>
                    </div>
                  </div>
                )}
              </div>
            </HudCard>
          )}

          {segmentHighlights && segmentStats.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {segmentHighlights.map((highlight) => (
                <HudCard key={highlight.label} className="p-4 hover:border-hud-accent-info/30 transition-colors">
                  <p className="text-xs text-hud-text-muted">{highlight.label}</p>
                  {highlight.item ? (
                    <>
                      <p className="text-sm font-semibold text-hud-text-primary mt-1">
                        {highlight.item.realEstateTypeName} · {highlight.item.tradeTypeName}
                      </p>
                      <p className="text-lg font-bold text-hud-accent-primary mt-2">{highlight.value}</p>
                      <p className="text-xs text-hud-text-muted mt-1">{highlight.hint}</p>
                    </>
                  ) : (
                    <p className="text-sm text-hud-text-muted mt-2">{highlight.hint}</p>
                  )}
                </HudCard>
              ))}
            </div>
          )}

          {result.summary.infrastructure && (
            <HudCard title="주요 상권 및 표본 인프라" subtitle={result.filters.regionName ? `${result.filters.regionName} 중심 생활 인프라` : '중심점 기준 생활 인프라'}>
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
            <HudCard
              title="월별 평균가 추이"
              subtitle={selectedSegment
                ? `${selectedSegment.realEstateTypeName} · ${selectedSegment.tradeTypeName} / 평균가(선) · 거래건수(막대)`
                : `평균가(선) · 거래건수(막대) / 중심 ${result.center.latitude.toFixed(5)}, ${result.center.longitude.toFixed(5)}`}
            >
              {activeMonthlyTrend.length === 0 ? (
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

            <HudCard title="거래유형 분포" subtitle={result.filters.regionName ? `${result.filters.regionName} 비중` : '선택 지역 비중'}>
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

            <HudCard title="매물유형 분포" subtitle={result.filters.regionName ? `${result.filters.regionName} 비중` : '선택 지역 비중'}>
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

          <HudCard
            title="매물유형 × 거래유형 교차 분석"
            subtitle="조합별 표본 수, 평균가, 비중을 함께 비교합니다."
          >
            {!segmentMatrix ? (
              <p className="text-sm text-hud-text-muted">조합별 세그먼트 데이터가 없습니다.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] border-separate border-spacing-0">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-hud-bg-secondary py-3 px-3 text-left text-xs text-hud-text-muted border-b border-hud-border-secondary">
                        매물유형
                      </th>
                      {segmentMatrix.tradeNames.map((tradeName) => (
                        <th key={`segment-col-${tradeName}`} className="bg-hud-bg-secondary py-3 px-3 text-left text-xs text-hud-text-muted border-b border-hud-border-secondary">
                          {tradeName}
                        </th>
                      ))}
                      <th className="bg-hud-bg-secondary py-3 px-3 text-right text-xs text-hud-text-muted border-b border-hud-border-secondary">
                        합계
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {segmentMatrix.rows.map((row) => (
                      <tr key={`segment-row-${row.propertyName}`}>
                        <td className="sticky left-0 z-10 bg-hud-bg-secondary/95 py-3 px-3 align-top border-b border-hud-border-secondary/60">
                          <p className="text-sm font-semibold text-hud-text-primary">{row.propertyName}</p>
                          <p className="text-xs text-hud-text-muted mt-1">{row.totalCount.toLocaleString()}건</p>
                        </td>
                        {row.cells.map((cell, index) => {
                          const intensity = cell && segmentMatrix.maxRatio > 0
                            ? 0.12 + (cell.ratio / segmentMatrix.maxRatio) * 0.28
                            : 0;

                          return (
                            <td
                              key={`segment-cell-${row.propertyName}-${segmentMatrix.tradeNames[index]}`}
                              className="py-3 px-3 align-top border-b border-hud-border-secondary/60"
                              style={cell ? { background: `linear-gradient(135deg, rgba(56, 189, 248, ${intensity}) 0%, rgba(15, 23, 42, 0.04) 100%)` } : undefined}
                            >
                              {cell ? (
                                <div className="space-y-1">
                                  <p className="text-sm font-semibold text-hud-text-primary">{cell.count.toLocaleString()}건</p>
                                  <p className="text-xs text-hud-text-muted">비중 {cell.ratio}%</p>
                                  <p className="text-xs text-hud-accent-primary">평균가 {formatPriceMan(cell.avgPrice)}</p>
                                  <p className="text-xs text-hud-text-muted">
                                    {cell.avgRentPrc > 0
                                      ? `평균 월세 ${cell.avgRentPrc.toLocaleString()}만`
                                      : cell.avgPricePerArea > 0
                                        ? `평단가 ${cell.avgPricePerArea.toLocaleString()}만/㎡`
                                        : `중위가 ${formatPriceMan(cell.medianPrice)}`}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-xs text-hud-text-muted">-</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="py-3 px-3 text-right align-top border-b border-hud-border-secondary/60">
                          <p className="text-sm font-semibold text-hud-text-primary">{row.totalCount.toLocaleString()}건</p>
                          <p className="text-xs text-hud-text-muted">
                            {result.summary.totalCount > 0 ? `${((row.totalCount / result.summary.totalCount) * 100).toFixed(1)}%` : '-'}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="sticky left-0 z-10 bg-hud-bg-secondary py-3 px-3 text-sm font-semibold text-hud-text-primary border-t border-hud-border-secondary">
                        거래유형 합계
                      </td>
                      {segmentMatrix.columnTotals.map((count, index) => (
                        <td key={`segment-total-${segmentMatrix.tradeNames[index]}`} className="bg-hud-bg-secondary py-3 px-3 text-sm text-hud-text-primary border-t border-hud-border-secondary">
                          {count.toLocaleString()}건
                        </td>
                      ))}
                      <td className="bg-hud-bg-secondary py-3 px-3 text-right text-sm font-semibold text-hud-accent-primary border-t border-hud-border-secondary">
                        {result.summary.totalCount.toLocaleString()}건
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </HudCard>

          <HudCard
            title="세부 세그먼트 랭킹"
            subtitle="조합별 가격대와 최근 집계월을 빠르게 비교합니다."
          >
            {segmentStats.length === 0 ? (
              <p className="text-sm text-hud-text-muted">세부 세그먼트 데이터가 없습니다.</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
                {segmentStats.map((segment) => (
                  <div
                    key={`${segment.realEstateTypeName}-${segment.tradeTypeName}`}
                    className="rounded-xl border border-hud-border-secondary bg-hud-bg-primary/70 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-hud-text-primary">
                          {segment.realEstateTypeName} · {segment.tradeTypeName}
                        </p>
                        <p className="text-xs text-hud-text-muted mt-1">
                          표본 {segment.count.toLocaleString()}건 · 전체 {segment.ratio}%
                        </p>
                      </div>
                      <div className="px-2 py-1 rounded-md border border-hud-accent-info/30 bg-hud-accent-info/10 text-xs text-hud-accent-info">
                        최근 {formatMonthLabel(segment.recentMonth)}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-4">
                      <div className="rounded-lg border border-hud-border-secondary/70 bg-hud-bg-secondary/60 p-3">
                        <p className="text-[11px] text-hud-text-muted">평균가</p>
                        <p className="text-sm font-semibold text-hud-accent-primary mt-1">{formatPriceMan(segment.avgPrice)}</p>
                      </div>
                      <div className="rounded-lg border border-hud-border-secondary/70 bg-hud-bg-secondary/60 p-3">
                        <p className="text-[11px] text-hud-text-muted">중위가</p>
                        <p className="text-sm font-semibold text-hud-text-primary mt-1">{formatPriceMan(segment.medianPrice)}</p>
                      </div>
                      <div className="rounded-lg border border-hud-border-secondary/70 bg-hud-bg-secondary/60 p-3">
                        <p className="text-[11px] text-hud-text-muted">가격 범위</p>
                        <p className="text-xs font-medium text-hud-text-primary mt-1">
                          {formatPriceMan(segment.minPrice)} ~ {formatPriceMan(segment.maxPrice)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-hud-border-secondary/70 bg-hud-bg-secondary/60 p-3">
                        <p className="text-[11px] text-hud-text-muted">
                          {segment.avgRentPrc > 0 ? '평균 월세' : '평균 평단가'}
                        </p>
                        <p className="text-sm font-semibold text-hud-text-primary mt-1">
                          {segment.avgRentPrc > 0
                            ? `${segment.avgRentPrc.toLocaleString()}만`
                            : segment.avgPricePerArea > 0
                              ? `${segment.avgPricePerArea.toLocaleString()}만/㎡`
                              : '-'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </HudCard>

          <HudCard
            title="아파트 단지별 통계"
            subtitle={selectedSegment?.realEstateTypeName === '아파트'
              ? `${selectedSegment.tradeTypeName} 기준 아파트 단지 표본과 시세를 비교합니다.`
              : '현재 필터 기준 아파트 단지 표본과 시세를 비교합니다.'}
          >
            {activeApartmentComplexStats.length === 0 ? (
              <p className="text-sm text-hud-text-muted">현재 필터 기준 아파트 단지 데이터가 없습니다.</p>
            ) : (
              <div className="space-y-4">
                {apartmentComplexHighlights && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {apartmentComplexHighlights.map((highlight) => (
                      <div
                        key={highlight.label}
                        className="rounded-xl border border-hud-border-secondary bg-hud-bg-primary/70 p-4"
                      >
                        <p className="text-xs text-hud-text-muted">{highlight.label}</p>
                        {highlight.item ? (
                          <>
                            <p className="mt-1 text-sm font-semibold text-hud-text-primary">
                              {highlight.item.complexName}
                            </p>
                            <p className="mt-2 text-lg font-bold text-hud-accent-primary">{highlight.value}</p>
                            <p className="mt-1 text-xs text-hud-text-muted">{highlight.hint}</p>
                          </>
                        ) : (
                          <p className="mt-2 text-sm text-hud-text-muted">{highlight.hint}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="overflow-auto">
                  <table className="w-full min-w-[980px]">
                    <thead>
                      <tr className="border-b border-hud-border-secondary">
                        <th className="text-left py-2 px-1 text-xs text-hud-text-muted">단지명</th>
                        <th className="text-left py-2 px-1 text-xs text-hud-text-muted">거래유형</th>
                        <th className="text-right py-2 px-1 text-xs text-hud-text-muted">표본 수</th>
                        <th className="text-right py-2 px-1 text-xs text-hud-text-muted">비중</th>
                        <th className="text-right py-2 px-1 text-xs text-hud-text-muted">평균가</th>
                        <th className="text-right py-2 px-1 text-xs text-hud-text-muted">중위가</th>
                        <th className="text-right py-2 px-1 text-xs text-hud-text-muted">보조 지표</th>
                        <th className="text-left py-2 px-1 text-xs text-hud-text-muted">최근 집계</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeApartmentComplexStats.map((item) => (
                        <tr key={`${item.complexName}-${item.tradeTypeName}`} className="border-b border-hud-border-secondary/40">
                          <td className="py-2 px-1 text-sm text-hud-text-primary">
                            <div className="max-w-[280px] truncate" title={item.complexName}>{item.complexName}</div>
                            {item.address && (
                              <div className="max-w-[280px] truncate text-xs text-hud-text-muted" title={item.address}>
                                <Building2 size={11} className="inline mr-1" />
                                {item.address}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-1 text-sm text-hud-text-primary">{item.tradeTypeName}</td>
                          <td className="py-2 px-1 text-right text-sm text-hud-text-primary">{item.count.toLocaleString()}건</td>
                          <td className="py-2 px-1 text-right text-sm text-hud-text-primary">{item.ratio}%</td>
                          <td className="py-2 px-1 text-right text-sm text-hud-accent-primary">{formatPriceMan(item.avgPrice)}</td>
                          <td className="py-2 px-1 text-right text-sm text-hud-text-primary">{formatPriceMan(item.medianPrice)}</td>
                          <td className="py-2 px-1 text-right text-sm text-hud-text-primary">
                            {item.avgRentPrc > 0
                              ? `${item.avgRentPrc.toLocaleString()}만`
                              : item.avgPricePerArea > 0
                                ? `${item.avgPricePerArea.toLocaleString()}만/㎡`
                                : '-'}
                          </td>
                          <td className="py-2 px-1 text-xs text-hud-text-muted">
                            {formatMonthLabel(item.recentMonth)}
                            {item.recentYmd ? <span className="ml-1">({formatYmd(item.recentYmd)})</span> : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </HudCard>

          <HudCard
            title="거리 구간별 시세"
            subtitle={selectedSegment
              ? `${selectedSegment.realEstateTypeName} · ${selectedSegment.tradeTypeName} 기준 평균가/중위가 비교`
              : '중심점 거리 기준 평균가/중위가 비교'}
          >
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
                  {activeDistanceStats.map((item) => (
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

          <HudCard
            title="최근 거래/등록 표본"
            subtitle={selectedSegment
              ? `${selectedSegment.realEstateTypeName} · ${selectedSegment.tradeTypeName} 최신 표본 우선`
              : result.filters.regionName ? `${result.filters.regionName} 최신순 전체 표본` : '중심점 주변 최신순 전체 표본'}
          >
            <div className="max-h-[720px] overflow-auto">
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
                  {activeRecentTransactions.map((tx) => (
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
        <HudCard className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-hud-accent-primary/10 flex items-center justify-center">
              <TrendingUp className="w-8 h-8 text-hud-accent-primary" />
            </div>
            <div>
              <p className="text-hud-text-primary font-medium text-lg">지역 거래 통계 분석 시작하기</p>
              <p className="text-hud-text-muted text-sm mt-2 max-w-md mx-auto">
                지도에서 중심점을 선택하거나 필터를 적용하여 주변 부동산 시장 통계를 확인하세요.
                사무실 위치를 기준으로 분석이 시작됩니다.
              </p>
            </div>
            {selectedPoint && (
              <div className="mt-4 p-4 bg-hud-bg-secondary rounded-lg border border-hud-border-secondary">
                <p className="text-xs text-hud-text-muted mb-1">선택된 중심점</p>
                <p className="text-sm text-hud-text-primary font-mono">
                  {selectedPoint.latitude.toFixed(6)}, {selectedPoint.longitude.toFixed(6)}
                </p>
              </div>
            )}
          </div>
        </HudCard>
      )}
    </div>
  );
};

export default AddressMarketStats;
