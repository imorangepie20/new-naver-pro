// ============================================
// 네이버 부동산 매물 검색 페이지
// HUD 테마 기반 반응형 UI
// ============================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search,
    RefreshCw,
    Building2,
    MapPin,
    Loader2,
    Home,
    AlertCircle,
    ChevronDown,
    X,
    Map,
    Heart,
    HeartOff,
    SlidersHorizontal,
    TrendingUp,
    ArrowUpDown,
    Layers,
    CheckSquare,
    Square,
    Eye,
} from 'lucide-react';
import RegionSelectorModal from '../../components/real-estate/RegionSelectorModal';
import PropertyMapView from '../../components/real-estate/PropertyMapView';
import HudCard from '../../components/common/HudCard';
import Button from '../../components/common/Button';
import type { RealEstateTypeCode, TradeTypeCode } from '../../types/naver-land';
import { useAuthStore } from '../../stores/authStore';

import { API_BASE } from '../../lib/api';

// ============================================
// 타입 정의
// ============================================

type Article = {
    articleNo: string;
    articleName: string;
    tradeTypeName: string;
    tradeTypeCode: string;
    dealOrWarrantPrc: string | null;  // API 응답은 문자열 "9억 5,000"
    rentPrc?: number;  // 월세
    area1: number;
    area2: number;
    floorInfo: string;
    direction?: string;
    articleConfirmYmd: string;
    buildingName?: string;
    realEstateTypeName: string;
    realEstateTypeCode: string;
    tagList: string[];
    latitude?: string;
    longitude?: string;
    cortarNo: string;
    complexNo?: string;
};

type Complex = {
    markerId: string;  // complexNo
    complexName: string;
    realEstateTypeName: string;
    realEstateTypeCode: string;
    latitude: number;
    longitude: number;
    dealCount?: number;
    leaseCount?: number;
    rentCount?: number;
    totalArticleCount?: number;
    // 추가 정보 (네이버 API에서 제공)
    completionYearMonth?: string;    // 준공 연월 "201711"
    totalHouseholdCount?: number;    // 총 세대수
    totalDongCount?: number;         // 총 동수
    minArea?: string;                // 최소 면적 "59.91"
    maxArea?: string;                // 최대 면적 "84.99"
    representativeArea?: number;     // 대표 면적
    floorAreaRatio?: number;         // 용적률
    // 대표 가격 정보 (서버에서 첫번째 매물 기준)
    representativePrice?: string;    // "9억 5,000" | "7,500"
    representativeTrade?: string;    // "매매" | "전세" | "월세"
    representativeTradeCode?: string; // "A1" | "B1" | "B2"
    representativeRentPrc?: string;   // 월세일 때 월 임대료
};

type Region = {
    cortarNo: string;
    cortarName: string;
    cortarType: string;
    centerLat?: number;
    centerLon?: number;
};

type SortOption = 'rank' | 'price' | 'area' | 'date';

// ============================================
// 상수 정의
// ============================================

const PROPERTY_TYPES = [
    { code: 'APT' as const, name: '아파트', icon: <Building2 size={16} /> },
    { code: 'OPST' as const, name: '오피스텔', icon: <Building2 size={16} /> },
    { code: 'VL' as const, name: '빌라/연립', icon: <Home size={16} /> },
    { code: 'DDDGG' as const, name: '단독/다가구', icon: <Home size={16} /> },
    { code: 'ONEROOM' as const, name: '원룸', icon: <Home size={16} /> },
    { code: 'TWOROOM' as const, name: '투룸', icon: <Home size={16} /> },
    { code: 'SG' as const, name: '상가', icon: <Layers size={16} /> },
];

const TRADE_TYPES = [
    { code: 'A1' as const, name: '매매', color: 'bg-hud-accent-danger/10 text-hud-accent-danger' },
    { code: 'B1' as const, name: '전세', color: 'bg-hud-accent-success/10 text-hud-accent-success' },
    { code: 'B2' as const, name: '월세', color: 'bg-hud-accent-warning/10 text-hud-accent-warning' },
];

const SORT_OPTIONS: { value: SortOption; label: string; icon: React.ReactNode }[] = [
    { value: 'rank', label: '정확순', icon: <TrendingUp size={14} /> },
    { value: 'price', label: '가격순', icon: <ArrowUpDown size={14} /> },
    { value: 'area', label: '면적순', icon: <Layers size={14} /> },
    { value: 'date', label: '최신순', icon: <Home size={14} /> },
];

// ============================================
// 컴포넌트
// ============================================

const RealEstate = () => {
    const navigate = useNavigate();
    const authFetch = useAuthStore((state) => state.authFetch);

    // ============================================
    // State
    // ============================================
    const [selectedType, setSelectedType] = useState<RealEstateTypeCode>('APT');
    const [selectedTrade, setSelectedTrade] = useState<TradeTypeCode>('A1');
    const [priceMin, setPriceMin] = useState<number>(0);
    const [priceMax, setPriceMax] = useState<number>(1000000); // 만원단위
    const [areaMin, setAreaMin] = useState<number>(0);
    const [areaMax, setAreaMax] = useState<number>(200);
    const [sortBy, setSortBy] = useState<SortOption>('rank');

    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [articles, setArticles] = useState<Article[]>([]);
    const [complexes, setComplexes] = useState<Complex[]>([]);
    const [hasSearched, setHasSearched] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    // 지역 선택
    const [showRegionModal, setShowRegionModal] = useState(false);
    const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);

    // 지도 뷰
    const [showMapView, setShowMapView] = useState(false);
    const [selectedMapProperty, setSelectedMapProperty] = useState<Article | null>(null);

    // 저장한 매물
    const [savedArticles, setSavedArticles] = useState<Set<string>>(new Set());

    // 선택한 단지들
    const [selectedComplexes, setSelectedComplexes] = useState<Set<string>>(new Set());

    // 필터 토글 (모바일)
    const [showFilter, setShowFilter] = useState(false);

    const appendArticleFilterParams = (params: URLSearchParams) => {
        params.set('tradeType', selectedTrade);
        if (priceMin > 0) params.set('priceMin', String(priceMin));
        if (priceMax < 1000000) params.set('priceMax', String(priceMax));
        if (areaMin > 0) params.set('areaMin', String(areaMin));
        if (areaMax < 200) params.set('areaMax', String(areaMax));
    };

    // ============================================
    // Effects
    // ============================================
    useEffect(() => {
        // 저장한 매물 목록 로드
        const fetchSavedProperties = async () => {
            try {
                const response = await authFetch(`${API_BASE}/api/user/saved-properties`);
                if (response.ok) {
                    const data = await response.json();
                    const savedSet = new Set<string>(data.savedProperties.map((s: any) => s.articleNo));
                    setSavedArticles(savedSet);
                }
            } catch (error) {
                console.error('Failed to fetch saved properties:', error);
            }
        };

        fetchSavedProperties();

        // 단지 목록 상태 복원 (localStorage에서)
        const savedComplexListState = localStorage.getItem('complexListState');
        if (savedComplexListState) {
            try {
                const state = JSON.parse(savedComplexListState);
                // 복원할 상태들이 있으면 적용
                if (state.complexes && state.complexes.length > 0) {
                    setComplexes(state.complexes);
                    setHasSearched(true);
                    if (state.selectedRegion) {
                        setSelectedRegion(state.selectedRegion);
                    }
                    if (state.selectedType) {
                        setSelectedType(state.selectedType);
                    }
                    if (state.selectedTrade) {
                        setSelectedTrade(state.selectedTrade);
                    }
                    if (typeof state.priceMin === 'number') {
                        setPriceMin(state.priceMin);
                    }
                    if (typeof state.priceMax === 'number') {
                        setPriceMax(state.priceMax);
                    }
                    if (typeof state.areaMin === 'number') {
                        setAreaMin(state.areaMin);
                    }
                    if (typeof state.areaMax === 'number') {
                        setAreaMax(state.areaMax);
                    }
                }
            } catch (e) {
                console.error('Failed to restore complex list state:', e);
            }
        }
    }, []);

    // 단지 클릭 시 매물 목록 페이지로 이동
    // (페이지에서 직접 API 호출하여 무한 스크롤로 로드)
    const handleComplexClick = (complex: Complex) => {
        // 임시 매물 목록 페이지로 이동 (페이지에서 API 직접 호출)
        const queryParams = new URLSearchParams({
            complexNo: complex.markerId,
            complexName: complex.complexName,
            realEstateType: complex.realEstateTypeCode || 'APT',
        });
        appendArticleFilterParams(queryParams);
        navigate(`/real-estate/apartment-temp-properties?${queryParams.toString()}`);
    };

    const searchArticles = async (pageNum: number = 1) => {
        if (!selectedRegion) return;

        const loading = pageNum === 1 ? setIsLoading : setIsLoadingMore;
        loading(true);

        try {
            const realEstateType = selectedType;

            // 아파트/오피스텔은 단지(complexes) API를 먼저 호출
            if (selectedType === 'APT' || selectedType === 'OPST') {
                const params = new URLSearchParams({
                    cortarNo: selectedRegion.cortarNo,
                    realEstateType: selectedType,
                    tradeType: selectedTrade,
                    zoom: '15', // 줌 레벨
                });

                const response = await fetch(`${API_BASE}/api/complexes?${params.toString()}`);
                const data = await response.json();

                // 응답이 배열일 수도 있고, complexMarkerList 필드에 있을 수도 있음
                const newComplexes = Array.isArray(data) ? data : (data.complexMarkerList || []);

                // State 업데이트
                setArticles([]); // 단지 모드에서는 매물 비움
                setComplexes(newComplexes);
                setHasMore(false);

                // 단지 목록 상태를 localStorage에 저장 (나중에 복원하기 위해)
                localStorage.setItem('complexListState', JSON.stringify({
                    complexes: newComplexes,
                    selectedRegion,
                    selectedType,
                    selectedTrade,
                    priceMin,
                    priceMax,
                    areaMin,
                    areaMax,
                    timestamp: new Date().toISOString(),
                }));
            } else {
                // 빌라/원룸/상가 등: 임시 매물 목록 페이지로 이동
                const queryParams = new URLSearchParams({
                    cortarNo: selectedRegion.cortarNo,
                    cortarName: selectedRegion.cortarName,
                    realEstateType: realEstateType,
                });
                appendArticleFilterParams(queryParams);
                navigate(`/real-estate/apartment-temp-properties?${queryParams.toString()}`);
            }
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            loading(false);
        }
    };

    // ============================================
    // Handlers
    // ============================================
    const selectType = (code: RealEstateTypeCode) => {
        setSelectedType(code);
    };

    const handleRegionSelect = (region: Region) => {
        setSelectedRegion(region);
        setShowRegionModal(false);
    };

    const handleSearch = () => {
        if (!selectedRegion) {
            setShowRegionModal(true);
            return;
        }
        setHasSearched(true);
        searchArticles(1);
    };

    const handleLoadMore = () => {
        if (isLoadingMore || !hasMore) return;
        searchArticles(page + 1);
    };

    const handleReset = () => {
        setArticles([]);
        setComplexes([]);
        setHasSearched(false);
        setPage(1);
        setHasMore(true);
    };

    const toggleSaveProperty = async (article: Article) => {
        const isSaved = savedArticles.has(article.articleNo);

        try {
            if (isSaved) {
                await authFetch(`${API_BASE}/api/user/saved-properties/${article.articleNo}`, {
                    method: 'DELETE',
                });
                setSavedArticles(prev => {
                    const next = new Set(prev);
                    next.delete(article.articleNo);
                    return next;
                });
            } else {
                await authFetch(`${API_BASE}/api/user/saved-properties`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        articleNo: article.articleNo,
                        cachedName: article.articleName,
                        cachedPrice: parsePriceToNumber(article.dealOrWarrantPrc),
                        cachedType: article.realEstateTypeName,
                        cachedTrade: article.tradeTypeName,
                    }),
                });
                setSavedArticles(prev => new Set(prev).add(article.articleNo));
            }
        } catch (error) {
            console.error('Save property error:', error);
        }
    };

    // ============================================
    // Utilities
    // ============================================
    const formatPrice = (article: Article): string => {
        // dealOrWarrantPrc는 이미 문자열로 "9억 5,000" 형태로 옴
        if (article.tradeTypeCode === 'B2' && article.rentPrc) {
            // 월세
            const deposit = article.dealOrWarrantPrc || '0';
            const monthly = `${article.rentPrc}만`;
            return `${deposit} / ${monthly}`;
        }
        // 매매, 전세 - 이미 포맷된 문자열
        return article.dealOrWarrantPrc || '가격문의';
    };

    const formatDate = (Ymd: string): string => {
        if (!Ymd || Ymd.length !== 8) return '-';
        return `${Ymd.slice(0, 4)}.${Ymd.slice(4, 6)}.${Ymd.slice(6, 8)}`;
    };

    // 가격 문자열을 숫자(만원)로 변환 ("9억 5,000" -> 95000)
    const parsePriceToNumber = (priceStr: string | null): number | null => {
        if (!priceStr) return null;

        // "9억 5,000" 형식 파싱
        const okMatch = priceStr.match(/(\d+)억/);
        const manMatch = priceStr.match(/(\d+(?:,\d+)?)만/);

        let total = 0;
        if (okMatch) {
            total += parseInt(okMatch[1].replace(/,/g, '')) * 10000;
        }
        if (manMatch) {
            total += parseInt(manMatch[1].replace(/,/g, ''));
        }

        return total > 0 ? total : null;
    };

    const getTradeTypeStyle = (code: string) => {
        return TRADE_TYPES.find(t => t.code === code)?.color || 'bg-hud-bg-primary text-hud-text-secondary';
    };

    // ============================================
    // Render
    // ============================================
    return (
        <div className="space-y-6 animate-fade-in">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-br from-hud-accent-primary/20 to-hud-accent-primary/5 rounded-xl border border-hud-accent-primary/30">
                        <Building2 className="w-7 h-7 text-hud-accent-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-hud-text-primary">부동산 매물 검색</h1>
                        <p className="text-sm text-hud-text-muted mt-0.5">네이버 부동산 매물을 검색하고 분석하세요</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {hasSearched && (articles.length > 0 || complexes.length > 0) && (
                        <Button
                            variant="secondary"
                            leftIcon={<Map size={18} />}
                            onClick={() => {
                                setShowMapView(true);
                            }}
                            className="hidden sm:flex"
                        >
                            지도 보기
                        </Button>
                    )}
                    {/* 모바일 전용 지도 버튼 */}
                    {hasSearched && (articles.length > 0 || complexes.length > 0) && (
                        <Button
                            variant="secondary"
                            leftIcon={<Map size={18} />}
                            onClick={() => {
                                setShowMapView(true);
                            }}
                            className="sm:hidden"
                            size="sm"
                        >
                            <span className="sr-only">지도 보기</span>
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        leftIcon={<RefreshCw size={18} />}
                        onClick={() => {
                            handleReset();
                            setSelectedRegion(null);
                        }}
                        className="hover:bg-hud-accent-danger/10 hover:text-hud-accent-danger transition-colors"
                    >
                        <span className="hidden sm:inline">초기화</span>
                    </Button>
                </div>
            </div>

            {/* Mobile Filter Toggle */}
            <div className="lg:hidden">
                <Button
                    variant="secondary"
                    fullWidth
                    leftIcon={<SlidersHorizontal size={18} />}
                    rightIcon={<ChevronDown size={18} className={`transition-transform duration-300 ${showFilter ? 'rotate-180' : ''}`} />}
                    onClick={() => setShowFilter(!showFilter)}
                    className="h-12"
                >
                    {showFilter ? '필터 닫기' : '필터 열기'}
                </Button>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Filter Sidebar */}
                <div className={`${showFilter ? 'block' : 'hidden'} lg:block lg:col-span-1`}>
                    <HudCard title="검색 조건" subtitle="필터를 설정하세요" className="sticky">
                        <div className="space-y-6">
                            {/* 지역 선택 */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-semibold text-hud-text-primary">
                                    <MapPin size={14} className="text-hud-accent-primary" />
                                    지역
                                    {selectedRegion && (
                                        <span className="ml-auto text-xs font-normal text-hud-accent-primary">선택됨</span>
                                    )}
                                </label>
                                <Button
                                    variant="outline"
                                    fullWidth
                                    rightIcon={selectedRegion ? <X size={14} /> : <ChevronDown size={14} />}
                                    onClick={() => setShowRegionModal(true)}
                                    className={`justify-between h-11 ${selectedRegion ? 'border-hud-accent-primary/50 bg-hud-accent-primary/10' : ''}`}
                                >
                                    <span className="truncate">{selectedRegion ? selectedRegion.cortarName : '지역 선택'}</span>
                                </Button>
                            </div>

                            {/* 구분선 */}
                            <div className="border-t border-hud-border-secondary/60" />

                            {/* 매물 타입 */}
                            <div className="space-y-3">
                                <label className="flex items-center gap-2 text-sm font-semibold text-hud-text-primary">
                                    <Building2 size={14} className="text-hud-accent-info" />
                                    매물 유형
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {PROPERTY_TYPES.map((type) => (
                                        <button
                                            key={type.code}
                                            onClick={() => selectType(type.code)}
                                            className={`flex items-center justify-center gap-2 px-3 py-2.5 text-sm rounded-lg border transition-all duration-200 ${selectedType === type.code
                                                ? 'border-hud-accent-primary text-hud-accent-primary'
                                                : 'bg-hud-bg-primary border-hud-border-secondary text-hud-text-secondary hover:bg-hud-bg-hover hover:border-hud-border-primary/50'
                                                }`}
                                        >
                                            {type.icon}
                                            <span className="truncate">{type.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 구분선 */}
                            <div className="border-t border-hud-border-secondary/60" />

                            {/* 거래 방식 */}
                            <div className="space-y-3">
                                <label className="flex items-center gap-2 text-sm font-semibold text-hud-text-primary">
                                    <ArrowUpDown size={14} className="text-hud-accent-warning" />
                                    거래 방식
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {TRADE_TYPES.map((type) => (
                                        <button
                                            key={type.code}
                                            onClick={() => setSelectedTrade(type.code)}
                                            className={`px-3 py-2.5 text-sm rounded-lg border transition-all duration-200 ${selectedTrade === type.code
                                                ? 'bg-hud-accent-primary border-hud-accent-primary text-hud-bg-primary font-semibold shadow-lg shadow-hud-accent-primary/15'
                                                : 'bg-hud-bg-primary border-hud-border-secondary text-hud-text-secondary hover:bg-hud-bg-hover'
                                                }`}
                                        >
                                            {type.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 구분선 */}
                            <div className="border-t border-hud-border-secondary/60" />

                            {/* 가격/면적 범위 */}
                            <div className="space-y-4">
                                {/* 가격 범위 */}
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-hud-text-primary">
                                        가격 범위
                                        <span className="text-xs font-normal text-hud-text-muted ml-1">(만원)</span>
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 relative">
                                            <input
                                                type="number"
                                                value={priceMin || ''}
                                                onChange={(e) => setPriceMin(Number(e.target.value) || 0)}
                                                placeholder="최소"
                                                className="no-spinner w-full px-3 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:border-hud-accent-primary focus:ring-1 focus:ring-hud-accent-primary/50 transition-all"
                                            />
                                        </div>
                                        <span className="text-hud-text-muted font-medium">~</span>
                                        <div className="flex-1 relative">
                                            <input
                                                type="number"
                                                value={priceMax === 1000000 ? '' : priceMax}
                                                onChange={(e) => setPriceMax(Number(e.target.value) || 1000000)}
                                                placeholder="최대"
                                                className="no-spinner w-full px-3 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:border-hud-accent-primary focus:ring-1 focus:ring-hud-accent-primary/50 transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* 면적 범위 */}
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-hud-text-primary">
                                        면적 범위
                                        <span className="text-xs font-normal text-hud-text-muted ml-1">(㎡)</span>
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 relative">
                                            <input
                                                type="number"
                                                value={areaMin || ''}
                                                onChange={(e) => setAreaMin(Number(e.target.value) || 0)}
                                                placeholder="최소"
                                                className="no-spinner w-full px-3 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:border-hud-accent-primary focus:ring-1 focus:ring-hud-accent-primary/50 transition-all"
                                            />
                                        </div>
                                        <span className="text-hud-text-muted font-medium">~</span>
                                        <div className="flex-1 relative">
                                            <input
                                                type="number"
                                                value={areaMax === 200 ? '' : areaMax}
                                                onChange={(e) => setAreaMax(Number(e.target.value) || 200)}
                                                placeholder="최대"
                                                className="no-spinner w-full px-3 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:border-hud-accent-primary focus:ring-1 focus:ring-hud-accent-primary/50 transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 구분선 */}
                            <div className="border-t border-hud-border-secondary/60" />

                            {/* 검색 버튼 */}
                            <div className="space-y-2 pt-2">
                                <Button
                                    variant="primary"
                                    fullWidth
                                    glow
                                    size="lg"
                                    leftIcon={<Search size={18} />}
                                    onClick={handleSearch}
                                    disabled={isLoading || !selectedRegion}
                                    className="h-12 text-base font-semibold"
                                >
                                    {isLoading ? '검색 중...' : '검색하기'}
                                </Button>
                            </div>
                        </div>
                    </HudCard>

                    {/* 요약 카드 - 검색 후 표시 */}
                    {hasSearched && articles.length > 0 && (
                        <HudCard title="검색 결과" subtitle="현재 조건">
                            <div className="space-y-3">
                                <div className="flex justify-between items-center p-3 bg-hud-bg-primary rounded-lg">
                                    <span className="text-sm text-hud-text-secondary">총 매물</span>
                                    <span className="text-lg font-bold text-hud-accent-primary">
                                        {articles.length.toLocaleString()}건
                                    </span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-hud-bg-primary rounded-lg">
                                    <span className="text-sm text-hud-text-secondary">검색 지역</span>
                                    <span className="text-sm font-medium text-hud-text-primary">
                                        {selectedRegion?.cortarName}
                                    </span>
                                </div>
                            </div>
                        </HudCard>
                    )}
                </div>

                {/* Results Area */}
                <div className="lg:col-span-3">
                    <HudCard
                        title={complexes.length > 0 ? "단지 목록" : "매물 목록"}
                        subtitle={selectedRegion ? `${selectedRegion.cortarName} ${hasSearched ? `(${complexes.length > 0 ? complexes.length + '개 단지' : articles.length + '건'})` : ''}` : '지역을 선택하세요'}
                        noPadding
                    >
                        <div className="p-4 sm:p-6">
                            {/* 초기 상태 */}
                            {!hasSearched && !isLoading && (
                                <div className="flex flex-col items-center justify-center py-20 text-center">
                                    <div className="p-5 bg-hud-bg-primary rounded-2xl mb-5 ring-1 ring-hud-border-secondary">
                                        <Search className="w-16 h-16 text-hud-text-muted" />
                                    </div>
                                    <p className="text-xl font-semibold text-hud-text-primary mb-2">매물을 검색해주세요</p>
                                    <p className="text-sm text-hud-text-muted max-w-sm">
                                        지역과 필터를 설정하고 검색 버튼을 클릭하세요
                                    </p>
                                </div>
                            )}

                            {/* 로딩 상태 */}
                            {isLoading && (
                                <div className="flex flex-col items-center justify-center py-20">
                                    <div className="relative mb-5">
                                        <Loader2 className="w-16 h-16 text-hud-accent-primary animate-spin" />
                                        <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-hud-accent-primary/20" />
                                    </div>
                                    <p className="text-base font-medium text-hud-text-primary">매물을 불러오는 중...</p>
                                    <p className="text-sm text-hud-text-muted mt-1">잠시만 기다려주세요</p>
                                </div>
                            )}

                            {/* 빈 결과 */}
                            {hasSearched && !isLoading && articles.length === 0 && complexes.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-20 text-center">
                                    <div className="p-5 bg-hud-bg-primary rounded-2xl mb-5 ring-1 ring-hud-border-secondary">
                                        <AlertCircle className="w-16 h-16 text-hud-text-muted" />
                                    </div>
                                    <p className="text-xl font-semibold text-hud-text-primary mb-2">검색 결과가 없습니다</p>
                                    <p className="text-sm text-hud-text-muted max-w-sm mb-5">검색 조건을 변경해보세요</p>
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            handleReset();
                                            setSelectedRegion(null);
                                        }}
                                    >
                                        검색 조건 초기화
                                    </Button>
                                </div>
                            )}

                            {/* 단지 목록 (아파트/오피스텔) */}
                            {complexes.length > 0 && (
                                <>
                                    <div className="flex items-center justify-between mb-5 pb-4 border-b border-hud-border-secondary">
                                        <div className="flex items-center gap-3">
                                            {/* 전체 선택 체크박스 */}
                                            <button
                                                onClick={() => {
                                                    const allSelected = complexes.every(c => selectedComplexes.has(c.markerId));
                                                    if (allSelected) {
                                                        setSelectedComplexes(new Set());
                                                    } else {
                                                        setSelectedComplexes(new Set(complexes.map(c => c.markerId)));
                                                    }
                                                }}
                                                className="p-1.5 hover:bg-hud-bg-hover rounded-md transition-colors"
                                                title={complexes.every(c => selectedComplexes.has(c.markerId)) ? '전체 해제' : '전체 선택'}
                                            >
                                                {complexes.every(c => selectedComplexes.has(c.markerId)) && complexes.length > 0 ? (
                                                    <CheckSquare className="w-5 h-5 text-hud-accent-primary" />
                                                ) : (
                                                    <Square className="w-5 h-5 text-hud-text-muted" />
                                                )}
                                            </button>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-hud-text-muted">단지</span>
                                                <span className="text-lg font-bold text-hud-accent-primary">{complexes.length}</span>
                                                <span className="text-sm text-hud-text-muted">개</span>
                                                {selectedComplexes.size > 0 && (
                                                    <span className="text-sm text-hud-accent-primary">
                                                        ({selectedComplexes.size}개 선택)
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {selectedComplexes.size > 0 && (
                                                <Button
                                                    variant="primary"
                                                    size="sm"
                                                    leftIcon={<Eye size={16} />}
                                                    onClick={() => {
                                                        const selectedComplexData = complexes.filter(c => selectedComplexes.has(c.markerId));
                                                        const complexNos = selectedComplexData.map(c => c.markerId).join(',');
                                                        const complexNames = selectedComplexData.map(c => c.complexName).join(',');
                                                        const queryParams = new URLSearchParams({
                                                            complexNos,
                                                            complexNames,
                                                            realEstateType: selectedType,
                                                        });
                                                        appendArticleFilterParams(queryParams);
                                                        navigate(`/real-estate/apartment-temp-properties?${queryParams.toString()}`);
                                                    }}
                                                    className="text-sm"
                                                >
                                                    선택한 단지 매물 보기
                                                </Button>
                                            )}
                                            <span className="text-xs text-hud-text-muted flex items-center gap-1">
                                                <MapPin size={12} />
                                                단지를 선택하면 매물을 볼 수 있습니다
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                        {complexes.map((complex) => {
                                            const isSelected = selectedComplexes.has(complex.markerId);
                                            return (
                                                <div
                                                    key={complex.markerId}
                                                    onClick={() => handleComplexClick(complex)}
                                                    className={`group relative bg-hud-bg-primary border rounded-xl p-5 cursor-pointer
                                                    transition-all duration-300 ease-out
                                                    hover:border-hud-accent-primary/60
                                                    hover:shadow-lg hover:shadow-hud-accent-primary/10
                                                    hover:-translate-y-1
                                                    active:scale-[0.98]
                                                    ${isSelected
                                                            ? 'border-hud-accent-primary shadow-lg shadow-hud-accent-primary/20 ring-2 ring-hud-accent-primary/30'
                                                            : 'border-hud-border-secondary'}`}
                                                >
                                                    {/* 호버 시 그림자 효과 */}
                                                    <div className={`absolute inset-0 rounded-xl bg-gradient-to-br transition-all duration-300 pointer-events-none ${isSelected
                                                        ? 'from-hud-accent-primary/10 to-hud-accent-primary/5'
                                                        : 'from-hud-accent-primary/0 to-hud-accent-primary/0 group-hover:from-hud-accent-primary/5 group-hover:to-hud-accent-primary/0'
                                                        }`} />

                                                    {/* 체크박스 (좌측 상단) */}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const newSelected = new Set(selectedComplexes);
                                                            if (newSelected.has(complex.markerId)) {
                                                                newSelected.delete(complex.markerId);
                                                            } else {
                                                                newSelected.add(complex.markerId);
                                                            }
                                                            setSelectedComplexes(newSelected);
                                                        }}
                                                        className={`absolute top-3 left-3 z-10 p-2 rounded-lg transition-all duration-200 ${isSelected
                                                            ? 'bg-hud-accent-primary text-white shadow-lg shadow-hud-accent-primary/30'
                                                            : 'bg-hud-bg-secondary/90 hover:bg-hud-bg-secondary text-hud-text-muted border border-hud-border-secondary'
                                                            }`}
                                                        title={isSelected ? '선택 해제' : '선택'}
                                                    >
                                                        {isSelected ? (
                                                            <CheckSquare className="w-4 h-4" strokeWidth={3} />
                                                        ) : (
                                                            <Square className="w-4 h-4" strokeWidth={2} />
                                                        )}
                                                    </button>

                                                    {/* 상단: 단지명 + 총 매물 (체크박스 공간 확보) */}
                                                    <div className="flex justify-between items-start mb-3 relative pl-10">
                                                        <div className="flex-1 min-w-0 pr-2">
                                                            <h3 className="text-base font-semibold text-hud-text-primary truncate group-hover:text-hud-accent-primary transition-colors">
                                                                {complex.complexName}
                                                            </h3>
                                                            <p className="text-xs text-hud-text-muted mt-0.5 flex items-center gap-1">
                                                                <Building2 size={11} />
                                                                {complex.realEstateTypeName}
                                                            </p>
                                                        </div>
                                                        {complex.totalArticleCount !== undefined && (
                                                            <span className="flex-shrink-0 inline-flex items-center justify-center px-2.5 py-1 text-xs font-semibold rounded-full bg-hud-accent-primary/15 text-hud-accent-primary border border-hud-accent-primary/25">
                                                                {complex.totalArticleCount}건
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* 가격 정보 (핵심) */}
                                                    {complex.representativePrice ? (
                                                        <div className="mb-4 p-3 bg-hud-bg-secondary/50 rounded-lg border border-hud-border-secondary/50 group-hover:border-hud-accent-primary/30 transition-colors">
                                                            <div className="flex items-baseline justify-between gap-2">
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-md ${complex.representativeTradeCode === 'A1'
                                                                        ? 'bg-hud-accent-danger/20 text-hud-accent-danger border border-hud-accent-danger/30'
                                                                        : complex.representativeTradeCode === 'B1'
                                                                            ? 'bg-hud-accent-success/20 text-hud-accent-success border border-hud-accent-success/30'
                                                                            : 'bg-hud-accent-warning/20 text-hud-accent-warning border border-hud-accent-warning/30'
                                                                        }`}>
                                                                        {complex.representativeTrade}
                                                                    </span>
                                                                    <span className="text-lg font-bold text-hud-accent-primary">
                                                                        {complex.representativeTradeCode === 'B2' && complex.representativeRentPrc
                                                                            ? `${complex.representativePrice}/${complex.representativeRentPrc}`
                                                                            : complex.representativePrice
                                                                        }
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            {complex.representativeArea && (
                                                                <span className="text-xs text-hud-text-muted mt-1.5 inline-flex items-center gap-1">
                                                                    <Layers size={10} />
                                                                    {Math.round(complex.representativeArea)}㎡ 기준
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="mb-4 p-3 bg-hud-bg-secondary/30 rounded-lg text-center border border-dashed border-hud-border-secondary">
                                                            <span className="text-xs text-hud-text-muted">가격 정보 없음</span>
                                                        </div>
                                                    )}

                                                    {/* 하단: 면적 · 준공 · 세대수 */}
                                                    <div className="flex items-center justify-between text-xs pt-3 border-t border-hud-border-secondary/50">
                                                        <div className="flex items-center gap-3 text-hud-text-muted">
                                                            {complex.minArea && (
                                                                <span className="flex items-center gap-1" title="면적">
                                                                    <Layers size={11} className="text-hud-accent-info/70" />
                                                                    {complex.minArea === complex.maxArea
                                                                        ? `${Math.round(Number(complex.minArea))}㎡`
                                                                        : `${Math.round(Number(complex.minArea))}~${Math.round(Number(complex.maxArea || complex.minArea))}㎡`
                                                                    }
                                                                </span>
                                                            )}
                                                            {complex.completionYearMonth && (
                                                                <span className="flex items-center gap-1" title="준공연도">
                                                                    <Home size={11} className="text-hud-accent-warning/70" />
                                                                    {complex.completionYearMonth.slice(0, 4)}년
                                                                </span>
                                                            )}
                                                            {complex.totalHouseholdCount && (
                                                                <span className="flex items-center gap-1" title="세대수">
                                                                    <Building2 size={11} className="text-hud-accent-success/70" />
                                                                    {complex.totalHouseholdCount.toLocaleString()}세대
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {complex.dealCount !== undefined && complex.dealCount > 0 && (
                                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-hud-accent-danger/15 text-hud-accent-danger text-xs font-medium">
                                                                    매{complex.dealCount}
                                                                </span>
                                                            )}
                                                            {complex.leaseCount !== undefined && complex.leaseCount > 0 && (
                                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-hud-accent-success/15 text-hud-accent-success text-xs font-medium">
                                                                    전{complex.leaseCount}
                                                                </span>
                                                            )}
                                                            {complex.rentCount !== undefined && complex.rentCount > 0 && (
                                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-hud-accent-warning/15 text-hud-accent-warning text-xs font-medium">
                                                                    월{complex.rentCount}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* 화살표 아이콘 (호버 시 나타남) */}
                                                    <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                        <div className="p-1.5 bg-hud-accent-primary/20 rounded-full">
                                                            <MapPin size={14} className="text-hud-accent-primary" />
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}

                            {/* 매물 목록 - 단지 모드일 때는 숨김 */}
                            {hasSearched && !isLoading && articles.length > 0 && complexes.length === 0 && (
                                <>
                                    {/* 정렬 옵션 */}
                                    <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pb-4 border-b border-hud-border-secondary">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-hud-text-muted">전체</span>
                                            <span className="text-lg font-bold text-hud-accent-primary">{articles.length}</span>
                                            <span className="text-sm text-hud-text-muted">건</span>
                                        </div>
                                        <div className="flex items-center gap-1 bg-hud-bg-primary rounded-lg p-1 border border-hud-border-secondary">
                                            {SORT_OPTIONS.map((option) => (
                                                <button
                                                    key={option.value}
                                                    onClick={() => setSortBy(option.value)}
                                                    className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-md transition-all duration-200 ${sortBy === option.value
                                                        ? 'bg-hud-accent-primary text-hud-bg-primary font-medium shadow-md'
                                                        : 'text-hud-text-secondary hover:text-hud-text-primary hover:bg-hud-bg-hover'
                                                        }`}
                                                >
                                                    {option.icon}
                                                    {option.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 데스크톱: 테이블 뷰 */}
                                    <div className="hidden lg:block overflow-x-auto -mx-4 sm:mx-0 rounded-lg border border-hud-border-secondary">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="bg-hud-bg-secondary border-b border-hud-border-secondary">
                                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-hud-text-primary uppercase tracking-wider">
                                                        매물 정보
                                                    </th>
                                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-hud-text-primary uppercase tracking-wider">
                                                        거래
                                                    </th>
                                                    <th className="px-5 py-3.5 text-right text-xs font-semibold text-hud-text-primary uppercase tracking-wider">
                                                        가격
                                                    </th>
                                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-hud-text-primary uppercase tracking-wider">
                                                        면적
                                                    </th>
                                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-hud-text-primary uppercase tracking-wider">
                                                        층수/방향
                                                    </th>
                                                    <th className="px-5 py-3.5 text-center text-xs font-semibold text-hud-text-primary uppercase tracking-wider">
                                                        저장
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-hud-border-secondary">
                                                {articles.map((article) => (
                                                    <tr
                                                        key={article.articleNo}
                                                        className="hover:bg-hud-bg-hover/80 transition-colors duration-150 group"
                                                    >
                                                        <td className="px-5 py-4">
                                                            <div className="max-w-xs">
                                                                <p className="text-sm font-medium text-hud-text-primary truncate group-hover:text-hud-accent-primary transition-colors">
                                                                    {article.articleName}
                                                                </p>
                                                                {article.buildingName && article.buildingName !== article.articleName && (
                                                                    <p className="text-xs text-hud-text-muted truncate mt-0.5">
                                                                        {article.buildingName}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-4">
                                                            <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-md ${getTradeTypeStyle(article.tradeTypeCode)}`}>
                                                                {article.tradeTypeName}
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-4 text-right">
                                                            <span className="text-sm font-mono font-semibold text-hud-accent-primary">
                                                                {formatPrice(article)}
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-4">
                                                            <div className="text-sm text-hud-text-secondary">
                                                                <span className="font-medium text-hud-text-primary">{article.area2 || article.area1}㎡</span>
                                                                {article.area2 && (
                                                                    <span className="text-xs text-hud-text-muted ml-1.5">
                                                                        (공급 {article.area1}㎡)
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-4">
                                                            <div className="text-sm text-hud-text-secondary">
                                                                {article.floorInfo}
                                                                {article.direction && (
                                                                    <span className="text-xs text-hud-text-muted ml-1.5">
                                                                        ({article.direction})
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-4 text-center">
                                                            <button
                                                                onClick={() => toggleSaveProperty(article)}
                                                                className="p-2 hover:bg-hud-bg-hover rounded-lg transition-all duration-200 hover:scale-110 active:scale-95"
                                                            >
                                                                {savedArticles.has(article.articleNo) ? (
                                                                    <Heart className="w-5 h-5 text-hud-accent-danger fill-hud-accent-danger" />
                                                                ) : (
                                                                    <HeartOff className="w-5 h-5 text-hud-text-muted hover:text-hud-accent-danger transition-colors" />
                                                                )}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* 모바일: 카드 뷰 */}
                                    <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {articles.map((article) => (
                                            <div
                                                key={article.articleNo}
                                                className="group bg-hud-bg-primary border border-hud-border-secondary rounded-xl p-4 hover:border-hud-accent-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-hud-accent-primary/5"
                                            >
                                                {/* 헤더: 매물명 + 찜 */}
                                                <div className="flex justify-between items-start gap-3 mb-3">
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="text-sm font-semibold text-hud-text-primary truncate group-hover:text-hud-accent-primary transition-colors">
                                                            {article.articleName}
                                                        </h3>
                                                        {article.buildingName && article.buildingName !== article.articleName && (
                                                            <p className="text-xs text-hud-text-muted truncate mt-0.5">
                                                                {article.buildingName}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={() => toggleSaveProperty(article)}
                                                        className="p-2 hover:bg-hud-bg-hover rounded-lg transition-all duration-200 hover:scale-110 active:scale-95 flex-shrink-0"
                                                    >
                                                        {savedArticles.has(article.articleNo) ? (
                                                            <Heart className="w-5 h-5 text-hud-accent-danger fill-hud-accent-danger" />
                                                        ) : (
                                                            <HeartOff className="w-5 h-5 text-hud-text-muted hover:text-hud-accent-danger transition-colors" />
                                                        )}
                                                    </button>
                                                </div>

                                                {/* 거래 타입 */}
                                                <div className="mb-3 flex items-center gap-2">
                                                    <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-md ${getTradeTypeStyle(article.tradeTypeCode)}`}>
                                                        {article.tradeTypeName}
                                                    </span>
                                                    <span className="text-xs text-hud-text-muted">
                                                        {article.realEstateTypeName}
                                                    </span>
                                                </div>

                                                {/* 가격 */}
                                                <div className="mb-4 p-4 bg-hud-bg-secondary/60 rounded-xl border border-hud-border-secondary/50 group-hover:border-hud-accent-primary/20 transition-colors">
                                                    <p className="text-xl font-bold text-hud-accent-primary">
                                                        {formatPrice(article)}
                                                    </p>
                                                </div>

                                                {/* 상세 정보 */}
                                                <div className="space-y-2 text-sm">
                                                    <div className="flex justify-between items-center py-1.5 px-3 bg-hud-bg-primary rounded-lg">
                                                        <span className="text-hud-text-muted">면적</span>
                                                        <span className="font-medium text-hud-text-primary">
                                                            {article.area2 || article.area1}㎡
                                                            {article.area2 && <span className="text-xs text-hud-text-muted ml-1">(공급 {article.area1}㎡)</span>}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center py-1.5 px-3 bg-hud-bg-primary rounded-lg">
                                                        <span className="text-hud-text-muted">층수</span>
                                                        <span className="font-medium text-hud-text-primary">
                                                            {article.floorInfo}
                                                            {article.direction && <span className="text-hud-text-muted ml-1">({article.direction})</span>}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center py-1.5 px-3 bg-hud-bg-primary rounded-lg">
                                                        <span className="text-hud-text-muted">확정일</span>
                                                        <span className="font-medium text-hud-text-primary">{formatDate(article.articleConfirmYmd)}</span>
                                                    </div>
                                                </div>

                                                {/* 태그 */}
                                                {article.tagList && article.tagList.length > 0 && (
                                                    <div className="mt-4 flex flex-wrap gap-1.5">
                                                        {article.tagList.slice(0, 3).map((tag, idx) => (
                                                            <span key={idx} className="px-2.5 py-1 bg-hud-bg-hover text-hud-text-muted text-xs rounded-md border border-hud-border-secondary/50">
                                                                {tag}
                                                            </span>
                                                        ))}
                                                        {article.tagList.length > 3 && (
                                                            <span className="px-2.5 py-1 bg-hud-bg-hover text-hud-text-muted text-xs rounded-md">
                                                                +{article.tagList.length - 3}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {/* 더보기 버튼 */}
                                    {hasMore && (
                                        <div className="mt-8 flex justify-center">
                                            <Button
                                                variant="secondary"
                                                size="lg"
                                                leftIcon={isLoadingMore ? <Loader2 size={20} className="animate-spin" /> : <ChevronDown size={20} />}
                                                onClick={handleLoadMore}
                                                disabled={isLoadingMore}
                                                className="min-w-[160px]"
                                            >
                                                {isLoadingMore ? '불러오는 중...' : '더 보기'}
                                            </Button>
                                        </div>
                                    )}

                                    {/* 마지막 페이지 안내 */}
                                    {!hasMore && articles.length > 0 && (
                                        <div className="mt-8 flex items-center justify-center gap-2 text-sm text-hud-text-muted pb-2">
                                            <div className="h-px w-12 bg-hud-border-secondary" />
                                            <span>더 이상 매물이 없습니다</span>
                                            <div className="h-px w-12 bg-hud-border-secondary" />
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </HudCard>
                </div>
            </div>

            {/* 지역 선택 모달 */}
            <RegionSelectorModal
                isOpen={showRegionModal}
                onClose={() => setShowRegionModal(false)}
                onSelect={handleRegionSelect}
            />

            {/* 지도 뷰 */}
            {showMapView && (
                <PropertyMapView
                    properties={articles
                        .filter(a => a.latitude && a.longitude)
                        .map(a => ({
                            articleNo: a.articleNo,
                            articleName: a.articleName,
                            latitude: parseFloat(a.latitude!),
                            longitude: parseFloat(a.longitude!),
                            dealOrWarrantPrc: a.dealOrWarrantPrc,
                            realEstateTypeName: a.realEstateTypeName,
                            tradeTypeName: a.tradeTypeName,
                            tradeTypeCode: a.tradeTypeCode,
                            area1: a.area1?.toString(),
                            buildingName: a.buildingName,
                        }))}
                    complexes={complexes
                        .filter(c => c.latitude && c.longitude)
                        .map(c => ({
                            markerId: c.markerId,
                            complexName: c.complexName,
                            latitude: parseFloat(c.latitude!.toString()),
                            longitude: parseFloat(c.longitude!.toString()),
                            realEstateTypeName: c.realEstateTypeName,
                            realEstateTypeCode: c.realEstateTypeCode,
                            dealCount: c.dealCount,
                            leaseCount: c.leaseCount,
                            rentCount: c.rentCount,
                            totalArticleCount: c.totalArticleCount,
                        }))}
                    selectedProperty={selectedMapProperty ? {
                        articleNo: selectedMapProperty.articleNo,
                        articleName: selectedMapProperty.articleName,
                        latitude: parseFloat(selectedMapProperty.latitude || '0'),
                        longitude: parseFloat(selectedMapProperty.longitude || '0'),
                        dealOrWarrantPrc: selectedMapProperty.dealOrWarrantPrc,
                        realEstateTypeName: selectedMapProperty.realEstateTypeName,
                        tradeTypeName: selectedMapProperty.tradeTypeName,
                        tradeTypeCode: selectedMapProperty.tradeTypeCode,
                        area1: selectedMapProperty.area1?.toString(),
                        buildingName: selectedMapProperty.buildingName,
                    } : null}
                    onPropertySelect={(prop) => {
                        if (prop) {
                            const matchingArticle = articles.find(a => a.articleNo === prop.articleNo);
                            if (matchingArticle) {
                                setSelectedMapProperty(matchingArticle);
                            }
                        } else {
                            setSelectedMapProperty(null);
                        }
                    }}
                    onClose={() => {
                        setShowMapView(false);
                        setSelectedMapProperty(null);
                    }}
                    onComplexClick={handleComplexClick}
                />
            )}
        </div>
    );
};

export default RealEstate;
