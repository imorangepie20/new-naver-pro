import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Building2,
  Loader2,
  MapPin,
  MousePointerClick,
} from 'lucide-react';
import HudCard from '../../components/common/HudCard';
import Button from '../../components/common/Button';
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
  { label: '빌라', value: 'VL' },
  { label: '원룸', value: 'ONEROOM' },
  { label: '투룸', value: 'TWOROOM' },
  { label: '상가', value: 'SG' },
];

const TRADE_TYPE_OPTIONS = [
  { label: '매매', value: 'A1' },
  { label: '전세', value: 'B1' },
  { label: '월세', value: 'B2' },
];

const DEFAULT_MAP_CENTER: MapPoint = {
  latitude: 37.5665,
  longitude: 126.978,
};

function formatPriceMan(price: number | null | undefined) {
  if (!price || price <= 0) return '-';
  const uk = Math.floor(price / 10000);
  const man = price % 10000;
  if (uk > 0) return man > 0 ? `${uk}억 ${man.toLocaleString()}만` : `${uk}억`;
  return `${price.toLocaleString()}만`;
}

function formatTradePrice(price: number | null | undefined, rentPrc: number | null | undefined) {
  const basePrice = formatPriceMan(price);
  if (!rentPrc || rentPrc <= 0) return basePrice;
  if (basePrice === '-') return `월 ${rentPrc.toLocaleString()}만`;
  return `${basePrice} / 월 ${rentPrc.toLocaleString()}만`;
}

function formatArea(area: number | null | undefined) {
  if (!area || area <= 0) return '-';
  return `${area.toFixed(2)}㎡`;
}

function formatYmd(ymd: string | null | undefined) {
  if (!ymd || !/^\d{8}$/.test(ymd)) return '-';
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}

function formatDistance(distanceM: number | null | undefined) {
  if (!distanceM || distanceM <= 0) return '-';
  return `${distanceM.toLocaleString()}m`;
}

function marketSourceMetaText(sourceType?: string) {
  if (!sourceType) return '국토부 실거래가 기준';
  if (sourceType.includes('molit')) return '국토부 실거래가 기준';
  if (sourceType.includes('LOCAL_DB')) return '내 DB 좌표 표본 기준';
  if (sourceType.includes('reb')) return 'REB 통계 기준';
  return '외부 데이터 기준';
}

const AddressMarketStats = () => {
  const authFetch = useAuthStore((state) => state.authFetch);
  const authChecked = useAuthStore((state) => state.authChecked);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [isInitLoading, setIsInitLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [officeInfo, setOfficeInfo] = useState<{ companyName?: string | null; address?: string | null } | null>(null);
  const [officeCenter, setOfficeCenter] = useState<MapPoint | null>(null);
  const [mapCenter, setMapCenter] = useState<MapPoint>(DEFAULT_MAP_CENTER);
  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null);
  const [pointOrigin, setPointOrigin] = useState<'office' | 'manual'>('office');

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
        source: 'molit',
        monthsBack: '2',
        realEstateType,
        tradeType,
      });

      const response = await authFetch(`${API_BASE}/api/statistics/address-market?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) throw new Error('로그인이 만료되었습니다. 다시 로그인해 주세요.');
        throw new Error(data.error || '거래 통계 조회에 실패했습니다.');
      }

      if (requestId !== requestIdRef.current) return;

      setResult(data as AddressMarketResult);
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

  useEffect(() => {
    if (!authChecked) return;

    if (!isAuthenticated) {
      setIsInitLoading(false);
      setResult(null);
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
      } catch (initError) {
        console.error('Office center load failed:', initError);
        if (mounted) {
          setError('사무실 위치를 불러오지 못했습니다. 프로필의 사무실 주소를 확인해 주세요.');
          setPointOrigin('manual');
        }
      } finally {
        if (mounted) {
          setIsInitLoading(false);
        }
      }
    };

    void loadInitialOfficeCenter();

    return () => {
      mounted = false;
    };
  }, [authChecked, authFetch, isAuthenticated]);

  useEffect(() => {
    if (!authChecked || !isAuthenticated || isInitLoading || !selectedPoint) return;
    void analyzeAroundPoint(selectedPoint);
  }, [authChecked, isAuthenticated, isInitLoading, selectedPoint, realEstateType, tradeType]);

  const propertyTypeLabel = useMemo(
    () => PROPERTY_TYPE_OPTIONS.find((option) => option.value === realEstateType)?.label || '매물',
    [realEstateType]
  );

  const tradeTypeLabel = useMemo(
    () => TRADE_TYPE_OPTIONS.find((option) => option.value === tradeType)?.label || '거래',
    [tradeType]
  );

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

  const summaryCards = useMemo(() => {
    if (!result) return [];

    return [
      {
        label: '현재 필터',
        value: `${propertyTypeLabel} / ${tradeTypeLabel}`,
        hint: '지도 상단 필터 기준',
      },
      {
        label: '전체 거래 표본',
        value: `${result.summary.totalCount.toLocaleString()}건`,
        hint: result.sourceMeta?.region || '선택 위치 기준',
      },
      {
        label: '평균 거래가',
        value: formatPriceMan(result.summary.avgPrice),
        hint: result.summary.medianPrice > 0 ? `중위가 ${formatPriceMan(result.summary.medianPrice)}` : '가격 정보 없음',
      },
      {
        label: '지도 마커',
        value: `${mapMarkers.length.toLocaleString()}개`,
        hint: '좌표가 있는 거래 데이터만 표시',
      },
    ];
  }, [mapMarkers.length, propertyTypeLabel, result, tradeTypeLabel]);

  const renderFallbackRecentTransactions = () => {
    if (!result || result.recentTransactions.length === 0) {
      return (
        <p className="text-sm text-hud-text-muted">
          지도에 표시할 좌표형 거래 데이터가 아직 없습니다.
        </p>
      );
    }

    return (
      <div className="overflow-auto">
        <table className="w-full min-w-[860px]">
          <thead>
            <tr className="border-b border-hud-border-secondary">
              <th className="px-1 py-2 text-left text-xs text-hud-text-muted">확정일</th>
              <th className="px-1 py-2 text-left text-xs text-hud-text-muted">매물</th>
              <th className="px-1 py-2 text-left text-xs text-hud-text-muted">유형/거래</th>
              <th className="px-1 py-2 text-right text-xs text-hud-text-muted">가격</th>
              <th className="px-1 py-2 text-right text-xs text-hud-text-muted">면적</th>
              <th className="px-1 py-2 text-left text-xs text-hud-text-muted">주소</th>
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
    );
  };

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold text-hud-text-primary">지역 거래 통계 분석</h1>
        <p className="mt-1 text-sm text-hud-text-muted">
          국토부 실거래가와 내부 좌표 표본을 함께 사용해 지역 거래를 지도 중심으로 다시 보여줍니다.
        </p>
      </div>

      <HudCard>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-hud-text-primary">{officeInfo?.companyName || '내 사무실 기준'}</p>
            <p className="text-xs text-hud-text-muted">
              {officeInfo?.address || '프로필의 사무실 주소를 기준으로 중심점을 불러옵니다.'}
            </p>
            <p className="text-xs text-hud-text-muted">
              현재 중심점: {pointOrigin === 'office' ? '사무실 위치' : '지도에서 직접 선택한 위치'}
            </p>
          </div>

          {officeCenter && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<MapPin size={14} />}
              onClick={() => {
                setSelectedPoint(officeCenter);
                setMapCenter(officeCenter);
                setPointOrigin('office');
              }}
            >
              사무실 위치로 복원
            </Button>
          )}
        </div>
      </HudCard>

      <HudCard
        title="거래 지도"
        subtitle="지도 상단에서 매물유형과 거래유형을 바꾸면 자동으로 다시 분석합니다."
        action={(
          <div className="flex items-center gap-2 text-xs text-hud-text-muted">
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-hud-accent-primary" />}
            {selectedPoint
              ? `${selectedPoint.latitude.toFixed(5)}, ${selectedPoint.longitude.toFixed(5)}`
              : '중심점 준비 중'}
          </div>
        )}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[220px_220px_1fr]">
            <div className="space-y-1">
              <label className="text-xs text-hud-text-muted">매물유형 선택</label>
              <select
                value={realEstateType}
                onChange={(event) => setRealEstateType(event.target.value)}
                className="w-full rounded-lg border border-hud-border-secondary bg-hud-bg-primary px-3 py-2.5 text-sm text-hud-text-primary transition-colors focus:border-hud-accent-primary focus:outline-none"
              >
                {PROPERTY_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-hud-text-muted">거래유형 선택</label>
              <select
                value={tradeType}
                onChange={(event) => setTradeType(event.target.value)}
                className="w-full rounded-lg border border-hud-border-secondary bg-hud-bg-primary px-3 py-2.5 text-sm text-hud-text-primary transition-colors focus:border-hud-accent-primary focus:outline-none"
              >
                {TRADE_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-hud-accent-info/30 bg-hud-accent-info/10 px-3 py-2.5 text-sm text-hud-accent-info">
              <MousePointerClick className="h-4 w-4" />
              <span>
                빈 지도를 클릭하면 중심점을 바꾸고, 마커를 클릭하면 아래 목록 또는 상세 정보가 바뀝니다.
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-hud-border-secondary/70 bg-hud-bg-secondary/30 p-3 text-xs text-hud-text-muted">
            {isApartmentView
              ? '아파트는 거래 데이터가 있는 단지 단위로 묶어서 마커를 표시합니다.'
              : '아파트 외 유형은 거래 데이터가 있는 개별 매물을 마커로 표시합니다.'}
          </div>

          <AddressMarketStatsMap
            center={mapCenter}
            selectedPoint={selectedPoint}
            markers={mapMarkers}
            activeMarkerId={selectedMarkerId}
            onSelectPoint={(point) => {
              setSelectedPoint(point);
              setMapCenter(point);
              setPointOrigin('manual');
            }}
            onMarkerClick={(marker) => setSelectedMarkerId(marker.id)}
          />
        </div>
      </HudCard>

      {isInitLoading && (
        <div className="flex items-center justify-center gap-3 rounded-lg border border-hud-border-secondary bg-hud-bg-secondary px-6 py-4 text-sm text-hud-text-muted">
          <Loader2 className="h-5 w-5 animate-spin text-hud-accent-primary" />
          <div>
            <p className="font-medium text-hud-text-primary">사무실 위치를 불러오는 중...</p>
            <p className="mt-1 text-xs text-hud-text-muted">초기 중심점을 준비한 뒤 거래 분석을 시작합니다.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-hud-accent-danger/40 bg-hud-accent-danger/10 px-6 py-4 text-sm text-hud-accent-danger">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <div>
            <p className="font-medium">오류 발생</p>
            <p className="mt-1 text-xs opacity-90">{error}</p>
          </div>
        </div>
      )}

      {result && (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => (
              <div key={card.label} className="rounded-xl border border-hud-border-secondary bg-hud-bg-primary/70 p-4">
                <p className="text-xs text-hud-text-muted">{card.label}</p>
                <p className="mt-2 text-lg font-semibold text-hud-text-primary">{card.value}</p>
                <p className="mt-1 text-xs text-hud-text-muted">{card.hint}</p>
              </div>
            ))}
          </div>

          {result.sourceMeta && (
            <HudCard className="p-0">
              <div className="flex flex-wrap items-center gap-2 px-5 py-4 text-xs">
                <span className="rounded-md border border-hud-accent-info/40 bg-hud-accent-info/10 px-2 py-1 text-hud-accent-info">
                  소스: {marketSourceMetaText(result.sourceMeta.sourceType)}
                </span>
                {result.sourceMeta.serviceName && (
                  <span className="text-hud-text-muted">제공처: {result.sourceMeta.serviceName}</span>
                )}
                {result.sourceMeta.region && (
                  <span className="text-hud-text-muted">지역: {result.sourceMeta.region}</span>
                )}
                {typeof result.sourceMeta.analyzedRows === 'number' && (
                  <span className="text-hud-text-muted">분석 표본: {result.sourceMeta.analyzedRows.toLocaleString()}건</span>
                )}
                {typeof result.sourceMeta.nearbyRegionCount === 'number' && (
                  <span className="text-hud-text-muted">인접 지역: {result.sourceMeta.nearbyRegionCount}개</span>
                )}
              </div>
            </HudCard>
          )}

          <HudCard
            title={isApartmentView ? '아파트 거래 목록' : '거래 상세 정보'}
            subtitle={
              isApartmentView
                ? '마커를 클릭하면 해당 단지의 거래 목록을 아래에 보여줍니다.'
                : '마커를 클릭하면 해당 매물의 거래 상세 정보를 아래에 보여줍니다.'
            }
          >
            {mapMarkers.length === 0 ? (
              renderFallbackRecentTransactions()
            ) : isApartmentView ? (
              selectedApartmentMarker ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    <div className="rounded-xl border border-hud-border-secondary bg-hud-bg-primary/70 p-4 md:col-span-2">
                      <p className="text-xs text-hud-text-muted">선택 단지</p>
                      <p className="mt-2 text-lg font-semibold text-hud-text-primary">{selectedApartmentMarker.complexName}</p>
                      <p className="mt-1 text-xs text-hud-text-muted">{selectedApartmentMarker.address || '주소 정보 없음'}</p>
                    </div>
                    <div className="rounded-xl border border-hud-border-secondary bg-hud-bg-primary/70 p-4">
                      <p className="text-xs text-hud-text-muted">표시 거래 수</p>
                      <p className="mt-2 text-lg font-semibold text-hud-text-primary">{selectedApartmentMarker.totalCount.toLocaleString()}건</p>
                      <p className="mt-1 text-xs text-hud-text-muted">지도 좌표가 있는 거래 기준</p>
                    </div>
                    <div className="rounded-xl border border-hud-border-secondary bg-hud-bg-primary/70 p-4">
                      <p className="text-xs text-hud-text-muted">평균 거래가</p>
                      <p className="mt-2 text-lg font-semibold text-hud-accent-primary">{formatPriceMan(selectedApartmentMarker.avgPrice)}</p>
                      <p className="mt-1 text-xs text-hud-text-muted">최근 확인 {formatYmd(selectedApartmentMarker.latestYmd)}</p>
                    </div>
                  </div>

                  <div className="overflow-auto">
                    <table className="w-full min-w-[940px]">
                      <thead>
                        <tr className="border-b border-hud-border-secondary">
                          <th className="px-1 py-2 text-left text-xs text-hud-text-muted">확정일</th>
                          <th className="px-1 py-2 text-left text-xs text-hud-text-muted">매물명</th>
                          <th className="px-1 py-2 text-left text-xs text-hud-text-muted">거래유형</th>
                          <th className="px-1 py-2 text-right text-xs text-hud-text-muted">가격</th>
                          <th className="px-1 py-2 text-right text-xs text-hud-text-muted">면적</th>
                          <th className="px-1 py-2 text-right text-xs text-hud-text-muted">거리</th>
                          <th className="px-1 py-2 text-left text-xs text-hud-text-muted">주소</th>
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
                <p className="text-sm text-hud-text-muted">단지 마커를 선택해 주세요.</p>
              )
            ) : selectedPropertyMarker ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border border-hud-border-secondary bg-hud-bg-primary/70 p-4 xl:col-span-2">
                    <p className="text-xs text-hud-text-muted">매물명</p>
                    <p className="mt-2 text-lg font-semibold text-hud-text-primary">{selectedPropertyMarker.sample.articleName}</p>
                    {selectedPropertyMarker.sample.buildingName && (
                      <p className="mt-1 text-xs text-hud-text-muted">
                        <Building2 className="mr-1 inline h-3 w-3" />
                        {selectedPropertyMarker.sample.buildingName}
                      </p>
                    )}
                  </div>
                  <div className="rounded-xl border border-hud-border-secondary bg-hud-bg-primary/70 p-4">
                    <p className="text-xs text-hud-text-muted">거래가</p>
                    <p className="mt-2 text-lg font-semibold text-hud-accent-primary">
                      {formatTradePrice(selectedPropertyMarker.sample.price, selectedPropertyMarker.sample.rentPrc)}
                    </p>
                    <p className="mt-1 text-xs text-hud-text-muted">{selectedPropertyMarker.sample.tradeTypeName}</p>
                  </div>
                  <div className="rounded-xl border border-hud-border-secondary bg-hud-bg-primary/70 p-4">
                    <p className="text-xs text-hud-text-muted">전용면적 / 거리</p>
                    <p className="mt-2 text-lg font-semibold text-hud-text-primary">{formatArea(selectedPropertyMarker.sample.area)}</p>
                    <p className="mt-1 text-xs text-hud-text-muted">{formatDistance(selectedPropertyMarker.sample.distanceM)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-hud-border-secondary bg-hud-bg-primary/70 p-4">
                    <p className="text-xs text-hud-text-muted">매물유형</p>
                    <p className="mt-2 text-sm font-medium text-hud-text-primary">{selectedPropertyMarker.sample.realEstateTypeName}</p>
                  </div>
                  <div className="rounded-xl border border-hud-border-secondary bg-hud-bg-primary/70 p-4">
                    <p className="text-xs text-hud-text-muted">확정일</p>
                    <p className="mt-2 text-sm font-medium text-hud-text-primary">{formatYmd(selectedPropertyMarker.sample.articleConfirmYmd)}</p>
                  </div>
                  <div className="rounded-xl border border-hud-border-secondary bg-hud-bg-primary/70 p-4">
                    <p className="text-xs text-hud-text-muted">주소</p>
                    <p className="mt-2 text-sm font-medium text-hud-text-primary">{selectedPropertyMarker.sample.address || '-'}</p>
                  </div>
                </div>

                <div className="overflow-auto">
                  <table className="w-full min-w-[860px]">
                    <thead>
                      <tr className="border-b border-hud-border-secondary">
                        <th className="px-1 py-2 text-left text-xs text-hud-text-muted">확정일</th>
                        <th className="px-1 py-2 text-left text-xs text-hud-text-muted">매물</th>
                        <th className="px-1 py-2 text-left text-xs text-hud-text-muted">유형/거래</th>
                        <th className="px-1 py-2 text-right text-xs text-hud-text-muted">가격</th>
                        <th className="px-1 py-2 text-right text-xs text-hud-text-muted">면적</th>
                        <th className="px-1 py-2 text-left text-xs text-hud-text-muted">주소</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result?.recentTransactions.slice(0, 10).map((transaction) => (
                        <tr key={`${transaction.articleNo}-${transaction.articleConfirmYmd}`} className="border-b border-hud-border-secondary/40">
                          <td className="px-1 py-2 text-xs text-hud-text-secondary">{formatYmd(transaction.articleConfirmYmd)}</td>
                          <td className="px-1 py-2 text-sm text-hud-text-primary">
                            <div className="max-w-[240px] truncate" title={transaction.articleName}>{transaction.articleName}</div>
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
              <p className="text-sm text-hud-text-muted">매물 마커를 선택해 주세요.</p>
            )}
          </HudCard>
        </>
      )}

      {!result && !isLoading && !isInitLoading && !error && (
        <HudCard className="p-12 text-center">
          <div className="mx-auto max-w-md space-y-3">
            <p className="text-lg font-medium text-hud-text-primary">지역 거래 통계 분석 준비 완료</p>
            <p className="text-sm text-hud-text-muted">
              기본값은 아파트 / 매매입니다. 지도 위 거래 마커를 클릭하면 하단에서 단지 거래 목록 또는 상세 정보를 확인할 수 있습니다.
            </p>
          </div>
        </HudCard>
      )}
    </div>
  );
};

export default AddressMarketStats;
