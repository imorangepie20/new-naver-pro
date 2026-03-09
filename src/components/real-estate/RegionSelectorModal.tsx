// ============================================
// 지역 선택 모달 컴포넌트
// 시/도 → 시/군/구 → 읍/면/동 계층 선택
// HUD 테마 기반
// ============================================

import { useState, useEffect } from 'react';
import { X, ChevronRight, MapPin, Loader2, Navigation } from 'lucide-react';

interface Region {
  cortarNo: string;
  cortarName: string;
  cortarType: 'city' | 'dvsn' | 'dongs';
  centerLat?: number;
  centerLon?: number;
  children?: Region[];
}

interface RegionSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (region: Region) => void;
}

import { API_BASE } from '../../lib/api';

const POPULAR_REGIONS = [
  { cortarNo: '1100000000', cortarName: '서울', cortarType: 'city' as const },
  { cortarNo: '4100000000', cortarName: '경기', cortarType: 'city' as const },
  { cortarNo: '2100000000', cortarName: '부산', cortarType: 'city' as const },
  { cortarNo: '3000000000', cortarName: '대전', cortarType: 'city' as const },
  { cortarNo: '2500000000', cortarName: '대구', cortarType: 'city' as const },
  { cortarNo: '2600000000', cortarName: '광주', cortarType: 'city' as const },
];

const RegionSelectorModal: React.FC<RegionSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedPath, setSelectedPath] = useState<Region[]>([]);
  const [currentRegions, setCurrentRegions] = useState<Region[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 최상위 지역 로드
  useEffect(() => {
    if (isOpen) {
      loadTopRegions();
      setSearchQuery('');
    }
  }, [isOpen]);

  const loadTopRegions = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/regions?cortarNo=0000000000`);
      const data = await response.json();
      setRegions(data.regionList || []);
      setCurrentRegions(data.regionList || []);
      setSelectedPath([]);
    } catch (error) {
      console.error('Failed to load regions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadChildRegions = async (region: Region) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/regions?cortarNo=${region.cortarNo}`);
      const data = await response.json();
      const children = data.regionList || [];
      setCurrentRegions(children);
    } catch (error) {
      console.error('Failed to load child regions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegionClick = (region: Region) => {
    const newPath = [...selectedPath, region];
    setSelectedPath(newPath);
    loadChildRegions(region);
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      // 최상위 레벨로
      setSelectedPath([]);
      setCurrentRegions(regions);
    } else {
      const slicedPath = selectedPath.slice(0, index + 1);
      setSelectedPath(slicedPath);
      if (index === slicedPath.length - 1) {
        setCurrentRegions([slicedPath[index]]);
      } else {
        loadChildRegions(slicedPath[slicedPath.length - 1]);
      }
    }
  };

  const handleBackClick = () => {
    if (selectedPath.length === 0) return;

    const newPath = selectedPath.slice(0, -1);

    if (newPath.length === 0) {
      setCurrentRegions(regions);
    } else {
      const parentRegion = newPath[newPath.length - 1];
      loadChildRegions(parentRegion);
    }

    setSelectedPath(newPath);
  };

  const handleSelect = () => {
    if (selectedPath.length > 0) {
      onSelect(selectedPath[selectedPath.length - 1]);
      handleClose();
    }
  };

  const handlePopularSelect = (region: Region) => {
    // 인기 지역 선택 시 최상위 지역 선택과 동일하게 동작
    // (하위 지역 목록을 보여줌)
    handleRegionClick(region);
  };

  const handleClose = () => {
    onClose();
    setSelectedPath([]);
    setCurrentRegions(regions);
    setSearchQuery('');
  };

  // 검색 필터링
  const filteredRegions = currentRegions.filter(region =>
    region.cortarName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="hud-modal-overlay">
      {/* 백드롭 */}
      <div
        className="hud-modal-backdrop"
        onClick={handleClose}
      />

      {/* 모달 컨텐츠 */}
      <div className="hud-modal-panel w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* 헤더 */}
        <div className="hud-modal-header px-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-hud-accent-primary/10 rounded-lg">
              <MapPin className="w-5 h-5 text-hud-accent-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-hud-text-primary">지역 선택</h2>
              <p className="text-xs text-hud-text-muted">시/도 → 시/군/구 → 읍/면/동 순서로 선택</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="hud-modal-close group"
          >
            <X className="w-5 h-5 text-hud-text-muted group-hover:text-hud-text-primary" />
          </button>
        </div>

        {/* 인기 지역 빠른 선택 (초기 상태) */}
        {selectedPath.length === 0 && (
          <div className="px-5 py-3 border-b border-hud-border-secondary bg-hud-bg-primary/50">
            <div className="flex items-center gap-2 mb-2">
              <Navigation className="w-4 h-4 text-hud-accent-primary" />
              <span className="text-xs font-medium text-hud-text-secondary uppercase tracking-wider">인기 지역</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {POPULAR_REGIONS.map((region) => (
                <button
                  key={region.cortarNo}
                  onClick={() => handlePopularSelect(region)}
                  className="px-3 py-1.5 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary hover:border-hud-accent-primary hover:text-hud-accent-primary transition-colors"
                >
                  {region.cortarName}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 브레드크럼 */}
        {selectedPath.length > 0 && (
          <div className="px-5 py-3 border-b border-hud-border-secondary bg-hud-bg-primary/30">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin">
              <button
                onClick={() => handleBreadcrumbClick(-1)}
                className="flex items-center gap-1 px-2 py-1 text-sm text-hud-accent-primary hover:bg-hud-accent-primary/10 rounded-lg transition-colors whitespace-nowrap"
              >
                <MapPin size={14} />
                <span>전국</span>
              </button>
              {selectedPath.map((region, index) => (
                <div key={region.cortarNo} className="flex items-center gap-1">
                  <ChevronRight className="w-4 h-4 text-hud-text-muted flex-shrink-0" />
                  <button
                    onClick={() => handleBreadcrumbClick(index)}
                    className={`px-2 py-1 text-sm rounded-lg transition-colors whitespace-nowrap ${index === selectedPath.length - 1
                      ? 'text-hud-text-primary font-medium bg-hud-bg-hover'
                      : 'text-hud-accent-primary hover:bg-hud-accent-primary/10'
                      }`}
                  >
                    {region.cortarName}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 검색 입력 */}
        <div className="px-5 py-3 border-b border-hud-border-secondary">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="지역명 검색..."
              className="w-full pl-10 pr-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-colors"
            />
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hud-text-muted" />
          </div>
        </div>

        {/* 지역 목록 */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-10 h-10 text-hud-accent-primary animate-spin mb-3" />
              <p className="text-sm text-hud-text-muted">불러오는 중...</p>
            </div>
          ) : filteredRegions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <MapPin className="w-12 h-12 text-hud-text-muted mb-3" />
              <p className="text-sm text-hud-text-muted">검색 결과가 없습니다</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {filteredRegions.map((region) => (
                <button
                  key={region.cortarNo}
                  onClick={() => handleRegionClick(region)}
                  className="group relative px-4 py-3 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-left hover:border-hud-accent-primary hover:shadow-hud-glow transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-hud-text-primary group-hover:text-hud-accent-primary truncate pr-2">
                      {region.cortarName}
                    </span>
                    <ChevronRight className="w-4 h-4 text-hud-text-muted group-hover:text-hud-accent-primary flex-shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="hud-modal-footer justify-between px-5">
          <div className="text-sm text-hud-text-muted">
            {selectedPath.length > 0 ? (
              <span>
                선택: <span className="text-hud-text-primary font-medium">{selectedPath[selectedPath.length - 1].cortarName}</span>
              </span>
            ) : (
              <span>지역을 선택해주세요</span>
            )}
          </div>
          <div className="flex gap-2">
            {selectedPath.length > 0 && (
              <>
                <button
                  onClick={handleBackClick}
                  className="px-4 py-2 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary hover:bg-hud-bg-hover transition-colors"
                >
                  돌아가기
                </button>
                <button
                  onClick={handleSelect}
                  className="px-5 py-2 bg-hud-accent-primary text-hud-bg-primary rounded-lg text-sm font-medium hover:bg-hud-accent-primary/90 transition-colors shadow-hud-glow"
                >
                  선택 완료
                </button>
              </>
            )}
            {selectedPath.length === 0 && (
              <button
                onClick={handleClose}
                className="px-5 py-2 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary hover:bg-hud-bg-hover transition-colors"
              >
                취소
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegionSelectorModal;
