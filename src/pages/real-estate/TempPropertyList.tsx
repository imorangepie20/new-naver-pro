// ============================================
// 임시 매물 목록 페이지
// 단지 클릭 후 나오는 매물 목록 (그리드 형식)
// ============================================

import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Download, Trash2, Save, ChevronLeft, ChevronRight, CheckSquare, Square } from 'lucide-react';
import HudCard from '../../components/common/HudCard';
import Button from '../../components/common/Button';
import type { Article } from '../../types/naver-land';

// 단지 정보 인터페이스
interface ComplexInfo {
  complexNo: string;
  complexName: string;
  realEstateType: string;
}

// 임시 매물 저장소 타입
interface TempArticle extends Article {
  id: string;
  complexNo: string;
  complexName: string;
  createdAt: string;
}

const ITEMS_PER_PAGE = 50;

const TempPropertyList = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // URL 파라미터에서 단지 정보 가져오기
  const complexNo = searchParams.get('complexNo') || '';
  const complexName = searchParams.get('complexName') || '';
  const realEstateType = searchParams.get('realEstateType') || 'APT';

  // 상태
  const [articles, setArticles] = useState<TempArticle[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  // 로컬 스토리지에서 임시 매물 로드
  useEffect(() => {
    loadTempArticles();
  }, [complexNo]);

  const loadTempArticles = () => {
    const stored = localStorage.getItem('tempArticles');
    if (stored) {
      const allArticles: TempArticle[] = JSON.parse(stored);
      const filtered = complexNo
        ? allArticles.filter(a => a.complexNo === complexNo)
        : allArticles;
      setArticles(filtered);
    }
  };

  // 페이징 처리
  const totalPages = Math.ceil(articles.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentArticles = articles.slice(startIndex, endIndex);

  // 전체 선택 토글
  const toggleSelectAll = () => {
    if (selectedItems.size === currentArticles.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(currentArticles.map(a => a.id)));
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

  // 개별 삭제
  const deleteItem = (id: string) => {
    const updated = articles.filter(a => a.id !== id);
    updateArticles(updated);
  };

  // 그룹 삭제
  const deleteSelected = () => {
    if (selectedItems.size === 0) return;
    if (!confirm(`${selectedItems.size}개 매물을 삭제하시겠습니까?`)) return;

    const updated = articles.filter(a => !selectedItems.has(a.id));
    updateArticles(updated);
    setSelectedItems(new Set());
  };

  // 저장소 업데이트
  const updateArticles = (updated: TempArticle[]) => {
    // 전체 임시 매물에서 해당 단지 매물만 업데이트
    const stored = localStorage.getItem('tempArticles');
    let allArticles: TempArticle[] = stored ? JSON.parse(stored) : [];

    // 기존 단지 매물 제거 후 새 매물 추가
    allArticles = allArticles.filter(a =>
      complexNo ? a.complexNo !== complexNo : false
    );
    allArticles = [...allArticles, ...updated];

    localStorage.setItem('tempArticles', JSON.stringify(allArticles));
    setArticles(updated);

    // 페이지 조정
    if (currentPage > Math.ceil(updated.length / ITEMS_PER_PAGE)) {
      setCurrentPage(Math.max(1, Math.ceil(updated.length / ITEMS_PER_PAGE)));
    }
  };

  // 정규 매물로 저장
  const saveToRegular = () => {
    if (selectedItems.size === 0) {
      alert('저장할 매물을 선택해주세요.');
      return;
    }

    const selectedArticles = articles.filter(a => selectedItems.has(a.id));

    // 기존 정규 매물 로드
    const stored = localStorage.getItem('regularArticles');
    const regularArticles: TempArticle[] = stored ? JSON.parse(stored) : [];

    // 정규 매물에 추가 (이미 존재하면 제외)
    const existingIds = new Set(regularArticles.map(a => a.articleNo));
    const newArticles = selectedArticles.filter(a => !existingIds.has(a.articleNo));

    localStorage.setItem('regularArticles', JSON.stringify([...regularArticles, ...newArticles]));

    alert(`${newArticles.length}개 매물을 정규 매물로 저장했습니다.`);
  };

  // 엑셀 다운로드
  const downloadExcel = () => {
    if (articles.length === 0) {
      alert('다운로드할 매물이 없습니다.');
      return;
    }

    // CSV 헤더
    const headers = [
      '매물명',
      '거래타입',
      '가격(만원)',
      '월세(만원)',
      '공급면적(㎡)',
      '전용면적(㎡)',
      '층',
      '방향',
      '확정일',
      '주소',
      '태그',
      '중개업소',
      '중개사',
    ];

    // CSV 데이터 생성
    const csvRows = [
      headers.join(','),
      ...articles.map(a => [
        `"${a.articleName}"`,
        `"${a.tradeTypeName}"`,
        a.dealOrWarrantPrc || '',
        a.rentPrc || '',
        a.area1 || '',
        a.area2 || '',
        `"${a.floorInfo || ''}"`,
        `"${a.direction || ''}"`,
        a.articleConfirmYmd || '',
        `"${a.detailAddress || ''}"`,
        `"${a.tagList?.join(', ') || ''}"`,
        `"${a.cpName || ''}"`,
        `"${a.realtorName || ''}"`,
      ].join(','))
    ];

    const csvContent = '\uFEFF' + csvRows.join('\n'); // UTF-8 BOM
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const now = new Date();
    const timestampStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    link.download = `${complexName || '매물'}_${timestampStr}.csv`;
    link.click();
  };

  // 포맷 함수
  const formatPrice = (price: string | number) => {
    if (!price) return '-';
    const priceStr = String(price);
    const num = parseInt(priceStr.replace(/,/g, ''));
    if (num >= 10000) {
      return `${(num / 10000).toFixed(0)}억 ${num % 10000 > 0 ? (num % 10000).toLocaleString() + '만' : ''}`;
    }
    return `${num.toLocaleString()}만원`;
  };

  return (
    <div className="container mx-auto p-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            단지 목록
          </Button>
          <h1 className="text-xl font-bold text-hud-text-primary">
            {complexName} - 임시 매물 목록
          </h1>
          <span className="text-sm text-hud-text-muted">
            총 {articles.length}건
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={deleteSelected}
            disabled={selectedItems.size === 0}
          >
            <Trash2 className="w-4 h-4 mr-1" />
            삭제 ({selectedItems.size})
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={downloadExcel}
          >
            <Download className="w-4 h-4 mr-1" />
            엑셀 다운로드
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={saveToRegular}
            disabled={selectedItems.size === 0}
          >
            <Save className="w-4 h-4 mr-1" />
            정규 매물로 저장
          </Button>
        </div>
      </div>

      {/* 그리드 테이블 */}
      <HudCard noPadding>
        {articles.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-hud-text-muted">임시 매물이 없습니다.</p>
          </div>
        ) : (
          <>
            {/* 테이블 헤더 */}
            <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-hud-bg-secondary border-b border-hud-border-secondary text-sm font-medium text-hud-text-primary">
              <div className="col-span-1 flex items-center">
                <button
                  onClick={toggleSelectAll}
                  className="p-1 hover:bg-hud-bg-hover rounded"
                >
                  {selectedItems.size === currentArticles.length ? (
                    <CheckSquare className="w-4 h-4 text-hud-accent-primary" />
                  ) : (
                    <Square className="w-4 h-4 text-hud-text-muted" />
                  )}
                </button>
              </div>
              <div className="col-span-2">매물명</div>
              <div className="col-span-1">거래타입</div>
              <div className="col-span-1">가격</div>
              <div className="col-span-1">월세</div>
              <div className="col-span-1">면적(㎡)</div>
              <div className="col-span-1">층</div>
              <div className="col-span-1">확정일</div>
              <div className="col-span-2">주소</div>
              <div className="col-span-1">관리</div>
            </div>

            {/* 테이블 바디 */}
            <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
              {currentArticles.map((article) => (
                <div
                  key={article.id}
                  className={`grid grid-cols-12 gap-2 px-4 py-3 border-b border-hud-border-secondary text-sm hover:bg-hud-bg-hover/50 ${
                    selectedItems.has(article.id) ? 'bg-hud-accent-primary/10' : 'bg-hud-bg-primary'
                  }`}
                >
                  <div className="col-span-1 flex items-center">
                    <button
                      onClick={() => toggleSelectItem(article.id)}
                      className="p-1 hover:bg-hud-bg-hover rounded"
                    >
                      {selectedItems.has(article.id) ? (
                        <CheckSquare className="w-4 h-4 text-hud-accent-primary" />
                      ) : (
                        <Square className="w-4 h-4 text-hud-text-muted" />
                      )}
                    </button>
                  </div>
                  <div className="col-span-2 truncate text-hud-text-primary" title={article.articleName}>
                    {article.articleName}
                  </div>
                  <div className="col-span-1 text-hud-text-secondary">
                    {article.tradeTypeName}
                  </div>
                  <div className="col-span-1 text-hud-accent-primary font-medium">
                    {formatPrice(article.dealOrWarrantPrc)}
                  </div>
                  <div className="col-span-1 text-hud-text-secondary">
                    {article.rentPrc ? `${article.rentPrc}만원` : '-'}
                  </div>
                  <div className="col-span-1 text-hud-text-secondary">
                    {article.area1}
                  </div>
                  <div className="col-span-1 text-hud-text-secondary">
                    {article.floorInfo}
                  </div>
                  <div className="col-span-1 text-hud-text-secondary">
                    {article.articleConfirmYmd}
                  </div>
                  <div className="col-span-2 truncate text-hud-text-muted" title={article.detailAddress}>
                    {article.detailAddress}
                  </div>
                  <div className="col-span-1 flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteItem(article.id)}
                      className="p-1 text-hud-accent-danger hover:text-hud-accent-danger"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* 페이징 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 bg-hud-bg-secondary border-t border-hud-border-secondary">
                <div className="text-sm text-hud-text-muted">
                  {startIndex + 1}-{Math.min(endIndex, articles.length)} / {articles.length}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-hud-text-primary px-3">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </HudCard>

      {/* 정규 매물 목록 버튼 */}
      <div className="mt-4 flex justify-end">
        <Button
          variant="outline"
          onClick={() => navigate('/real-estate/regular-properties')}
        >
          정규 매물 목록 →
        </Button>
      </div>
    </div>
  );
};

export default TempPropertyList;
