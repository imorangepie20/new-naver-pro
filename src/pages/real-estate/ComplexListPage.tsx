// ============================================
// 아파트/오피스텔 단지 목록 페이지
// ============================================

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Building2,
  Map,
  MapPin,
  List,
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  X,
  Home,
  Users,
  Calendar,
  Square,
} from 'lucide-react';
import HudCard from '../../components/common/HudCard';
import Button from '../../components/common/Button';
import RegionSelectorModal from '../../components/real-estate/RegionSelectorModal';
import type { ComplexMarker, RealEstateTypeCode, TradeTypeCode } from '../../types/naver-land';

import { API_BASE } from '../../lib/api';

// 매물타입별 옵션
const PROPERTY_TYPE_OPTIONS = [
  { value: 'APT' as RealEstateTypeCode, label: '아파트' },
  { value: 'OPST' as RealEstateTypeCode, label: '오피스텔' },
];

// 거래방식 옵션
const TRADE_TYPE_OPTIONS = [
  { value: 'A1' as TradeTypeCode, label: '매매' },
  { value: 'B1' as TradeTypeCode, label: '전세' },
  { value: 'B2' as TradeTypeCode, label: '월세' },
];

const ITEMS_PER_PAGE = 50;

interface ComplexListPageProps {
  propertyType?: 'APT' | 'OPST';
}

const ComplexListPage: React.FC<ComplexListPageProps> = ({ propertyType = 'APT' }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // 상태
  const [complexes, setComplexes] = useState<ComplexMarker[]>([]);
  const [filteredComplexes, setFilteredComplexes] = useState<ComplexMarker[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 지역 선택
  const [showRegionModal, setShowRegionModal] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<{
    cortarNo: string;
    cortarName: string;
  } | null>(() => {
    const cortarNo = searchParams.get('cortarNo');
    const cortarName = searchParams.get('cortarName');
    return cortarNo && cortarName ? { cortarNo, cortarName } : null;
  });

  // 필터
  const [selectedPropertyType, setSelectedPropertyType] = useState<RealEstateTypeCode>(propertyType);
  const [selectedTradeType, setSelectedTradeType] = useState<TradeTypeCode>('A1' as TradeTypeCode);
  const [searchQuery, setSearchQuery] = useState('');

  // 뷰 모드
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);

  // 단지 데이터 로드
  useEffect(() => {
    if (selectedRegion) {
      fetchComplexes();
    }
  }, [selectedRegion, selectedPropertyType, selectedTradeType]);

  // 검색 필터
  useEffect(() => {
    let filtered = complexes;

    // 검색어 필터
    if (searchQuery) {
      filtered = filtered.filter((c) =>
        c.complexName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredComplexes(filtered);
    setCurrentPage(1);
  }, [searchQuery, complexes]);

  const fetchComplexes = async () => {
    if (!selectedRegion) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        cortarNo: selectedRegion.cortarNo,
        realEstateType: selectedPropertyType,
        tradeType: selectedTradeType,
      });

      const response = await fetch(`${API_BASE}/api/complexes?${params}`);
      if (!response.ok) {
        throw new Error('단지 목록을 불러오는데 실패했습니다.');
      }

      const data = await response.json();
      if (data.complexMarkerList) {
        // DB에서 주소 정보 가져오기 (단지번호 목록으로 일괄 조회)
        const complexNos = data.complexMarkerList.map((c: ComplexMarker) => c.markerId);
        const addressResponse = await fetch(`${API_BASE}/api/complexes/batch-address`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ complexNos }),
        });

        let addressMap: Record<string, { cortarAddress: string | null; roadAddress: string | null; detailAddress: string | null }> = {};

        if (addressResponse.ok) {
          const addressData = await addressResponse.json();
          addressMap = addressData.addresses || {};
        }

        // 네이버 API 데이터 + DB 주소 정보 병합
        const enrichedComplexes = data.complexMarkerList.map((c: ComplexMarker) => ({
          ...c,
          cortarAddress: addressMap[c.markerId]?.cortarAddress || undefined,
          roadAddress: addressMap[c.markerId]?.roadAddress || undefined,
          detailAddress: addressMap[c.markerId]?.detailAddress || undefined,
        }));

        setComplexes(enrichedComplexes);
      } else {
        setComplexes([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
      setComplexes([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 지역 선택 핸들러
  const handleRegionSelect = (region: { cortarNo: string; cortarName: string; cortarType?: string; centerLat?: number; centerLon?: number }) => {
    setSelectedRegion({ cortarNo: region.cortarNo, cortarName: region.cortarName });
    setSearchParams({ cortarNo: region.cortarNo, cortarName: region.cortarName });
    setShowRegionModal(false);
  };

  // 단지 클릭 핸들러
  const handleComplexClick = (complex: ComplexMarker) => {
    // 임시 매물 목록 페이지로 이동
    navigate('/real-estate/apartment-temp-properties?complexNo=' + complex.markerId);
  };

  // 페이지네이션
  const totalPages = Math.ceil(filteredComplexes.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentComplexes = filteredComplexes.slice(startIndex, endIndex);

  // 포맷 함수
  const formatArea = (area: string | number) => {
    const num = typeof area === 'string' ? parseFloat(area) : area;
    return num.toFixed(2);
  };

  const formatPriceCount = (count: number) => {
    if (count === 0) return '매물 없음';
    return `${count}건`;
  };

  const parseCompletionYear = (yearMonth: string) => {
    if (!yearMonth) return '-';
    const year = yearMonth.substring(0, 4);
    const month = yearMonth.substring(4, 6);
    return `${year}.${month}`;
  };

  return (
    <div className="container mx-auto p-4">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-hud-text-primary">
            {selectedPropertyType === 'APT' ? '아파트' : '오피스텔'} 단지 목록
          </h1>
          <div className="flex items-center gap-2 mt-1">
            {selectedRegion ? (
              <>
                <span className="text-hud-text-secondary">{selectedRegion.cortarName}</span>
                <button
                  onClick={() => {
                    setSelectedRegion(null);
                    setSearchParams({});
                    setComplexes([]);
                  }}
                  className="p-1 hover:bg-hud-bg-hover rounded"
                >
                  <X className="w-3 h-3 text-hud-text-muted" />
                </button>
              </>
            ) : (
              <span className="text-hud-text-muted">지역을 선택해주세요</span>
            )}
            {selectedRegion && (
              <span className="text-hud-text-muted">총 {filteredComplexes.length}개 단지</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRegionModal(true)}
          >
            <MapPin className="w-4 h-4 mr-1" />
            지역 선택
          </Button>
          <div className="flex items-center border border-hud-border-primary rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-hud-accent-primary text-white' : 'bg-hud-bg-primary text-hud-text-secondary'}`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`p-2 ${viewMode === 'map' ? 'bg-hud-accent-primary text-white' : 'bg-hud-bg-primary text-hud-text-secondary'}`}
            >
              <Map className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 필터 바 */}
      {selectedRegion && (
        <HudCard className="mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            {/* 매물타입 필터 */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-hud-text-secondary whitespace-nowrap">매물타입</span>
              <div className="flex gap-1">
                {PROPERTY_TYPE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSelectedPropertyType(option.value)}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${selectedPropertyType === option.value
                        ? 'bg-hud-accent-primary text-white'
                        : 'bg-hud-bg-secondary text-hud-text-secondary hover:bg-hud-bg-hover'
                      }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 거래방식 필터 */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-hud-text-secondary whitespace-nowrap">거래방식</span>
              <div className="flex gap-1">
                {TRADE_TYPE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSelectedTradeType(option.value)}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${selectedTradeType === option.value
                        ? 'bg-hud-accent-primary text-white'
                        : 'bg-hud-bg-secondary text-hud-text-secondary hover:bg-hud-bg-hover'
                      }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 검색 */}
            <div className="flex-1 flex items-center gap-2">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-hud-text-muted" />
                <input
                  type="text"
                  placeholder="단지명 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder:text-hud-text-muted focus:outline-none focus:border-hud-accent-primary"
                />
              </div>
            </div>
          </div>
        </HudCard>
      )}

      {/* 로딩/에러 상태 */}
      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-hud-accent-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-hud-text-muted">단지 목록을 불러오는 중...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-hud-bg-danger/10 border border-hud-border-danger rounded-lg p-4 text-hud-text-danger">
          {error}
        </div>
      )}

      {!selectedRegion && !isLoading && (
        <div className="flex flex-col items-center justify-center h-64 text-hud-text-muted">
          <Building2 className="w-16 h-16 mb-4 text-hud-text-secondary" />
          <p className="text-lg font-medium">지역을 선택해주세요</p>
          <p className="text-sm">지역을 선택하면 해당 지역의 단지 목록을 볼 수 있습니다.</p>
          <Button
            variant="primary"
            className="mt-4"
            onClick={() => setShowRegionModal(true)}
          >
            <MapPin className="w-4 h-4 mr-2" />
            지역 선택하기
          </Button>
        </div>
      )}

      {/* 단지 목록 (리스트 뷰) */}
      {viewMode === 'list' && !isLoading && !error && selectedRegion && (
        <>
          {filteredComplexes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-hud-text-muted">
              <Building2 className="w-16 h-16 mb-4" />
              <p className="text-lg font-medium">검색 결과가 없습니다</p>
              <p className="text-sm">검색 조건을 변경해보세요.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentComplexes.map((complex) => (
                  <div
                    key={complex.markerId}
                    onClick={() => handleComplexClick(complex)}
                    className="cursor-pointer hover:border-hud-accent-primary transition-colors rounded-lg p-4 bg-hud-bg-primary border border-hud-border-secondary"
                  >
                    <h3 className="font-semibold text-hud-text-primary mb-2">{complex.complexName}</h3>
                    <p className="text-sm text-hud-text-secondary">
                      {complex.cortarAddress || complex.totalHouseholdCount ? (
                        <>
                          {complex.cortarAddress && <span className="block truncate" title={complex.cortarAddress}>{complex.cortarAddress}</span>}
                          {complex.totalHouseholdCount && <span>{complex.totalHouseholdCount}세대</span>}
                        </>
                      ) : (
                        '-'
                      )}
                    </p>
                  </div>
                ))}
              </div>

              {/* 페이지네이션 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-8 h-8 text-sm rounded-md transition-colors ${currentPage === pageNum
                              ? 'bg-hud-accent-primary text-white'
                              : 'bg-hud-bg-secondary text-hud-text-secondary hover:bg-hud-bg-hover'
                            }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* 지도 뷰 (간단 구현) */}
      {viewMode === 'map' && !isLoading && !error && selectedRegion && (
        <HudCard className="h-[600px] flex items-center justify-center">
          <div className="text-center text-hud-text-muted">
            <Map className="w-16 h-16 mx-auto mb-4" />
            <p>지도 뷰는 현재 준비 중입니다.</p>
            <p className="text-sm mt-1">리스트 뷰를 이용해주세요.</p>
          </div>
        </HudCard>
      )}

      {/* 지역 선택 모달 */}
      <RegionSelectorModal
        isOpen={showRegionModal}
        onClose={() => setShowRegionModal(false)}
        onSelect={handleRegionSelect}
      />
    </div>
  );
};

export default ComplexListPage;
