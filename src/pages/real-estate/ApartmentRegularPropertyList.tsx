// ============================================
// 정규 매물 목록 페이지
// 서버 DB에서 저장한 매물 목록 조회 (그리드 형식)
// ============================================

import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Trash2,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  Building2,
  Filter,
  Home,
  Loader2,
} from 'lucide-react';
import HudCard from '../../components/common/HudCard';
import Button from '../../components/common/Button';
import ExcelExportModal, { EXPORT_FIELDS, ExportFieldKey } from '../../components/real-estate/ExcelExportModal';
import type { Article } from '../../types/naver-land';

const ITEMS_PER_PAGE = 50;
import { API_BASE } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';

// 정규 매물 타입
interface RegularArticle extends Article {
  id: string;
  complexNo?: string;
  complexName?: string;
  savedAt: string; // 저장된 시간
}

const ApartmentRegularPropertyList = () => {
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const authFetch = useAuthStore((state) => state.authFetch);

  // 상태
  const [articles, setArticles] = useState<RegularArticle[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showExportModal, setShowExportModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 전체 삭제 진행 상태
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState({ current: 0, total: 0 });

  // 정렬 상태
  const [sortField, setSortField] = useState<'savedAt' | 'price' | 'area' | 'complex'>('savedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // 필터 상태
  const [filterComplex, setFilterComplex] = useState('');
  const [selectedPropertyTypes, setSelectedPropertyTypes] = useState<Set<string>>(new Set());
  const [selectedTradeType, setSelectedTradeType] = useState<string>(''); // '' = 전체

  // 매물 유형 정의 (네이버 부동산 기준)
  const PROPERTY_TYPES = [
    { code: 'APT', label: '아파트' },
    { code: 'OPST', label: '오피스텔' },
    { code: 'VL', label: '빌라' },
    { code: 'ONEROOM', label: '원룸' },
    { code: 'TWOROOM', label: '투룸' },
    { code: 'SG', label: '상가' },
    { code: 'DDDGG', label: '단독/다가구' },
  ];

  // 서버에서 정규 매물 로드
  useEffect(() => {
    loadRegularArticles();
  }, [token]);

  const loadRegularArticles = async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 중앙 DB에서 네이버 매물만 가져오기
      const response = await authFetch(`${API_BASE}/api/properties?dataSource=NAVER`);

      if (!response.ok) {
        throw new Error('서버 조회 실패');
      }

      const data = await response.json();
      const properties = data.properties || [];

      // 서버 데이터를 RegularArticle 형식으로 변환
      const convertedArticles: RegularArticle[] = properties.map((prop: any) => {
        return {
          ...prop,
          id: prop.articleNo,
          articleNo: prop.articleNo,
          complexNo: prop.complexNo,
          complexName: prop.buildingName,
          savedAt: prop.createdAt || prop.lastCrawledAt,
          articleName: prop.articleName || prop.buildingName,
          dealOrWarrantPrc: prop.dealOrWarrantPrc,
          tradeTypeName: prop.tradeTypeName,
          realEstateTypeName: prop.realEstateTypeName,
        } as RegularArticle;
      });

      setArticles(convertedArticles);
    } catch (apiError) {
      console.error('API 호출 실패:', apiError);
      setError('매물을 불러오는데 실패했습니다.');
      setArticles([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 정렬 및 필터링된 매물 목록
  const processedArticles = useMemo(() => {
    let processed = [...articles];

    // 매물 유형 필터
    if (selectedPropertyTypes.size > 0) {
      processed = processed.filter((a) => {
        const realEstateType = a.realEstateTypeCode || '';
        return selectedPropertyTypes.has(realEstateType);
      });
    }

    // 거래 유형 필터
    if (selectedTradeType) {
      processed = processed.filter((a) => a.tradeTypeCode === selectedTradeType);
    }

    // 단지명 필터
    if (filterComplex) {
      processed = processed.filter(
        (a) =>
          (a.complexName && a.complexName.toLowerCase().includes(filterComplex.toLowerCase())) ||
          (a.buildingName && a.buildingName.toLowerCase().includes(filterComplex.toLowerCase()))
      );
    }

    // 정렬
    processed.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'savedAt':
          comparison = a.savedAt.localeCompare(b.savedAt);
          break;
        case 'price':
          const parsePriceToMan = (prc: string | number | undefined): number => {
            if (!prc) return 0;
            // 이미 숫자로 변환된 경우 (만원 단위)
            if (typeof prc === 'number') {
              return prc;
            }
            // 문자열 "47억" 형식인 경우
            let total = 0;
            const okMatch = String(prc).match(/(\d+)억/);
            if (okMatch) total += parseInt(okMatch[1]) * 10000;
            const remaining = String(prc).replace(/\d+억\s*/, '');
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
        case 'complex':
          const nameA = a.complexName || a.buildingName || '';
          const nameB = b.complexName || b.buildingName || '';
          comparison = nameA.localeCompare(nameB, 'ko');
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return processed;
  }, [articles, selectedPropertyTypes, selectedTradeType, filterComplex, sortField, sortOrder]);

  // 페이징 처리
  const totalPages = Math.ceil(processedArticles.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentArticles = processedArticles.slice(startIndex, endIndex);

  // 전체 선택 토글 (현재 페이지만)
  const toggleSelectAll = () => {
    const currentPageIds = new Set(currentArticles.map((a) => a.id));
    const allSelected = currentPageIds.size > 0 && [...currentPageIds].every((id) => selectedItems.has(id));

    if (allSelected) {
      const newSelected = new Set(selectedItems);
      currentPageIds.forEach((id) => newSelected.delete(id));
      setSelectedItems(newSelected);
    } else {
      setSelectedItems(new Set([...selectedItems, ...currentPageIds]));
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

  // 현재 페이지가 모두 선택되었는지 확인
  const isCurrentPageAllSelected =
    currentArticles.length > 0 && currentArticles.every((a) => selectedItems.has(a.id));

  // 개별 삭제 (서버 API 호출)
  const deleteItem = async (id: string) => {
    try {
      const response = await authFetch(`${API_BASE}/api/properties/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // 로컬 상태에서 제거
        const updated = articles.filter((a) => a.id !== id);
        setArticles(updated);

        setSelectedItems((prev) => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      } else {
        alert('삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('삭제 실패:', error);
      alert('삭제에 실패했습니다.');
    }
  };

  // 선택된 항목 일괄 삭제 (서버 API 호출)
  const deleteSelected = async () => {
    if (selectedItems.size === 0) return;
    if (!confirm(`${selectedItems.size}개 매물을 삭제하시겠습니까?`)) return;

    try {
      // 개별 삭제 요청 병렬 처리
      const deletePromises = Array.from(selectedItems).map((id) =>
        authFetch(`${API_BASE}/api/properties/${id}`, { method: 'DELETE' })
      );

      const results = await Promise.allSettled(deletePromises);
      const successCount = results.filter(r => r.status === 'fulfilled' && (r.value as Response).ok).length;

      if (successCount > 0) {
        // 로컬 상태에서 제거
        const updated = articles.filter((a) => !selectedItems.has(a.id));
        setArticles(updated);
        setSelectedItems(new Set());

        // 페이지 조정
        const newTotalPages = Math.ceil(updated.length / ITEMS_PER_PAGE);
        if (currentPage > newTotalPages && newTotalPages > 0) {
          setCurrentPage(newTotalPages);
        }

        if (successCount < selectedItems.size) {
          alert(`${successCount}/${selectedItems.size}개 삭제 완료`);
        }
      } else {
        alert('삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('일괄 삭제 실패:', error);
      alert('삭제에 실패했습니다.');
    }
  };

  // 전체 삭제
  const deleteAll = async () => {
    if (articles.length === 0) return;
    if (!confirm(`정말로 전체 ${articles.length}개 매물을 모두 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;

    setIsDeletingAll(true);
    setDeleteProgress({ current: 0, total: articles.length });

    try {
      const articleNos = articles.map((a) => a.id);
      let deletedCount = 0;
      const deletedIds: string[] = [];

      // 배치 처리 (한 번에 10개씩 병렬 처리)
      const BATCH_SIZE = 10;
      for (let i = 0; i < articleNos.length; i += BATCH_SIZE) {
        const batch = articleNos.slice(i, Math.min(i + BATCH_SIZE, articleNos.length));

        const deletePromises = batch.map(async (id) => {
          const response = await authFetch(`${API_BASE}/api/properties/${id}`, {
            method: 'DELETE',
          });
          if (response.ok) {
            deletedCount++;
            deletedIds.push(id);
          }
          return { id, success: response.ok };
        });

        await Promise.all(deletePromises);

        // 진행 상태 업데이트
        setDeleteProgress({ current: deletedCount, total: articleNos.length });

        // 삭제된 항목을 로컬 상태에서 제거
        setArticles((prev) => prev.filter((a) => !deletedIds.includes(a.id)));
      }

      if (deletedCount > 0) {
        setSelectedItems(new Set());
        setCurrentPage(1);
        alert(`${deletedCount}개 삭제 완료`);
      } else {
        alert('전체 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('전체 삭제 실패:', error);
      alert('전체 삭제에 실패했습니다.');
    } finally {
      setIsDeletingAll(false);
      setDeleteProgress({ current: 0, total: 0 });
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
    const headers = ['저장일시', ...selectedFieldsConfig.map((f) => f.label)];

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
      ...selectedData.map((article) => {
        const savedAtFormatted = new Date(article.savedAt).toLocaleString('ko-KR');
        const fieldValues = selectedFieldsConfig.map((fieldConfig) => {
          let value: any;

          switch (fieldConfig.key) {
            case 'articleName':
              const cName = article.complexName || '';
              const aName = article.articleName || article.buildingName || '';
              value = cName && aName && cName !== aName ? `${cName} ${aName}` : (cName || aName || '');
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
              // 풀 도로명 주소 조합: cortarAddress에서 시/구 + roadAddress + detailAddress
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
        });
        return [formatCellValue(savedAtFormatted), ...fieldValues].join(',');
      }),
    ];

    const csvContent = '\uFEFF' + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const now = new Date();
    const timestampStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    link.download = `정규매물_${timestampStr}.csv`;
    link.click();

    return Promise.resolve();
  };

  // 포맷 함수
  // 포맷 함수 (정확학 파싱)
  const formatPrice = (price: string | number | null | undefined) => {
    if (price === null || price === undefined) return '-';

    // 이미 "억"이 포함된 문자열이면 그대로 반환
    if (typeof price === 'string' && price.includes('억')) {
      return price;
    }

    // 숫자인 경우 (만원 단위)
    const num = typeof price === 'number' ? price : parseInt(String(price).replace(/,/g, ''));
    if (isNaN(num)) return String(price);

    if (num >= 10000) {
      const uk = Math.floor(num / 10000);
      const man = num % 10000;
      return man > 0 ? `${uk}억 ${man.toLocaleString()}` : `${uk}억`;
    }
    return `${num.toLocaleString()}`;
  };

  const parseFloor = (floorInfo: string) => {
    if (!floorInfo) return '-';
    return floorInfo;
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

  // 통계
  const stats = useMemo(() => {
    const byTradeType = articles.reduce((acc, a) => {
      acc[a.tradeTypeName] = (acc[a.tradeTypeName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byComplex = articles.reduce((acc, a) => {
      const key = a.complexName || a.buildingName || '기타';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // 매물 유형별 집계
    const byPropertyType = articles.reduce((acc, a) => {
      const typeCode = a.realEstateTypeCode || 'unknown';
      const typeLabel = PROPERTY_TYPES.find((t) => t.code === typeCode)?.label || '기타';
      acc[typeLabel] = (acc[typeLabel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalCount: articles.length,
      byTradeType,
      uniqueComplexes: Object.keys(byComplex).length,
      byPropertyType,
    };
  }, [articles]);

  return (
    <div className="p-4 sm:p-6">
      {/* 헤더 */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/real-estate')}
              className="flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">단지 목록</span>
              <span className="sm:hidden">뒤로</span>
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-hud-text-primary flex items-center gap-2">
                <Building2 className="w-6 h-6 text-hud-accent-primary" />
                정규 매물 목록
              </h1>
              <div className="flex items-center gap-3 mt-1 text-sm text-hud-text-muted">
                <span>총 <strong className="text-hud-accent-primary">{stats.totalCount}</strong>건</span>
                <span className="w-1 h-1 bg-hud-border-secondary rounded-full" />
                <span><strong className="text-hud-accent-info">{stats.uniqueComplexes}</strong>개 단지</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              onClick={deleteSelected}
              disabled={selectedItems.size === 0}
              className="hover:bg-hud-accent-danger/10 hover:text-hud-accent-danger disabled:hover:bg-transparent disabled:hover:text-hud-text-muted"
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              선택 삭제 <span className="ml-1 px-1.5 py-0.5 bg-hud-bg-secondary rounded text-xs">({selectedItems.size})</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={deleteAll}
              disabled={articles.length === 0}
              className="text-hud-accent-danger hover:bg-hud-accent-danger/10"
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">전체 삭제</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowExportModal(true)}
              className="hidden sm:inline-flex"
            >
              <Download className="w-4 h-4 mr-1.5" />
              엑셀 다운로드
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowExportModal(true)}
              className="sm:hidden px-3"
            >
              <Download className="w-4 h-4" />
              <span className="sr-only">엑셀 다운로드</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 매물 유형 + 거래 유형 필터 */}
      <div className="mb-5 p-4 bg-hud-bg-secondary border border-[var(--hud-border-table)] rounded-xl space-y-4">
        {/* 매물 유형 */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-semibold text-hud-text-primary flex items-center gap-1.5">
            <Building2 size={14} className="text-hud-accent-info" />
            매물 유형
          </span>
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setSelectedPropertyTypes(new Set())}
              className={`px-3 py-1 text-sm rounded-lg transition-all duration-200 ${selectedPropertyTypes.size === 0
                ? 'bg-hud-accent-primary text-hud-bg-primary font-medium shadow-md shadow-hud-accent-primary/15'
                : 'bg-hud-bg-primary text-hud-text-secondary hover:bg-hud-bg-hover border border-[var(--hud-border-table)]'
                }`}
            >
              전체
            </button>
            {PROPERTY_TYPES.map((type) => {
              const isSelected = selectedPropertyTypes.has(type.code);
              return (
                <button
                  key={type.code}
                  onClick={() => {
                    const newTypes = new Set(selectedPropertyTypes);
                    if (isSelected) {
                      newTypes.delete(type.code);
                    } else {
                      newTypes.add(type.code);
                    }
                    setSelectedPropertyTypes(newTypes);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1 text-sm rounded-lg transition-all duration-200 ${isSelected
                    ? 'bg-hud-accent-primary text-hud-bg-primary font-medium shadow-md shadow-hud-accent-primary/15'
                    : 'bg-hud-bg-primary text-hud-text-secondary hover:bg-hud-bg-hover border border-[var(--hud-border-table)]'
                    }`}
                >
                  {type.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 거래 유형 */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-semibold text-hud-text-primary flex items-center gap-1.5">
            <Home size={14} className="text-hud-accent-warning" />
            거래 유형
          </span>
          <div className="flex gap-1.5">
            {[
              { code: '', label: '전체' },
              { code: 'A1', label: '매매' },
              { code: 'B1', label: '전세' },
              { code: 'B2', label: '월세' },
            ].map((type) => (
              <button
                key={type.code}
                onClick={() => {
                  setSelectedTradeType(type.code);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 text-sm rounded-lg transition-all duration-200 ${selectedTradeType === type.code
                  ? 'bg-hud-accent-primary text-hud-bg-primary font-medium shadow-md shadow-hud-accent-primary/15'
                  : 'bg-hud-bg-primary text-hud-text-secondary hover:bg-hud-bg-hover border border-[var(--hud-border-table)]'
                  }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <HudCard className="p-4 border-l-4 border-l-hud-accent-primary">
          <div className="text-center">
            <p className="text-3xl font-bold text-hud-accent-primary">{stats.totalCount}</p>
            <p className="text-xs text-hud-text-muted mt-1">전체 매물</p>
          </div>
        </HudCard>
        <HudCard className="p-4 border-l-4 border-l-hud-accent-danger">
          <div className="text-center">
            <p className="text-3xl font-bold text-hud-accent-danger">{stats.byTradeType['매매'] || 0}</p>
            <p className="text-xs text-hud-text-muted mt-1">매매</p>
          </div>
        </HudCard>
        <HudCard className="p-4 border-l-4 border-l-hud-accent-success">
          <div className="text-center">
            <p className="text-3xl font-bold text-hud-accent-success">{stats.byTradeType['전세'] || 0}</p>
            <p className="text-xs text-hud-text-muted mt-1">전세</p>
          </div>
        </HudCard>
        <HudCard className="p-4 border-l-4 border-l-hud-accent-warning">
          <div className="text-center">
            <p className="text-3xl font-bold text-hud-accent-warning">{stats.byTradeType['월세'] || 0}</p>
            <p className="text-xs text-hud-text-muted mt-1">월세</p>
          </div>
        </HudCard>
      </div>

      {/* 필터 & 정렬 바 */}
      <HudCard className="mb-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Filter className="w-4 h-4 text-hud-accent-primary" />
            <span className="text-sm font-semibold text-hud-text-primary">정렬</span>
            <div className="flex gap-1.5 bg-hud-bg-secondary rounded-lg p-1">
              {[
                { field: 'savedAt' as const, label: '저장일' },
                { field: 'complex' as const, label: '단지명' },
                { field: 'price' as const, label: '가격' },
                { field: 'area' as const, label: '면적' },
              ].map((item) => (
                <button
                  key={item.field}
                  onClick={() => handleSort(item.field)}
                  className={`px-3 py-1 text-sm rounded-md transition-all duration-200 ${sortField === item.field
                    ? 'bg-hud-accent-primary text-hud-bg-primary font-medium shadow-sm'
                    : 'text-hud-text-secondary hover:text-hud-text-primary hover:bg-hud-bg-hover'
                    }`}
                >
                  {item.label}
                  {sortField === item.field && (
                    <span className="ml-1.5">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="단지명 검색..."
                value={filterComplex}
                onChange={(e) => setFilterComplex(e.target.value)}
                className="w-full sm:w-48 pl-9 pr-4 py-2 bg-hud-bg-secondary border border-[var(--hud-border-table)] rounded-lg text-sm text-hud-text-primary placeholder:text-hud-text-muted focus:outline-none focus:border-hud-accent-primary focus:ring-1 focus:ring-hud-accent-primary/50 transition-all"
              />
              <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-hud-text-muted" />
            </div>
            <div className="flex items-center gap-1.5 px-3 py-2 bg-hud-bg-secondary rounded-lg">
              <CheckSquare size={14} className="text-hud-accent-primary" />
              <span className="text-sm font-medium text-hud-text-primary">
                {selectedItems.size}건
              </span>
            </div>
          </div>
        </div>
      </HudCard>

      {/* 그리드 테이블 */}
      <HudCard noPadding className="overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-80">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <Loader2 className="w-14 h-14 text-hud-accent-primary animate-spin" />
                <div className="absolute inset-0 w-14 h-14 rounded-full border-4 border-hud-accent-primary/20" />
              </div>
              <div className="text-center">
                <p className="text-base font-medium text-hud-text-primary">매물을 불러오는 중...</p>
                <p className="text-sm text-hud-text-muted mt-1">잠시만 기다려주세요</p>
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="p-16 text-center">
            <div className="p-4 bg-hud-accent-danger/10 rounded-2xl w-20 h-20 mx-auto mb-5 flex items-center justify-center">
              <Home className="w-10 h-10 text-hud-accent-danger" />
            </div>
            <p className="text-lg font-semibold text-hud-accent-danger">{error}</p>
            <Button
              variant="primary"
              className="mt-6"
              onClick={loadRegularArticles}
            >
              다시 시도
            </Button>
          </div>
        ) : processedArticles.length === 0 ? (
          <div className="p-16 text-center">
            <div className="p-4 bg-hud-bg-secondary rounded-2xl w-20 h-20 mx-auto mb-5 flex items-center justify-center">
              <Building2 className="w-10 h-10 text-hud-text-muted" />
            </div>
            <p className="text-lg font-semibold text-hud-text-primary">정규 매물이 없습니다</p>
            <p className="text-sm text-hud-text-muted mt-2 max-w-sm mx-auto">임시 매물 목록에서 매물을 저장해주세요</p>
            <Button
              variant="primary"
              className="mt-6"
              onClick={() => navigate('/real-estate')}
            >
              단지 목록으로 이동
            </Button>
          </div>
        ) : (
          <HudCard noPadding className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              {/* 테이블 헤더 */}
              <thead>
                <tr className="bg-hud-bg-secondary border-b-2 border-[var(--hud-border-table)]">
                  <th className="px-3 py-3 text-center w-10">
                    <button
                      onClick={toggleSelectAll}
                      className="p-1.5 hover:bg-hud-bg-hover rounded-md transition-colors"
                      title={isCurrentPageAllSelected ? '전체 해제' : '전체 선택'}
                    >
                      {isCurrentPageAllSelected ? (
                        <CheckSquare className="w-4 h-4 text-hud-accent-primary" />
                      ) : (
                        <Square className="w-4 h-4 text-hud-text-muted" />
                      )}
                    </button>
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-hud-text-primary uppercase tracking-wide" style={{ width: '200px' }} title="단지명 또는 매물 제목">
                    단지명/매물명
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-hud-text-primary uppercase tracking-wide" style={{ width: '180px' }} title="단지 주소">
                    주소
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-hud-text-primary uppercase tracking-wide" style={{ width: '80px' }} title="아파트, 오피스텔, 빌라 등 매물 종류">
                    유형
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-hud-text-primary uppercase tracking-wide" style={{ width: '70px' }} title="매매, 전세, 월세">
                    거래
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-hud-text-primary uppercase tracking-wide cursor-pointer hover:text-hud-accent-primary transition-colors" onClick={() => handleSort('price')} style={{ width: '100px' }} title="매매가 또는 보증금">
                    가격 {sortField === 'price' && <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-hud-text-primary uppercase tracking-wide" style={{ width: '70px' }} title="월세 (만원)">
                    월세
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-hud-text-primary uppercase tracking-wide" style={{ width: '70px' }} title="전용면적 (㎡)">
                    면적
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-hud-text-primary uppercase tracking-wide" style={{ width: '60px' }} title="해당 층">
                    층
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-hud-text-primary uppercase tracking-wide" style={{ width: '120px' }} title="매물 저장 날짜/시간">
                    저장일시
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-hud-text-primary uppercase tracking-wide" style={{ width: '60px' }} title="매물 삭제">
                    관리
                  </th>
                </tr>
              </thead>

              {/* 테이블 바디 */}
              <tbody>
                {currentArticles.map((article, idx) => (
                  <tr
                    key={article.id}
                    className={`border-b border-hud-text-muted/20 text-sm transition-all duration-150 ${selectedItems.has(article.id)
                      ? 'bg-hud-accent-primary/15'
                      : 'bg-hud-bg-primary hover:bg-hud-bg-hover/80'
                      }`}
                    style={{ animationDelay: `${idx * 20}ms` }}
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
                    <td className="px-3 py-2">
                      <p className="truncate font-medium text-hud-text-primary" title={article.complexName || article.buildingName}>
                        {article.complexName || article.buildingName || '-'}
                      </p>
                      <p className="text-xs text-hud-text-muted truncate mt-0.5" title={article.articleName}>
                        {article.articleName}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <p className="text-xs text-hud-text-secondary truncate" title={article.cortarAddress || ''}>
                        {article.cortarAddress || '-'}
                      </p>
                      {(article as any).roadAddress && (() => {
                        const cortar = article.cortarAddress || '';
                        const parts = cortar.split(' ');
                        const prefix = parts.length >= 2 ? parts.slice(0, -1).join(' ') + ' ' : '';
                        const detail = (article as any).detailAddress ? ' ' + (article as any).detailAddress : '';
                        const fullRoad = `${prefix}${(article as any).roadAddress}${detail}`;
                        return (
                          <p className="text-[10px] text-hud-text-muted truncate mt-0.5" title={fullRoad}>
                            {fullRoad}
                          </p>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className="text-xs px-2 py-1 bg-hud-bg-secondary rounded-md text-hud-text-secondary">
                        {PROPERTY_TYPES.find((t) => t.code === article.realEstateTypeCode)?.label || article.realEstateTypeName || '-'}
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
                      {parseFloor(article.floorInfo)}
                    </td>
                    <td className="px-3 py-2 text-xs text-hud-text-muted">
                      {new Date(article.savedAt).toLocaleString('ko-KR', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteItem(article.id)}
                        className="p-2 text-hud-text-muted hover:text-hud-accent-danger hover:bg-hud-accent-danger/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 페이징 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-4 bg-hud-bg-secondary border-t border-[var(--hud-border-table)]">
                <div className="text-sm text-hud-text-muted">
                  <span className="font-medium text-hud-text-primary">{startIndex + 1}-{Math.min(endIndex, processedArticles.length)}</span>
                  <span className="mx-2">/</span>
                  <span>전체 {processedArticles.length}건</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    이전
                  </Button>
                  <div className="flex items-center gap-1 px-3 py-1 bg-hud-bg-primary rounded-lg border border-[var(--hud-border-table)]">
                    <span className="text-sm font-medium text-hud-text-primary">{currentPage}</span>
                    <span className="text-sm text-hud-text-muted mx-1">/</span>
                    <span className="text-sm text-hud-text-muted">{totalPages}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    다음
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </HudCard>
        )}
      </HudCard>

      {/* 엑셀 다운로드 모달 */}
      <ExcelExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
        title="정규 매물 엑셀 다운로드"
        totalCount={selectedItems.size > 0 ? selectedItems.size : processedArticles.length}
      />

      {/* 전체 삭제 진행 프로그래스 바 모달 */}
      {isDeletingAll && (
        <div className="hud-modal-overlay">
          <div className="hud-modal-backdrop" />
          <div className="hud-modal-panel p-8 max-w-md w-full mx-4">
            <div className="flex flex-col items-center gap-6">
              {/* 애니메이션 아이콘 */}
              <div className="relative">
                <div className="absolute inset-0 bg-hud-accent-danger/20 rounded-full animate-ping" />
                <div className="relative w-20 h-20 bg-hud-accent-danger/10 rounded-full flex items-center justify-center">
                  <Trash2 className="w-10 h-10 text-hud-accent-danger animate-pulse" />
                </div>
              </div>

              {/* 텍스트 */}
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-hud-text-primary">전체 삭제 중...</h3>
                <p className="text-sm text-hud-text-muted">
                  {deleteProgress.current} / {deleteProgress.total}개 삭제 완료
                </p>
              </div>

              {/* 프로그래스 바 */}
              <div className="w-full space-y-2">
                <div className="h-3 bg-hud-bg-primary rounded-full overflow-hidden border border-hud-border-primary/30">
                  <div
                    className="h-full bg-gradient-to-r from-hud-accent-danger to-hud-accent-danger/70 transition-all duration-300 ease-out"
                    style={{
                      width: `${deleteProgress.total > 0 ? (deleteProgress.current / deleteProgress.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs text-hud-text-muted">
                  <span>{deleteProgress.total > 0 ? Math.round((deleteProgress.current / deleteProgress.total) * 100) : 0}%</span>
                  <span>잠시만 기다려주세요</span>
                </div>
              </div>

              {/* 로딩 스피너 */}
              <div className="flex items-center gap-2 text-sm text-hud-text-muted">
                <Loader2 className="w-4 h-4 animate-spin text-hud-accent-primary" />
                <span>서버에서 삭제 중입니다</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApartmentRegularPropertyList;
