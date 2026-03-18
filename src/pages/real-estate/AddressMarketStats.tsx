import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Building2,
  Loader2,
} from 'lucide-react';
import HudCard from '../../components/common/HudCard';
import AddressMarketStatsMap, {
  type AddressMarketStatsMapMarker,
} from '../../components/real-estate/AddressMarketStatsMap';
import { API_BASE } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';

interface MapPoint {
  latitude: number;
  longitude: number;
}

interface MarketSummary {
  totalCount: number;
  avgPrice: number;
  medianPrice: number;
  minPrice: number;
  maxPrice: number;
  avgPricePerArea: number;
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
  tradeTypeCode: string | null;
  tradeTypeName: string;
  realEstateTypeCode: string | null;
  realEstateTypeName: string;
  price: number | null;
  rentPrc: number | null;
  area: number | null;
  latitude: number;
  longitude: number;
  distanceM: number | null;
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
    radiusMeters?: number;
    realEstateType: string | null;
    tradeType: string | null;
  };
  summary: MarketSummary;
  recentTransactions: RecentTransactionItem[];
  mapSamples?: MapSampleItem[];
  sourceMeta?: {
    sourceType?: string;
    serviceName?: string | null;
    region?: string | null;
    analyzedRows?: number;
    nearbyRegionCount?: number;
  };
}

interface OfficeCenterResponse {
  center: MapPoint;
  office?: {
    companyName?: string | null;
    address?: string | null;
  };
}

interface ApartmentMarker {
  id: string;
  complexName: string;
  latitude: number;
  longitude: number;
  address: string | null;
  totalCount: number;
  avgPrice: number;
  latestYmd: string | null;
  samples: MapSampleItem[];
}

interface PropertyMarker {
  id: string;
  sample: MapSampleItem;
}

const PROPERTY_TYPE_OPTIONS = [
  { label: '아파트', value: 'APT' },
  { label: '오피스텔', value: 'OPST' },
  { label: '상가', value: 'SG' },
  { label: '토지', value: 'TJ' },
  { label: '주상복합', value: 'MIXED_USE' },
  { label: '단독다가구', value: 'DDDGG' },
  { label: '원룸', value: 'ONEROOM' },
  { label: '다세대', value: 'DSD' },
  { label: '상업용부지', value: 'COMMERCIAL_LAND' },
  { label: '공장창고', value: 'GJCG' },
  { label: '호텔모텔', value: 'HOTEL_MOTEL' },
  { label: '기타', value: 'OTHER' },
];

const TRADE_TYPE_OPTIONS = [
  { label: '매매', value: 'A1' },
  { label: '전월세', value: 'B1:B2' },
  { label: '월세', value: 'B2' },
];

const DEFAULT_MAP_CENTER: MapPoint = {
  latitude: 37.5665,
  longitude: 126.978,
};

function toFiniteNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;

  const normalized = value.replace(/,/g, '').trim();
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatPriceMan(price: unknown) {
  const numericPrice = toFiniteNumber(price);
  if (!numericPrice || numericPrice <= 0) return '-';

  const uk = Math.floor(numericPrice / 10000);
  const man = numericPrice % 10000;
  if (uk > 0) return man > 0 ? `${uk}억 ${man.toLocaleString()}만` : `${uk}억`;
  return `${numericPrice.toLocaleString()}만`;
}

function formatTradePrice(price: unknown, rentPrc: unknown) {
  const basePrice = formatPriceMan(price);
  const numericRent = toFiniteNumber(rentPrc);
  if (!numericRent || numericRent <= 0) return basePrice;
  if (basePrice === '-') return `월 ${numericRent.toLocaleString()}만`;
  return `${basePrice} / 월 ${numericRent.toLocaleString()}만`;
}

function formatArea(area: unknown) {
  const numericArea = toFiniteNumber(area);
  if (!numericArea || numericArea <= 0) return '-';
  return `${numericArea.toFixed(2)}㎡`;
}

function formatYmd(ymd: string | null | undefined) {
  if (!ymd || !/^\d{8}$/.test(ymd)) return '-';
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}

function formatDistance(distanceM: unknown) {
  const numericDistance = toFiniteNumber(distanceM);
  if (!numericDistance || numericDistance <= 0) return '-';
  return `${numericDistance.toLocaleString()}m`;
}

async function parseResponseBody(response: Response) {
  const raw = await response.text();
  if (!raw) return {};

  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {
      error: raw.slice(0, 300) || '응답을 해석하지 못했습니다.',
    };
  }
}

function normalizeAddressMarketResult(payload: unknown): AddressMarketResult {
  const source = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const center = source.center && typeof source.center === 'object' ? source.center as Record<string, unknown> : {};
  const filters = source.filters && typeof source.filters === 'object' ? source.filters as Record<string, unknown> : {};
  const summary = source.summary && typeof source.summary === 'object' ? source.summary as Record<string, unknown> : {};
  const sourceMeta = source.sourceMeta && typeof source.sourceMeta === 'object'
    ? source.sourceMeta as Record<string, unknown>
    : {};

  const recentTransactions = Array.isArray(source.recentTransactions)
    ? source.recentTransactions.map((item) => {
        const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
        return {
          articleNo: typeof row.articleNo === 'string' ? row.articleNo : '',
          articleName: typeof row.articleName === 'string' ? row.articleName : '-',
          buildingName: typeof row.buildingName === 'string' ? row.buildingName : null,
          tradeTypeName: typeof row.tradeTypeName === 'string' ? row.tradeTypeName : '-',
          realEstateTypeName: typeof row.realEstateTypeName === 'string' ? row.realEstateTypeName : '-',
          price: toFiniteNumber(row.price),
          rentPrc: toFiniteNumber(row.rentPrc),
          area: toFiniteNumber(row.area),
          distanceM: toFiniteNumber(row.distanceM),
          articleConfirmYmd: typeof row.articleConfirmYmd === 'string' ? row.articleConfirmYmd : null,
          address: typeof row.address === 'string' ? row.address : '-',
        };
      })
    : [];

  const mapSamples = Array.isArray(source.mapSamples)
    ? source.mapSamples
        .map((item) => {
          const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
          const latitude = toFiniteNumber(row.latitude);
          const longitude = toFiniteNumber(row.longitude);
          if (latitude === null || longitude === null) return null;

          return {
            id: typeof row.id === 'string' ? row.id : `${typeof row.articleNo === 'string' ? row.articleNo : 'sample'}-${latitude}-${longitude}`,
            articleNo: typeof row.articleNo === 'string' ? row.articleNo : '',
            articleName: typeof row.articleName === 'string' ? row.articleName : '-',
            buildingName: typeof row.buildingName === 'string' ? row.buildingName : null,
            tradeTypeCode: typeof row.tradeTypeCode === 'string' ? row.tradeTypeCode : null,
            tradeTypeName: typeof row.tradeTypeName === 'string' ? row.tradeTypeName : '-',
            realEstateTypeCode: typeof row.realEstateTypeCode === 'string' ? row.realEstateTypeCode : null,
            realEstateTypeName: typeof row.realEstateTypeName === 'string' ? row.realEstateTypeName : '-',
            price: toFiniteNumber(row.price),
            rentPrc: toFiniteNumber(row.rentPrc),
            area: toFiniteNumber(row.area),
            latitude,
            longitude,
            distanceM: toFiniteNumber(row.distanceM),
            articleConfirmYmd: typeof row.articleConfirmYmd === 'string' ? row.articleConfirmYmd : null,
            address: typeof row.address === 'string' ? row.address : '-',
          };
        })
        .filter((item): item is MapSampleItem => item !== null)
    : [];

  return {
    center: {
      latitude: toFiniteNumber(center.latitude) ?? DEFAULT_MAP_CENTER.latitude,
      longitude: toFiniteNumber(center.longitude) ?? DEFAULT_MAP_CENTER.longitude,
      source: center.source === 'address' ? 'address' : 'query',
      address: typeof center.address === 'string' ? center.address : null,
    },
    filters: {
      radiusMeters: toFiniteNumber(filters.radiusMeters) ?? undefined,
      realEstateType: typeof filters.realEstateType === 'string' ? filters.realEstateType : null,
      tradeType: typeof filters.tradeType === 'string' ? filters.tradeType : null,
    },
    summary: {
      totalCount: toFiniteNumber(summary.totalCount) ?? 0,
      avgPrice: toFiniteNumber(summary.avgPrice) ?? 0,
      medianPrice: toFiniteNumber(summary.medianPrice) ?? 0,
      minPrice: toFiniteNumber(summary.minPrice) ?? 0,
      maxPrice: toFiniteNumber(summary.maxPrice) ?? 0,
      avgPricePerArea: toFiniteNumber(summary.avgPricePerArea) ?? 0,
    },
    recentTransactions,
    mapSamples,
    sourceMeta: Object.keys(sourceMeta).length > 0
      ? {
          sourceType: typeof sourceMeta.sourceType === 'string' ? sourceMeta.sourceType : undefined,
          serviceName: typeof sourceMeta.serviceName === 'string' ? sourceMeta.serviceName : null,
          region: typeof sourceMeta.region === 'string' ? sourceMeta.region : null,
          analyzedRows: toFiniteNumber(sourceMeta.analyzedRows) ?? undefined,
          nearbyRegionCount: toFiniteNumber(sourceMeta.nearbyRegionCount) ?? undefined,
        }
      : undefined,
  };
}

const AddressMarketStats = () => {
  const authFetch = useAuthStore((state) => state.authFetch);
  const authChecked = useAuthStore((state) => state.authChecked);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [isInitLoading, setIsInitLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mapCenter, setMapCenter] = useState<MapPoint>(DEFAULT_MAP_CENTER);
  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null);

  const [realEstateType, setRealEstateType] = useState(PROPERTY_TYPE_OPTIONS[0].value);
  const [tradeType, setTradeType] = useState(TRADE_TYPE_OPTIONS[0].value);
  const [result, setResult] = useState<AddressMarketResult | null>(null);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);

  const requestIdRef = useRef(0);

  const analyzeAroundPoint = async (point: MapPoint) => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        lat: String(point.latitude),
        lng: String(point.longitude),
        source: 'auto',
        monthsBack: '2',
        realEstateType,
        tradeType,
      });

      const response = await authFetch(`${API_BASE}/api/statistics/address-market?${params.toString()}`);
      const data = await parseResponseBody(response);

      if (!response.ok) {
        if (response.status === 401) throw new Error('로그인이 만료되었습니다. 다시 로그인해 주세요.');
        throw new Error(
          typeof data.error === 'string' && data.error.trim()
            ? data.error
            : '거래 통계 조회에 실패했습니다.'
        );
      }

      if (requestId !== requestIdRef.current) return;

      setResult(normalizeAddressMarketResult(data));
      setMapCenter(point);
    } catch (analysisError) {
      if (requestId !== requestIdRef.current) return;
      console.error('Address market analysis failed:', analysisError);
      setError(analysisError instanceof Error ? analysisError.message : '거래 통계 조회에 실패했습니다.');
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  };

  // 초기 사무실 중심점 로드 (UI에 사무실 정보는 안 보이지만 초기 중심점으로 사용)
  useEffect(() => {
    if (!authChecked) return;

    if (!isAuthenticated) {
      setIsInitLoading(false);
      setResult(null);
      setError('로그인이 필요합니다.');
      return;
    }

    let mounted = true;

    const loadInitialCenter = async () => {
      setIsInitLoading(true);
      setError(null);

      try {
        const response = await authFetch(`${API_BASE}/api/statistics/office-center?ts=${Date.now()}`);
        const data = await response.json();

        if (!mounted) return;

        if (!response.ok) {
          if (response.status === 401) {
            setError('로그인이 만료되었습니다. 다시 로그인해 주세요.');
            return;
          }
          // 사무실 위치 없어도 기본 중심으로 데이터 조회 시작
          setSelectedPoint(DEFAULT_MAP_CENTER);
          return;
        }

        const officeData = data as OfficeCenterResponse;
        if (officeData?.center?.latitude && officeData?.center?.longitude) {
          setMapCenter(officeData.center);
          setSelectedPoint(officeData.center);
        } else {
          // 사무실 좌표 없으면 기본 중심으로 데이터 조회 시작
          setSelectedPoint(DEFAULT_MAP_CENTER);
        }
      } catch (initError) {
        console.error('Office center load failed:', initError);
        // 사무실 위치 로드 실패해도 기본 중심으로 데이터 조회 시작
        if (mounted) {
          setSelectedPoint(DEFAULT_MAP_CENTER);
        }
      } finally {
        if (mounted) {
          setIsInitLoading(false);
        }
      }
    };

    void loadInitialCenter();

    return () => {
      mounted = false;
    };
  }, [authChecked, authFetch, isAuthenticated]);

  useEffect(() => {
    if (!authChecked || !isAuthenticated || isInitLoading || !selectedPoint) return;
    void analyzeAroundPoint(selectedPoint);
  }, [authChecked, isAuthenticated, isInitLoading, selectedPoint, realEstateType, tradeType]);

  const mapSamples = result?.mapSamples || [];
  const isApartmentView = realEstateType === 'APT';

  const apartmentMarkers = useMemo<ApartmentMarker[]>(() => {
    const grouped = new Map<string, ApartmentMarker & { priceSum: number; priceCount: number }>();

    mapSamples
      .filter((sample) => sample.realEstateTypeCode === 'APT' || sample.realEstateTypeName === '아파트')
      .forEach((sample) => {
        const complexName = (sample.buildingName || sample.articleName || '아파트').trim();
        const key = `${complexName}__${sample.address || ''}`;
        const existing = grouped.get(key);

        if (!existing) {
          grouped.set(key, {
            id: key,
            complexName,
            latitude: sample.latitude,
            longitude: sample.longitude,
            address: sample.address || null,
            totalCount: 1,
            avgPrice: sample.price || 0,
            latestYmd: sample.articleConfirmYmd || null,
            samples: [sample],
            priceSum: sample.price && sample.price > 0 ? sample.price : 0,
            priceCount: sample.price && sample.price > 0 ? 1 : 0,
          });
          return;
        }

        existing.totalCount += 1;
        existing.samples.push(sample);
        if (sample.price && sample.price > 0) {
          existing.priceSum += sample.price;
          existing.priceCount += 1;
        }
        if ((sample.articleConfirmYmd || '') > (existing.latestYmd || '')) {
          existing.latestYmd = sample.articleConfirmYmd || null;
        }
      });

    return Array.from(grouped.values())
      .map(({ priceSum, priceCount, ...marker }) => ({
        ...marker,
        avgPrice: priceCount > 0 ? Math.round(priceSum / priceCount) : 0,
      }))
      .sort((a, b) => {
        if (b.totalCount !== a.totalCount) return b.totalCount - a.totalCount;
        return (b.latestYmd || '').localeCompare(a.latestYmd || '');
      });
  }, [mapSamples]);

  const propertyMarkers = useMemo<PropertyMarker[]>(() => {
    return [...mapSamples]
      .sort((a, b) => {
        const dateCompare = (b.articleConfirmYmd || '').localeCompare(a.articleConfirmYmd || '');
        if (dateCompare !== 0) return dateCompare;
        return (a.distanceM || Number.MAX_SAFE_INTEGER) - (b.distanceM || Number.MAX_SAFE_INTEGER);
      })
      .map((sample) => ({
        id: sample.id,
        sample,
      }));
  }, [mapSamples]);

  const activeMarkers = isApartmentView ? apartmentMarkers : propertyMarkers;

  useEffect(() => {
    if (activeMarkers.length === 0) {
      setSelectedMarkerId(null);
      return;
    }

    const alreadySelected = activeMarkers.some((marker) => marker.id === selectedMarkerId);
    if (!alreadySelected) {
      setSelectedMarkerId(activeMarkers[0].id);
    }
  }, [activeMarkers, selectedMarkerId]);

  const selectedApartmentMarker = useMemo(
    () => apartmentMarkers.find((marker) => marker.id === selectedMarkerId) || null,
    [apartmentMarkers, selectedMarkerId]
  );

  const selectedPropertyMarker = useMemo(
    () => propertyMarkers.find((marker) => marker.id === selectedMarkerId) || null,
    [propertyMarkers, selectedMarkerId]
  );

  const apartmentTransactionRows = useMemo(() => {
    if (!selectedApartmentMarker) return [];
    return [...selectedApartmentMarker.samples].sort((a, b) => {
      const dateCompare = (b.articleConfirmYmd || '').localeCompare(a.articleConfirmYmd || '');
      if (dateCompare !== 0) return dateCompare;
      return (a.distanceM || Number.MAX_SAFE_INTEGER) - (b.distanceM || Number.MAX_SAFE_INTEGER);
    });
  }, [selectedApartmentMarker]);

  const mapMarkers = useMemo<AddressMarketStatsMapMarker[]>(() => {
    if (isApartmentView) {
      return apartmentMarkers.map((marker) => ({
        id: marker.id,
        latitude: marker.latitude,
        longitude: marker.longitude,
        title: marker.complexName,
        badge: `${marker.totalCount}건`,
        subtitle: marker.avgPrice > 0 ? `평균 ${formatPriceMan(marker.avgPrice)}` : marker.address || undefined,
        variant: 'complex',
      }));
    }

    return propertyMarkers.map((marker) => ({
      id: marker.id,
      latitude: marker.sample.latitude,
      longitude: marker.sample.longitude,
      title: marker.sample.articleName,
      badge: formatTradePrice(marker.sample.price, marker.sample.rentPrc),
      subtitle: marker.sample.address,
      variant: 'property',
    }));
  }, [apartmentMarkers, isApartmentView, propertyMarkers]);

  const isPageLoading = isInitLoading || isLoading;
  const loadingMessage = isInitLoading
    ? '데이터와 지도를 준비하는 중...'
    : '주변 거래 데이터를 불러오는 중...';

  return (
    <>
      <div className="space-y-4 p-4 sm:p-6">
        {/* 페이지 타이틀 */}
        <h1 className="text-2xl font-bold text-hud-text-primary">주변 지역 거래 분석</h1>

        {/* 지도 상단 필터 + 지도 + 하단 목록을 하나의 카드로 */}
        <HudCard>
          <div className="space-y-4">
            {/* 지도 상단: 매물유형 선택 / 거래유형 선택 */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-hud-text-secondary">매물유형</label>
                <select
                  value={realEstateType}
                  onChange={(event) => setRealEstateType(event.target.value)}
                  className="w-[180px] rounded-lg border border-hud-border-secondary bg-hud-bg-primary px-3 py-2 text-sm text-hud-text-primary transition-colors focus:border-hud-accent-primary focus:outline-none"
                >
                  {PROPERTY_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-hud-text-secondary">거래유형</label>
                <select
                  value={tradeType}
                  onChange={(event) => setTradeType(event.target.value)}
                  className="w-[140px] rounded-lg border border-hud-border-secondary bg-hud-bg-primary px-3 py-2 text-sm text-hud-text-primary transition-colors focus:border-hud-accent-primary focus:outline-none"
                >
                  {TRADE_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 text-xs text-hud-text-muted">
                {isLoading && <Loader2 className="h-4 w-4 animate-spin text-hud-accent-primary" />}
                <span>참고: 국토부 공공데이타 / SGIS 통계지리정보서비스</span>
              </div>
            </div>

            {/* 지도 */}
            {isInitLoading ? (
              <div className="flex h-[520px] items-center justify-center rounded-xl border border-hud-border-secondary bg-hud-bg-secondary/30">
                <div className="flex items-center gap-2 text-sm text-hud-text-muted">
                  <Loader2 className="h-5 w-5 animate-spin text-hud-accent-primary" />
                  지도를 준비하는 중...
                </div>
              </div>
            ) : (
              <AddressMarketStatsMap
                center={mapCenter}
                selectedPoint={selectedPoint}
                markers={mapMarkers}
                activeMarkerId={selectedMarkerId}
                onSelectPoint={(point) => {
                  setSelectedPoint(point);
                  setMapCenter(point);
                }}
                onMarkerClick={(marker) => setSelectedMarkerId(marker.id)}
              />
            )}

            {/* 에러 표시 */}
            {error && (
              <div className="flex items-start gap-3 rounded-lg border border-hud-accent-danger/40 bg-hud-accent-danger/10 px-5 py-3 text-sm text-hud-accent-danger">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* 지도 하단: 마커 클릭 시 거래 정보 표시 */}
            {result && (
              <div>
                {mapMarkers.length === 0 ? (
                  /* 마커 없을 때 최근 거래 fallback */
                  result.recentTransactions.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-hud-text-primary">최근 거래 내역</p>
                      <div className="overflow-auto">
                        <table className="w-full min-w-[860px]">
                          <thead>
                            <tr className="border-b border-hud-border-secondary">
                              <th className="px-1 py-2 text-left text-xs font-medium text-hud-text-secondary">확정일</th>
                              <th className="px-1 py-2 text-left text-xs font-medium text-hud-text-secondary">매물</th>
                              <th className="px-1 py-2 text-left text-xs font-medium text-hud-text-secondary">유형/거래</th>
                              <th className="px-1 py-2 text-right text-xs font-medium text-hud-text-secondary">가격</th>
                              <th className="px-1 py-2 text-right text-xs font-medium text-hud-text-secondary">면적</th>
                              <th className="px-1 py-2 text-left text-xs font-medium text-hud-text-secondary">주소</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.recentTransactions.slice(0, 12).map((transaction) => (
                              <tr key={`${transaction.articleNo}-${transaction.articleConfirmYmd}`} className="border-b border-hud-border-secondary/40">
                                <td className="px-1 py-2 text-xs text-hud-text-secondary">{formatYmd(transaction.articleConfirmYmd)}</td>
                                <td className="px-1 py-2 text-sm text-hud-text-primary">
                                  <div className="max-w-[240px] truncate" title={transaction.articleName}>{transaction.articleName}</div>
                                  {transaction.buildingName && (
                                    <div className="max-w-[240px] truncate text-xs text-hud-text-muted" title={transaction.buildingName}>
                                      <Building2 className="mr-1 inline h-3 w-3" />
                                      {transaction.buildingName}
                                    </div>
                                  )}
                                </td>
                                <td className="px-1 py-2 text-xs text-hud-text-secondary">
                                  {transaction.realEstateTypeName} / {transaction.tradeTypeName}
                                </td>
                                <td className="px-1 py-2 text-right text-sm text-hud-accent-primary">
                                  {formatTradePrice(transaction.price, transaction.rentPrc)}
                                </td>
                                <td className="px-1 py-2 text-right text-sm text-hud-text-primary">{formatArea(transaction.area)}</td>
                                <td className="px-1 py-2 text-xs text-hud-text-muted">
                                  <div className="max-w-[280px] truncate" title={transaction.address}>{transaction.address || '-'}</div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <p className="py-4 text-center text-sm text-hud-text-muted">
                      표시할 거래 데이터가 없습니다. 지도를 클릭하여 다른 위치를 선택해 보세요.
                    </p>
                  )
                ) : isApartmentView ? (
                  /* 아파트: 마커 클릭 → 단지 거래 목록 */
                  selectedApartmentMarker ? (
                    <div className="space-y-3">
                      {/* 단지 요약 */}
                      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-hud-border-secondary pb-3">
                        <span className="text-base font-semibold text-hud-text-primary">{selectedApartmentMarker.complexName}</span>
                        <span className="text-sm text-hud-accent-primary">{selectedApartmentMarker.totalCount}건 · 평균 {formatPriceMan(selectedApartmentMarker.avgPrice)}</span>
                        {selectedApartmentMarker.address && (
                          <span className="text-xs text-hud-text-muted">{selectedApartmentMarker.address}</span>
                        )}
                      </div>

                    {/* 거래 테이블 */}
                    <div className="overflow-auto">
                      <table className="w-full min-w-[860px]">
                        <thead>
                          <tr className="border-b border-hud-border-secondary">
                            <th className="px-1 py-2 text-left text-xs font-medium text-hud-text-secondary">확정일</th>
                            <th className="px-1 py-2 text-left text-xs font-medium text-hud-text-secondary">매물명</th>
                            <th className="px-1 py-2 text-left text-xs font-medium text-hud-text-secondary">거래유형</th>
                            <th className="px-1 py-2 text-right text-xs font-medium text-hud-text-secondary">가격</th>
                            <th className="px-1 py-2 text-right text-xs font-medium text-hud-text-secondary">면적</th>
                            <th className="px-1 py-2 text-right text-xs font-medium text-hud-text-secondary">거리</th>
                            <th className="px-1 py-2 text-left text-xs font-medium text-hud-text-secondary">주소</th>
                          </tr>
                        </thead>
                        <tbody>
                          {apartmentTransactionRows.map((sample) => (
                            <tr key={sample.id} className="border-b border-hud-border-secondary/40">
                              <td className="px-1 py-2 text-xs text-hud-text-secondary">{formatYmd(sample.articleConfirmYmd)}</td>
                              <td className="px-1 py-2 text-sm text-hud-text-primary">
                                <div className="max-w-[240px] truncate" title={sample.articleName}>{sample.articleName}</div>
                                {sample.buildingName && (
                                  <div className="max-w-[240px] truncate text-xs text-hud-text-muted" title={sample.buildingName}>
                                    <Building2 className="mr-1 inline h-3 w-3" />
                                    {sample.buildingName}
                                  </div>
                                )}
                              </td>
                              <td className="px-1 py-2 text-xs text-hud-text-secondary">{sample.tradeTypeName}</td>
                              <td className="px-1 py-2 text-right text-sm text-hud-accent-primary">
                                {formatTradePrice(sample.price, sample.rentPrc)}
                              </td>
                              <td className="px-1 py-2 text-right text-sm text-hud-text-primary">{formatArea(sample.area)}</td>
                              <td className="px-1 py-2 text-right text-sm text-hud-text-primary">{formatDistance(sample.distanceM)}</td>
                              <td className="px-1 py-2 text-xs text-hud-text-muted">
                                <div className="max-w-[280px] truncate" title={sample.address}>{sample.address || '-'}</div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p className="py-4 text-center text-sm text-hud-text-muted">단지 마커를 클릭하면 거래 목록이 여기에 표시됩니다.</p>
                )
              ) : (
                /* 그외: 마커 클릭 → 거래 상세 정보 */
                selectedPropertyMarker ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      <div className="rounded-xl border border-hud-border-secondary bg-hud-bg-primary/70 p-3 md:col-span-2">
                        <p className="text-xs font-medium text-hud-text-secondary">매물명</p>
                        <p className="mt-1 text-base font-semibold text-hud-text-primary">{selectedPropertyMarker.sample.articleName}</p>
                        {selectedPropertyMarker.sample.buildingName && (
                          <p className="mt-0.5 text-xs text-hud-text-muted">
                            <Building2 className="mr-1 inline h-3 w-3" />
                            {selectedPropertyMarker.sample.buildingName}
                          </p>
                        )}
                      </div>
                      <div className="rounded-xl border border-hud-border-secondary bg-hud-bg-primary/70 p-3">
                        <p className="text-xs font-medium text-hud-text-secondary">거래가</p>
                        <p className="mt-1 text-base font-semibold text-hud-accent-primary">
                          {formatTradePrice(selectedPropertyMarker.sample.price, selectedPropertyMarker.sample.rentPrc)}
                        </p>
                        <p className="mt-0.5 text-xs text-hud-text-muted">{selectedPropertyMarker.sample.tradeTypeName}</p>
                      </div>
                      <div className="rounded-xl border border-hud-border-secondary bg-hud-bg-primary/70 p-3">
                        <p className="text-xs font-medium text-hud-text-secondary">면적 / 거리</p>
                        <p className="mt-1 text-base font-semibold text-hud-text-primary">{formatArea(selectedPropertyMarker.sample.area)}</p>
                        <p className="mt-0.5 text-xs text-hud-text-muted">{formatDistance(selectedPropertyMarker.sample.distanceM)}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-xl border border-hud-border-secondary bg-hud-bg-primary/70 p-3">
                        <p className="text-xs font-medium text-hud-text-secondary">매물유형</p>
                        <p className="mt-1 text-sm font-medium text-hud-text-primary">{selectedPropertyMarker.sample.realEstateTypeName}</p>
                      </div>
                      <div className="rounded-xl border border-hud-border-secondary bg-hud-bg-primary/70 p-3">
                        <p className="text-xs font-medium text-hud-text-secondary">확정일</p>
                        <p className="mt-1 text-sm font-medium text-hud-text-primary">{formatYmd(selectedPropertyMarker.sample.articleConfirmYmd)}</p>
                      </div>
                      <div className="rounded-xl border border-hud-border-secondary bg-hud-bg-primary/70 p-3">
                        <p className="text-xs font-medium text-hud-text-secondary">주소</p>
                        <p className="mt-1 text-sm font-medium text-hud-text-primary">{selectedPropertyMarker.sample.address || '-'}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="py-4 text-center text-sm text-hud-text-muted">매물 마커를 클릭하면 상세 정보가 여기에 표시됩니다.</p>
                )
              )}
            </div>
          )}
        </div>
      </HudCard>
      </div>

      {isPageLoading && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-hud-bg-primary/78 backdrop-blur-sm">
          <div className="flex min-w-[280px] items-center gap-3 rounded-2xl border border-hud-border-secondary bg-hud-bg-secondary/88 px-5 py-4 shadow-2xl">
            <Loader2 className="h-5 w-5 animate-spin text-hud-accent-primary" />
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-hud-text-primary">{loadingMessage}</p>
              <p className="text-xs text-hud-text-secondary">잠시만 기다려 주세요.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AddressMarketStats;
