// ============================================
// 아파트/오피스텔 임시 매물 목록 페이지
// 단지 클릭 후 나오는 매물 목록 (그리드 형식)
// 네이버 웹 API 방식: 스크롤 시 20개씩 실시간 로드
// ============================================

import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Trash2,
  Save,
  CheckSquare,
  Square,
  Building2,
  Filter,
  Loader2,
  ListTodo,
} from 'lucide-react';
import HudCard from '../../components/common/HudCard';
import Button from '../../components/common/Button';
import ExcelExportModal, { EXPORT_FIELDS, ExportFieldKey } from '../../components/real-estate/ExcelExportModal';
import type { Article } from '../../types/naver-land';

const ITEMS_PER_PAGE = 20; // 네이버 API와 동일하게 20개씩
import { API_BASE } from '../../lib/api';

// 매물 아이템 타입 (기존 Article + id)
interface ArticleWithId extends Article {
  id: string;
}

const ApartmentTempPropertyList = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // URL 파라미터에서 정보 가져오기
  const complexNo = searchParams.get('complexNo') || '';
  const complexNosParam = searchParams.get('complexNos') || '';
  const complexName = searchParams.get('complexName') || '';
  const complexNamesParam = searchParams.get('complexNames') || '';
  const cortarNo = searchParams.get('cortarNo') || '';
  const cortarName = searchParams.get('cortarName') || '';
  const realEstateTypeCode = searchParams.get('realEstateType') || 'APT';

  // 복수 단지 모드: 여러 단지를 선택한 경우
  const complexNos = complexNosParam ? complexNosParam.split(',') : [];
  const complexNames = complexNamesParam ? complexNamesParam.split(',') : [];
  const isMultiComplexMode = complexNos.length > 0;

  // 단지 모드 vs 지역 모드 판별
  const isComplexMode = !!complexNo || isMultiComplexMode;

  // 유효한 complexNo (단일 또는 다중 중 첫번째)
  const effectiveComplexNo = isMultiComplexMode ? complexNos[0] : complexNo;
  const effectiveComplexName = isMultiComplexMode
    ? complexNames.length > 1
      ? `${complexNames[0]} 외 ${complexNames.length - 1}개`
      : complexNames[0] || '선택한 단지'
    : complexName;

  // 상태
  const [articles, setArticles] = useState<ArticleWithId[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [hasMore, setHasMore] = useState(true); // 더 로드할 데이터가 있는지
  const [currentPage, setCurrentPage] = useState(1); // 현재 API 페이지
  const [isLoadingAll, setIsLoadingAll] = useState(false); // 전체 로딩 중

  // 무한 스크롤을 위한 ref
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);

  // 정렬 상태
  const [sortField, setSortField] = useState<'price' | 'area' | 'date' | 'floor'>('price');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // 거래 방식 (기본값: A1 매매)
  const [tradeType, setTradeType] = useState<string>('A1');

  // 실제 매물 타입
  const getRealEstateType = useCallback(() => {
    if (realEstateTypeCode === 'OPST') return 'APT:OPST';
    if (realEstateTypeCode === 'APT') return 'APT:PRE';
    return realEstateTypeCode; // VL, DDDGG, ONEROOM 등은 그대로
  }, [realEstateTypeCode]);

  // API로 매물 로드
  const loadArticles = useCallback(async (page: number = 1, isLoadMore: boolean = false) => {
    if (!effectiveComplexNo && !cortarNo) return;

    if (isLoadMore) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
      setError(null);
    }

    try {
      const realEstateType = getRealEstateType();
      let response: Response;
      let newArticles: Article[] = [];
      let isMoreData = true;

      if (isMultiComplexMode) {
        // 다중 단지 모드: 모든 단지의 매물을 병렬로 조회
        const allRequests = complexNos.map(async (cNo) => {
          const params = new URLSearchParams({
            realEstateType,
            tradeType,
            page: page.toString(),
            order: 'rank',
          });
          const res = await fetch(`${API_BASE}/api/articles/complex/${cNo}?${params.toString()}`);
          const data = await res.json();
          return {
            complexNo: cNo,
            articles: data.articleList || [],
            isMore: data.isMoreData ?? true,
          };
        });

        const results = await Promise.all(allRequests);

        // 모든 결과를 합치기 (단지별로 그룹핑 정보도 함께 저장)
        results.forEach((result) => {
          const articlesWithComplexInfo = result.articles.map((a: Article) => ({
            ...a,
            complexNo: result.complexNo, // 단지 ID 저장
          }));
          newArticles.push(...articlesWithComplexInfo);
        });

        // 다중 단지 모드에서는 hasMore를 false로 설정 (무한 스크롤 비활성화)
        isMoreData = false;
      } else if (isComplexMode) {
        // 단일 단지 모드: 단지별 매물 API
        const params = new URLSearchParams({
          realEstateType,
          tradeType,
          page: page.toString(),
          order: 'rank',
        });
        response = await fetch(`${API_BASE}/api/articles/complex/${effectiveComplexNo}?${params.toString()}`);
        const data = await response.json();

        newArticles = data.articleList || [];
        isMoreData = data.isMoreData ?? (newArticles.length === ITEMS_PER_PAGE);
      } else {
        // 지역 모드: 일반 매물 API
        const params = new URLSearchParams({
          cortarNo,
          realEstateType,
          tradeType,
          page: page.toString(),
          order: 'rank',
        });
        response = await fetch(`${API_BASE}/api/articles?${params.toString()}`);
        const data = await response.json();

        newArticles = data.articleList || [];
        isMoreData = data.isMoreData ?? (newArticles.length === ITEMS_PER_PAGE);
      }

      // id 추가
      const prefix = effectiveComplexNo || cortarNo;
      const articlesWithId: ArticleWithId[] = newArticles.map((a) => ({
        ...a,
        id: `${prefix}_${a.articleNo}`,
      }));

      if (isLoadMore) {
        // 추가 로드: 기존 데이터에 붙이기
        setArticles((prev) => [...prev, ...articlesWithId]);
      } else {
        // 처음 로드: 교체
        setArticles(articlesWithId);
      }

      setHasMore(isMoreData);
      setCurrentPage(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [effectiveComplexNo, cortarNo, isComplexMode, isMultiComplexMode, complexNos, getRealEstateType, tradeType]);

  // 초기 로드
  useEffect(() => {
    if (effectiveComplexNo || cortarNo) {
      setArticles([]);
      setCurrentPage(1);
      setHasMore(true);
      loadArticles(1, false);
    }
  }, [effectiveComplexNo, cortarNo, tradeType, isMultiComplexMode]); // 거래 방식이 변경되면 다시 로드

  // Intersection Observer를 사용한 무한 스크롤
  useEffect(() => {
    if (!hasMore || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting && hasMore && !isLoadingMore && !isLoading) {
          // 다음 페이지 로드
          loadArticles(currentPage + 1, true);
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    const triggerElement = loadMoreTriggerRef.current;
    if (triggerElement) {
      observer.observe(triggerElement);
    }

    return () => {
      if (triggerElement) {
        observer.unobserve(triggerElement);
      }
    };
  }, [hasMore, isLoadingMore, isLoading, currentPage, loadArticles]);

  // 정렬된 매물 목록 (클라이언트 사이드 정렬)
  const sortedArticles = [...articles].sort((a, b) => {
    let comparison = 0;

    switch (sortField) {
      case 'price':
        const parsePriceToMan = (prc: string | number | null | undefined): number => {
          if (!prc) return 0;
          const strValue = typeof prc === 'number' ? prc.toString() : prc;
          let total = 0;
          const okMatch = strValue.match(/(\d+)억/);
          if (okMatch) total += parseInt(okMatch[1]) * 10000;
          const remaining = strValue.replace(/\d+억\s*/, '');
          const numPart = parseInt(remaining.replace(/,/g, ''));
          if (!isNaN(numPart)) total += numPart;
          return total;
        };
        const priceA = parsePriceToMan(a.dealOrWarrantPrc);
        const priceB = parsePriceToMan(b.dealOrWarrantPrc);
        comparison = priceA - priceB;
        break;
      case 'area':
        const areaA = a.area1 || 0;
        const areaB = b.area1 || 0;
        comparison = areaA - areaB;
        break;
      case 'date':
        const dateA = a.articleConfirmYmd || '';
        const dateB = b.articleConfirmYmd || '';
        comparison = dateB.localeCompare(dateA); // 최신순
        break;
      case 'floor':
        const floorA = parseInt(a.floorInfo?.split('/')[0] || '0');
        const floorB = parseInt(b.floorInfo?.split('/')[0] || '0');
        comparison = floorB - floorA; // 고층순
        break;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  // 전체 선택 토글
  const toggleSelectAll = () => {
    const allSelected = sortedArticles.length > 0 && sortedArticles.every((a) => selectedItems.has(a.id));

    if (allSelected) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(sortedArticles.map((a) => a.id)));
    }
  };

  // 개별 선택 토글
  const toggleSelectItem = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  // 현재 표시된 항목이 모두 선택되었는지 확인
  const isAllSelected =
    sortedArticles.length > 0 && sortedArticles.every((a) => selectedItems.has(a.id));

  // 선택된 항목 삭제
  const deleteSelected = () => {
    if (selectedItems.size === 0) return;
    if (!confirm(`${selectedItems.size}개 매물을 삭제하시겠습니까?`)) return;

    const updated = articles.filter((a) => !selectedItems.has(a.id));
    setArticles(updated);
    setSelectedItems(new Set());
  };

  // 로딩 상태
  const [isSaving, setIsSaving] = useState(false);

  // 정규 매물로 저장 (서버 DB에만 저장)
  const saveToRegular = async () => {
    if (selectedItems.size === 0) {
      alert('저장할 매물을 선택해주세요.');
      return;
    }

    setIsSaving(true);

    try {
      const selectedArticles = articles.filter((a) => selectedItems.has(a.id));

      // id 필드 제외 (서버에서 필요 없는 필드)
      const articlesToSend = selectedArticles.map(({ id, ...rest }) => rest);

      console.log('저장할 매물:', articlesToSend);

      // 서버 API 호출 (중앙 DB 저장)
      const response = await fetch(`${API_BASE}/api/properties/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          articles: articlesToSend,
          dataSource: 'NAVER',  // 네이버 검색에서 온 데이터
        }),
      });

      const result = await response.json();
      console.log('저장 결과:', result);

      if (response.ok) {
        alert(`${selectedArticles.length}개 매물을 정규 매물로 저장했습니다.`);
        // 정규 매물 목록 페이지로 이동
        navigate('/real-estate/regular-properties');
      } else {
        alert(`저장 실패: ${result.error || '서버 오류'}`);
      }
    } catch (error) {
      console.error('저장 실패:', error);
      alert('저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  // 엑셀 다운로드
  const handleExport = async (fields: ExportFieldKey[]) => {
    const selectedData = selectedItems.size > 0
      ? articles.filter((a) => selectedItems.has(a.id))
      : articles;

    if (selectedData.length === 0) {
      alert('내보낼 매물이 없습니다.');
      return;
    }

    // CSV 헤더
    const selectedFieldsConfig = EXPORT_FIELDS.filter((f) => fields.includes(f.key));
    const headers = selectedFieldsConfig.map((f) => f.label);

    // CSV 데이터 생성
    const formatCellValue = (value: any): string => {
      if (value === null || value === undefined) return '';
      if (Array.isArray(value)) return `"${value.join(', ')}"`;
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvRows = [
      headers.join(','),
      ...selectedData.map((article) =>
        selectedFieldsConfig.map((fieldConfig) => {
          let value: any;

          switch (fieldConfig.key) {
            case 'articleName':
              value = article.articleName || article.buildingName || '';
              break;
            case 'dealOrWarrantPrc':
              value = article.dealOrWarrantPrc || '';
              break;
            case 'rentPrc':
              value = article.rentPrc || '';
              break;
            case 'area1':
              value = article.area1 || '';
              break;
            case 'area2':
              value = article.area2 || '';
              break;
            case 'floorInfo':
              value = article.floorInfo || '';
              break;
            case 'direction':
              value = article.direction || '';
              break;
            case 'articleConfirmYmd':
              value = article.articleConfirmYmd
                ? article.articleConfirmYmd.replace(/(\d{4})(\d{2})(\d{2})/, '$1.$2.$3')
                : '';
              break;
            case 'buildingName':
              value = article.buildingName || '';
              break;
            case 'cortarAddress':
              value = article.cortarAddress || '';
              break;
            case 'roadAddress': {
              const cortar = article.cortarAddress || '';
              const parts = cortar.split(' ');
              const prefix = parts.length >= 2 ? parts.slice(0, -1).join(' ') + ' ' : '';
              const road = (article as any).roadAddress || '';
              const det = article.detailAddress ? ' ' + article.detailAddress : '';
              value = road ? `${prefix}${road}${det}` : '';
              break;
            }
            case 'articleFeatureDesc':
              value = article.articleFeatureDesc || '';
              break;
            case 'tagList':
              value = article.tagList || [];
              break;
            case 'cpName':
              value = article.cpName || '';
              break;
            case 'realtorName':
              value = article.realtorName || '';
              break;
            case 'latitude':
              value = article.latitude || '';
              break;
            case 'longitude':
              value = article.longitude || '';
              break;
            default:
              value = article[fieldConfig.key as keyof Article] || '';
          }

          return formatCellValue(value);
        }).join(',')
      ),
    ];

    const csvContent = '\uFEFF' + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 10);
    link.download = `${complexName || cortarName || '매물'}_${dateStr}.csv`;
    link.click();

    return Promise.resolve();
  };

  // 포맷 함수
  const formatPrice = (priceStr: string | number | null | undefined) => {
    if (priceStr === null || priceStr === undefined) return '-';

    // 숫자인 경우 문자열로 변환
    const strValue = typeof priceStr === 'number' ? priceStr.toString() : priceStr;

    // 네이버 API는 이미 포맷된 문자열을 반환 ("5억 3,000", "7,500", "53" 등)
    // "억"이 포함되어 있으면 그대로 표시
    if (strValue.includes('억')) {
      return strValue;
    }

    // 순수 숫자인 경우 (예: "7,500", "53")
    const num = parseInt(strValue.replace(/,/g, ''));
    if (isNaN(num)) return strValue;

    if (num >= 10000) {
      const ok = Math.floor(num / 10000);
      const man = num % 10000;
      return man > 0 ? `${ok}억 ${man.toLocaleString()}` : `${ok}억`;
    }
    return `${num.toLocaleString()}`;
  };

  // 정렬 핸들러
  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // 거래 방식 변경
  const handleTradeTypeChange = (newTradeType: string) => {
    setTradeType(newTradeType);
    setArticles([]);
    setCurrentPage(1);
    setHasMore(true);
  };

  // 전체 매물 로드 (모든 페이지 한 번에 로드)
  const loadAllArticles = async () => {
    // 다중 단지 모드에서는 전체 로드 비활성화 (이미 병렬로 로드됨)
    if (isMultiComplexMode || (!effectiveComplexNo && !cortarNo) || isLoadingAll || !hasMore) return;

    setIsLoadingAll(true);
    const allArticles: ArticleWithId[] = [...articles]; // 이미 로드된 매물

    try {
      let page = currentPage + 1;
      let moreData = true;

      while (moreData) {
        const realEstateType = getRealEstateType();
        let response: Response;

        if (isComplexMode) {
          const params = new URLSearchParams({
            realEstateType,
            tradeType,
            page: page.toString(),
            order: 'rank',
          });
          response = await fetch(`${API_BASE}/api/articles/complex/${effectiveComplexNo}?${params.toString()}`);
        } else {
          const params = new URLSearchParams({
            cortarNo,
            realEstateType,
            tradeType,
            page: page.toString(),
            order: 'rank',
          });
          response = await fetch(`${API_BASE}/api/articles?${params.toString()}`);
        }
        const data = await response.json();

        const newArticles: Article[] = data.articleList || [];
        moreData = data.isMoreData ?? (newArticles.length === ITEMS_PER_PAGE);

        const prefix = complexNo || cortarNo;
        const articlesWithId: ArticleWithId[] = newArticles.map((a) => ({
          ...a,
          id: `${prefix}_${a.articleNo}`,
        }));

        allArticles.push(...articlesWithId);
        page++;
      }

      setArticles(allArticles);
      setHasMore(false); // 모두 로드 완료
      setCurrentPage(page - 1);
    } catch (err) {
      console.error('전체 로드 실패:', err);
      alert('전체 매물을 불러오는데 실패했습니다.');
    } finally {
      setIsLoadingAll(false);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      {/* 헤더 */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/real-estate')}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            {isComplexMode ? '단지 목록' : '검색으로 돌아가기'}
          </Button>
          <div>
            <h1 className="text-xl font-bold text-hud-text-primary">
              {effectiveComplexName || cortarName || '매물'}
              <span className="text-hud-text-secondary font-normal ml-2">매물 목록</span>
            </h1>
            <div className="flex items-center gap-2 mt-1 text-sm text-hud-text-muted">
              <span>총 {articles.length}건{hasMore && '+'}</span>
              {isMultiComplexMode && complexNames.length > 1 && (
                <>
                  <span>·</span>
                  <span>{complexNames.length}개 단지 선택</span>
                </>
              )}
              {cortarName && !isMultiComplexMode && (
                <>
                  <span>·</span>
                  <span>{cortarName}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 거래 방식 선택 */}
          <div className="flex gap-1">
            {[
              { code: 'A1', label: '매매' },
              { code: 'B1', label: '전세' },
              { code: 'B2', label: '월세' },
            ].map((type) => (
              <button
                key={type.code}
                onClick={() => handleTradeTypeChange(type.code)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${tradeType === type.code
                  ? 'bg-hud-accent-primary text-white'
                  : 'bg-hud-bg-secondary text-hud-text-secondary hover:bg-hud-bg-hover'
                  }`}
              >
                {type.label}
              </button>
            ))}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={deleteSelected}
            disabled={selectedItems.size === 0}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowExportModal(true)}
            disabled={articles.length === 0}
          >
            <Download className="w-4 h-4" />
          </Button>
          {!isMultiComplexMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={loadAllArticles}
              disabled={isLoadingAll || !hasMore || articles.length === 0}
            >
              {isLoadingAll ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <ListTodo className="w-4 h-4 mr-1" />
                  전체 로드
                </>
              )}
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={saveToRegular}
            disabled={selectedItems.size === 0 || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
                저장 중
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-1" />
                정규 매물로 저장
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 정렬 바 */}
      <HudCard className="mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-hud-text-muted" />
            <span className="text-sm text-hud-text-secondary">정렬:</span>
            <div className="flex gap-1">
              {[
                { field: 'price' as const, label: '가격' },
                { field: 'area' as const, label: '면적' },
                { field: 'date' as const, label: '등록일' },
                { field: 'floor' as const, label: '층수' },
              ].map((item) => (
                <button
                  key={item.field}
                  onClick={() => handleSort(item.field)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${sortField === item.field
                    ? 'bg-hud-accent-primary text-white'
                    : 'bg-hud-bg-secondary text-hud-text-secondary hover:bg-hud-bg-hover'
                    }`}
                >
                  {item.label}
                  {sortField === item.field && (
                    <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-hud-text-muted">
            <span>선택: {selectedItems.size}건</span>
          </div>
        </div>
      </HudCard>

      {/* 로딩/에러 상태 */}
      {isLoading && articles.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-hud-accent-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-hud-text-muted">매물을 불러오는 중...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-hud-bg-danger/10 border border-hud-border-danger rounded-lg p-4 text-hud-text-danger mb-4">
          {error}
        </div>
      )}

      {/* 그리드 테이블 */}
      {(!isLoading || articles.length > 0) && (
        <HudCard noPadding>
          {sortedArticles.length === 0 && !isLoading ? (
            <div className="p-12 text-center">
              <Building2 className="w-16 h-16 mx-auto mb-4 text-hud-text-muted" />
              <p className="text-hud-text-muted">매물이 없습니다.</p>
              <p className="text-sm text-hud-text-muted mt-1">다른 거래 방식을 선택해보세요.</p>
            </div>
          ) : (
            <HudCard noPadding className="overflow-x-auto">
              <div ref={scrollContainerRef} className="max-h-[calc(100vh-380px)] overflow-y-auto">
                <table className="w-full min-w-[800px]">
                  {/* 테이블 헤더 */}
                  <thead>
                    <tr className="bg-hud-bg-secondary border-b-2 border-[var(--hud-border-table)]">
                      <th className="px-3 py-3 text-center w-10">
                        <button
                          onClick={toggleSelectAll}
                          className="p-1.5 hover:bg-hud-bg-hover rounded-md transition-colors"
                          title={isAllSelected ? '전체 해제' : '전체 선택'}
                        >
                          {isAllSelected ? (
                            <CheckSquare className="w-4 h-4 text-hud-accent-primary" />
                          ) : (
                            <Square className="w-4 h-4 text-hud-text-muted" />
                          )}
                        </button>
                      </th>
                      {isMultiComplexMode && (
                        <th className="px-3 py-3 text-left text-xs font-semibold text-hud-text-primary uppercase tracking-wide" style={{ width: '120px' }}>
                          단지명
                        </th>
                      )}
                      <th className="px-3 py-3 text-left text-xs font-semibold text-hud-text-primary uppercase tracking-wide" style={{ width: isMultiComplexMode ? '180px' : '200px' }}>
                        매물명
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-hud-text-primary uppercase tracking-wide" style={{ width: '80px' }}>
                        매물유형
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-hud-text-primary uppercase tracking-wide" style={{ width: '70px' }}>
                        거래
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-hud-text-primary uppercase tracking-wide cursor-pointer hover:text-hud-accent-primary transition-colors" onClick={() => handleSort('price')} style={{ width: '100px' }}>
                        가격 {sortField === 'price' && <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-hud-text-primary uppercase tracking-wide" style={{ width: '70px' }}>
                        월세
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-hud-text-primary uppercase tracking-wide cursor-pointer hover:text-hud-accent-primary transition-colors" onClick={() => handleSort('area')} style={{ width: '70px' }}>
                        면적 {sortField === 'area' && <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-hud-text-primary uppercase tracking-wide cursor-pointer hover:text-hud-accent-primary transition-colors" onClick={() => handleSort('floor')} style={{ width: '60px' }}>
                        층 {sortField === 'floor' && <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-hud-text-primary uppercase tracking-wide" style={{ width: '90px' }}>
                        확정일
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-hud-text-primary uppercase tracking-wide" style={{ width: '100px' }}>
                        태그
                      </th>
                    </tr>
                  </thead>

                  {/* 테이블 바디 - 무한 스크롤 */}
                  <tbody>
                    {sortedArticles.map((article) => {
                      // 다중 단지 모드에서 complexNo로 단지명 찾기
                      const complexIndex = complexNos.indexOf((article as any).complexNo || '');
                      const articleComplexName = complexIndex >= 0 ? complexNames[complexIndex] : '';

                      return (
                        <tr
                          key={article.id}
                          className={`border-b border-hud-text-muted/20 text-sm transition-all duration-150 ${selectedItems.has(article.id)
                            ? 'bg-hud-accent-primary/15'
                            : 'bg-hud-bg-primary hover:bg-hud-bg-hover/80'
                            }`}
                        >
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => toggleSelectItem(article.id)}
                              className="p-1.5 hover:bg-hud-bg-hover rounded-md transition-colors"
                            >
                              {selectedItems.has(article.id) ? (
                                <CheckSquare className="w-4 h-4 text-hud-accent-primary" />
                              ) : (
                                <Square className="w-4 h-4 text-hud-text-muted" />
                              )}
                            </button>
                          </td>
                          {isMultiComplexMode && (
                            <td className="px-3 py-2">
                              <p className="truncate text-sm font-medium text-hud-accent-primary" title={articleComplexName}>
                                {articleComplexName || '-'}
                              </p>
                            </td>
                          )}
                          <td className="px-3 py-2">
                            <p className="truncate font-medium text-hud-text-primary" title={article.articleName}>
                              {article.articleName || article.buildingName || '-'}
                            </p>
                            {article.buildingName && article.buildingName !== article.articleName && (
                              <p className="text-xs text-hud-text-muted truncate mt-0.5" title={article.buildingName}>
                                {article.buildingName}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <span className="text-xs px-2 py-1 bg-hud-bg-secondary rounded-md text-hud-text-secondary">
                              {article.realEstateTypeName || realEstateTypeCode}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-md ${article.tradeTypeCode === 'A1'
                              ? 'bg-hud-accent-danger/20 text-hud-accent-danger border border-hud-accent-danger/30'
                              : article.tradeTypeCode === 'B1'
                                ? 'bg-hud-accent-success/20 text-hud-accent-success border border-hud-accent-success/30'
                                : 'bg-hud-accent-warning/20 text-hud-accent-warning border border-hud-accent-warning/30'
                              }`}>
                              {article.tradeTypeName}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-hud-accent-primary">
                            {formatPrice(article.dealOrWarrantPrc)}
                          </td>
                          <td className="px-3 py-2 text-right text-hud-text-secondary">
                            {article.rentPrc ? `${article.rentPrc}만` : '-'}
                          </td>
                          <td className="px-3 py-2 text-right text-hud-text-secondary">
                            <span>{article.area1 || '-'}㎡</span>
                          </td>
                          <td className="px-3 py-2 text-center text-hud-text-secondary">
                            {article.floorInfo || '-'}
                          </td>
                          <td className="px-3 py-2 text-center text-hud-text-secondary text-xs">
                            {article.articleConfirmYmd
                              ? article.articleConfirmYmd.replace(/(\d{4})(\d{2})(\d{2})/, '$1.$2.$3')
                              : '-'}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1">
                              {article.tagList?.slice(0, 1).map((tag, idx) => (
                                <span key={idx} className="px-1.5 py-0.5 text-xs bg-hud-bg-secondary text-hud-text-secondary rounded truncate max-w-[60px]">
                                  {tag}
                                </span>
                              ))}
                              {article.tagList?.length > 1 && (
                                <span className="text-xs text-hud-text-muted">+{article.tagList.length - 1}</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* 무한 스크롤 트리거 요소 */}
                <div ref={loadMoreTriggerRef} className="py-2 min-h-[50px]">
                  {isLoadingMore && (
                    <div className="flex items-center justify-center gap-2 text-sm text-hud-text-muted">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>더 불러오는 중...</span>
                    </div>
                  )}
                  {!hasMore && sortedArticles.length > 0 && (
                    <div className="text-center text-sm text-hud-text-muted py-2">
                      모든 매물을 표시했습니다 ({sortedArticles.length}건)
                    </div>
                  )}
                </div>
              </div>

              {/* 하단 정보 바 */}
              <div className="flex items-center justify-between px-5 py-4 bg-hud-bg-secondary border-t border-[var(--hud-border-table)]">
                <div className="text-sm text-hud-text-muted">
                  {sortedArticles.length}건{hasMore && ' (스크롤하여 더보기)'}
                </div>
              </div>
            </HudCard>
          )}
        </HudCard>
      )}

      {/* 정규 매물 목록 버튼 */}
      <div className="mt-4 flex justify-end">
        <Button
          variant="outline"
          onClick={() => navigate('/real-estate/regular-properties')}
        >
          정규 매물 목록 →
        </Button>
      </div>

      {/* 엑셀 다운로드 모달 */}
      <ExcelExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
        title="매물 엑셀 다운로드"
        totalCount={selectedItems.size > 0 ? selectedItems.size : sortedArticles.length}
      />
    </div>
  );
};

export default ApartmentTempPropertyList;
