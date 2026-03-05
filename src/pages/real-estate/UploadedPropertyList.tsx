// ============================================
// 업로드한 매물 목록 페이지
// 파일 업로드로 등록한 매물 목록 조회 (dataSource=UPLOAD)
// ============================================

import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
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
  Upload,
  Heart,
  ClipboardList,
  X,
  Pencil,
  Eye,
  DollarSign,
  FileText,
  User,
} from 'lucide-react';
import HudCard from '../../components/common/HudCard';
import Button from '../../components/common/Button';
import ExcelExportModal, { EXPORT_FIELDS, ExportFieldKey } from '../../components/real-estate/ExcelExportModal';
import type { Article } from '../../types/naver-land';

const ITEMS_PER_PAGE = 50;
import { API_BASE } from '../../lib/api';

// 업로드 매물 타입
interface UploadedArticle extends Article {
  id: string;
  complexNo?: string;
  complexName?: string;
  cortarNo?: string;
  cortarName?: string;
  savedAt: string; // 저장된 시간
}

const UploadedPropertyList = () => {
  const navigate = useNavigate();

  // 상태
  const [articles, setArticles] = useState<UploadedArticle[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showExportModal, setShowExportModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [favoriteArticleIds, setFavoriteArticleIds] = useState<Set<string>>(new Set()); // 관심매물 ID 목록
  const [favoriteIdMap, setFavoriteIdMap] = useState<Map<string, string>>(new Map()); // articleId -> favoritePropertyId 매핑
  const [managedArticleIds, setManagedArticleIds] = useState<Set<string>>(new Set()); // 관리매물 ID 목록

  // 관리매물 모달 상태
  const [showManagedModal, setShowManagedModal] = useState(false);
  const [managedForm, setManagedForm] = useState({
    articleName: '',
    buildingName: '',
    address: '',
    contractType: '전세',
    propertyType: '',
    downPayment: '',
    downPaymentDate: '',
    interimPayment: '',
    interimPaymentDate: '',
    finalPayment: '',
    finalPaymentDate: '',
    contractDate: '',
    contractEndDate: '',
    totalPrice: '',
    depositAmount: '',
    monthlyRent: '',
    tenantName: '',
    tenantPhone: '',
    managerName: '',
    managerPhone: '',
    notes: '',
  });

  // ========== 매물 수정 모달 상태 ==========
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingArticle, setEditingArticle] = useState<UploadedArticle | null>(null);

  // ========== 매물 상세보기 모달 상태 ==========
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailArticle, setDetailArticle] = useState<UploadedArticle | null>(null);
  const [editForm, setEditForm] = useState({
    articleName: '',
    buildingName: '',
    detailAddress: '',
    realEstateTypeName: 'APT',
    tradeTypeName: '매매',
    dealOrWarrantPrc: '',
    rentPrc: '',
    area1: '',
    area2: '',
    floorInfo: '',
    managerName: '',
    managerPhone: '',
    articleFeatureDesc: '',
  });

  // 정렬 상태
  const [sortField, setSortField] = useState<'savedAt' | 'price' | 'area' | 'complex' | 'floor'>('savedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // 필터 상태
  const [filterComplex, setFilterComplex] = useState('');
  const [selectedPropertyTypes, setSelectedPropertyTypes] = useState<Set<string>>(new Set());
  const [selectedTradeType, setSelectedTradeType] = useState<string>(''); // '' = 전체

  // 매물 유형 정의
  const PROPERTY_TYPES = [
    { code: 'APT', label: '아파트' },
    { code: 'OPST', label: '오피스텔' },
    { code: 'VL', label: '빌라' },
    { code: 'ONEROOM', label: '원룸' },
    { code: 'TWOROOM', label: '투룸' },
    { code: 'SG', label: '상가' },
    { code: 'DDDGG', label: '단독/다가구' },
  ];

  // 서버에서 업로드 매물 로드
  useEffect(() => {
    loadUploadedArticles();
    loadFavoriteProperties();
    loadManagedProperties();
  }, []);

  // 관심매물 목록 로드
  const loadFavoriteProperties = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/favorite-properties`);
      if (response.ok) {
        const data = await response.json();
        const favorites = data.properties || [];
        const ids = new Set<string>();
        const idMap = new Map<string, string>();
        favorites.forEach((f: any) => {
          if (f.notes) {
            const match = f.notes.match(/propertyId:([^\s|]+)/);
            if (match) {
              ids.add(match[1]);
              idMap.set(match[1], f.id); // articleId -> favoritePropertyId
            }
          }
        });
        setFavoriteArticleIds(ids);
        setFavoriteIdMap(idMap);
      }
    } catch (error) {
      console.error('관심매물 로드 실패:', error);
    }
  };

  // 관리매물 목록 로드
  const loadManagedProperties = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/managed-properties`);
      if (response.ok) {
        const data = await response.json();
        const managed = data.properties || [];
        const ids = new Set<string>();
        managed.forEach((m: any) => {
          if (m.notes) {
            const match = m.notes.match(/propertyId:([^\s|]+)/);
            if (match) {
              ids.add(match[1]);
            }
          }
        });
        setManagedArticleIds(ids);
      }
    } catch (error) {
      console.error('관리매물 로드 실패:', error);
    }
  };

  const loadUploadedArticles = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 중앙 DB에서 업로드 매물만 가져오기
      const response = await fetch(`${API_BASE}/api/properties?dataSource=UPLOAD`);

      if (!response.ok) {
        throw new Error('서버 조회 실패');
      }

      const data = await response.json();
      const properties = data.properties || [];

      // 서버 데이터를 UploadedArticle 형식으로 변환
      const convertedArticles: UploadedArticle[] = properties.map((prop: any) => {
        return {
          ...prop,
          id: prop.articleNo,
          articleNo: prop.articleNo,
          complexNo: prop.complexNo,
          complexName: prop.buildingName,
          cortarNo: prop.cortarNo,
          cortarName: prop.cortarName,
          savedAt: prop.createdAt || prop.lastCrawledAt,
          articleName: prop.articleName || prop.buildingName,
          dealOrWarrantPrc: prop.dealOrWarrantPrc,
          tradeTypeName: prop.tradeTypeName,
          realEstateTypeName: prop.realEstateTypeName,
          managerName: prop.managerName,
          managerPhone: prop.managerPhone,
        } as UploadedArticle;
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
        case 'floor':
          const parseFloor = (floorInfo: string | undefined): number => {
            if (!floorInfo) return -999;
            const match = floorInfo.match(/(\d+)/);
            return match ? parseInt(match[1]) : -999;
          };
          const floorA = parseFloor(a.floorInfo);
          const floorB = parseFloor(b.floorInfo);
          comparison = floorA - floorB;
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
    if (!confirm('이 매물을 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`${API_BASE}/api/properties/${id}`, {
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
        fetch(`${API_BASE}/api/properties/${id}`, { method: 'DELETE' })
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

    try {
      // 개별 삭제 요청
      const articleNos = articles.map((a) => a.id);
      let deletedCount = 0;

      for (const id of articleNos) {
        const response = await fetch(`${API_BASE}/api/properties/${id}`, {
          method: 'DELETE',
        });
        if (response.ok) deletedCount++;
      }

      if (deletedCount > 0) {
        setArticles([]);
        setSelectedItems(new Set());
        setCurrentPage(1);
        alert(`${deletedCount}개 삭제 완료`);
      } else {
        alert('전체 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('전체 삭제 실패:', error);
      alert('전체 삭제에 실패했습니다.');
    }
  };

  // ========== 관심매물 토글 (등록/삭제) ==========
  const toggleFavorite = async (article: UploadedArticle) => {
    const isFavorite = favoriteArticleIds.has(article.id);

    // 이미 관심매물이면 삭제
    if (isFavorite) {
      const favoritePropertyId = favoriteIdMap.get(article.id);
      if (!favoritePropertyId) {
        alert('관심매물 ID를 찾을 수 없습니다.');
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/api/favorite-properties/${favoritePropertyId}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          setFavoriteArticleIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(article.id);
            return newSet;
          });
          setFavoriteIdMap(prev => {
            const newMap = new Map(prev);
            newMap.delete(article.id);
            return newMap;
          });
        } else {
          alert('삭제 실패');
        }
      } catch (error) {
        console.error('관심매물 삭제 실패:', error);
        alert('관심매물 삭제에 실패했습니다.');
      }
      return;
    }

    // 관심매물에 등록
    try {
      const articleName = article.articleName || article.buildingName || article.complexName || '매물';
      const managerNote = article.managerName
        ? `담당: ${article.managerName}${article.managerPhone ? ` (${article.managerPhone})` : ''}`
        : '';
      const notes = `propertyId:${article.id}${managerNote ? ' | ' + managerNote : ''}`;

      let price: number | null = null;
      if (article.dealOrWarrantPrc) {
        if (typeof article.dealOrWarrantPrc === 'number') {
          price = article.dealOrWarrantPrc;
        } else {
          const parsed = parseInt(String(article.dealOrWarrantPrc).replace(/,/g, ''));
          price = isNaN(parsed) ? null : parsed;
        }
      }

      const body = {
        articleName,
        buildingName: article.buildingName || article.complexName || null,
        address: article.detailAddress || null,
        propertyType: article.realEstateTypeName || null,
        tradeType: article.tradeTypeName || null,
        price,
        area: article.area1 || article.area2 || null,
        notes: notes || null,
      };

      const response = await fetch(`${API_BASE}/api/favorite-properties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const result = await response.json();
        setFavoriteArticleIds(prev => new Set(prev).add(article.id));
        // ID 매핑 저장
        if (result.property?.id) {
          setFavoriteIdMap(prev => new Map(prev).set(article.id, result.property.id));
        }
      } else {
        const data = await response.json();
        alert(`등록 실패: ${data.error || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error('관심매물 등록 실패:', error);
      alert('관심매물 등록에 실패했습니다.');
    }
  };

  // ========== 관리매물 등록 (모달 표시) ==========
  const addToManaged = (article: UploadedArticle) => {
    const getContractEndDate = (tradeType: string) => {
      const date = new Date();
      if (tradeType === '매매') {
        date.setMonth(date.getMonth() + 3);
      } else {
        date.setFullYear(date.getFullYear() + 2);
      }
      return date.toISOString().split('T')[0];
    };

    const today = new Date().toISOString().split('T')[0];

    setManagedForm({
      articleName: article.articleName || article.buildingName || '',
      buildingName: article.buildingName || article.complexName || '',
      address: article.detailAddress || '',
      contractType: article.tradeTypeName || '전세',
      propertyType: article.realEstateTypeName || '',
      contractDate: today,
      contractEndDate: getContractEndDate(article.tradeTypeName || '전세'),
      totalPrice: article.tradeTypeName === '매매' ? String(article.dealOrWarrantPrc || '') : '',
      depositAmount: article.tradeTypeName === '전세' ? String(article.dealOrWarrantPrc || '') : '',
      monthlyRent: article.tradeTypeName === '월세' ? String(article.rentPrc || '') : '',
      managerName: article.managerName || '',
      managerPhone: article.managerPhone || '',
      notes: `propertyId:${article.id}`,
      downPayment: '',
      downPaymentDate: '',
      interimPayment: '',
      interimPaymentDate: '',
      finalPayment: '',
      finalPaymentDate: '',
      tenantName: '',
      tenantPhone: '',
    });
    setShowManagedModal(true);
  };

  // ========== 관리매물 저장 ==========
  const saveManagedProperty = async () => {
    try {
      if (!managedForm.articleName || !managedForm.contractType || !managedForm.contractDate || !managedForm.contractEndDate) {
        alert('매물명, 거래유형, 계약시작일, 계약만료일은 필수입니다.');
        return;
      }

      const body: any = {
        articleName: managedForm.articleName,
        buildingName: managedForm.buildingName || null,
        address: managedForm.address || null,
        contractType: managedForm.contractType,
        propertyType: managedForm.propertyType || null,
        contractDate: managedForm.contractDate,
        contractEndDate: managedForm.contractEndDate,
        managerName: managedForm.managerName || null,
        managerPhone: managedForm.managerPhone || null,
        notes: managedForm.notes || null,
      };

      // 숫자 필드 변환
      const numFields = ['downPayment', 'interimPayment', 'finalPayment', 'totalPrice', 'depositAmount', 'monthlyRent'];
      for (const field of numFields) {
        const value = (managedForm as any)[field];
        body[field] = value ? parseInt(value) : null;
      }

      // 날짜 필드
      const dateFields = ['downPaymentDate', 'interimPaymentDate', 'finalPaymentDate'];
      for (const field of dateFields) {
        const value = (managedForm as any)[field];
        body[field] = value || null;
      }

      const response = await fetch(`${API_BASE}/api/managed-properties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        // propertyId를 notes에서 추출하여 managedArticleIds에 추가
        const propertyIdMatch = managedForm.notes?.match(/propertyId:([^\s|]+)/);
        if (propertyIdMatch) {
          setManagedArticleIds(prev => new Set(prev).add(propertyIdMatch[1]));
        }
        setShowManagedModal(false);
      } else {
        const data = await response.json();
        alert(`등록 실패: ${data.error || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error('관리매물 등록 실패:', error);
      alert('관리매물 등록에 실패했습니다.');
    }
  };

  // ========== 매물 상세보기 ==========
  const viewDetail = (article: UploadedArticle) => {
    setDetailArticle(article);
    setShowDetailModal(true);
  };

  // ========== 매물 수정 (원본 Property) ==========
  const editItem = (article: UploadedArticle) => {
    setEditingArticle(article);
    setEditForm({
      articleName: article.articleName || '',
      buildingName: article.buildingName || article.complexName || '',
      detailAddress: article.detailAddress || '',
      realEstateTypeName: article.realEstateTypeName || 'APT',
      tradeTypeName: article.tradeTypeName || '매매',
      dealOrWarrantPrc: String(article.dealOrWarrantPrc || ''),
      rentPrc: String(article.rentPrc || ''),
      area1: String(article.area1 || ''),
      area2: String(article.area2 || ''),
      floorInfo: article.floorInfo || '',
      managerName: article.managerName || '',
      managerPhone: article.managerPhone || '',
      articleFeatureDesc: article.articleFeatureDesc || '',
    });
    setShowEditModal(true);
  };

  const updateArticle = async () => {
    if (!editingArticle) return;

    try {
      const body: any = {
        articleName: editForm.articleName || editingArticle.articleName,
        buildingName: editForm.buildingName || editingArticle.buildingName,
        detailAddress: editForm.detailAddress || editingArticle.detailAddress,
        realEstateTypeCode: editForm.realEstateTypeName === '아파트' ? 'APT' : editForm.realEstateTypeName === '오피스텔' ? 'OPST' : 'VL',
        realEstateTypeName: editForm.realEstateTypeName,
        tradeTypeCode: editForm.tradeTypeName === '매매' ? 'A1' : editForm.tradeTypeName === '전세' ? 'B1' : 'B2',
        tradeTypeName: editForm.tradeTypeName,
        dealOrWarrantPrc: editForm.dealOrWarrantPrc ? parseInt(editForm.dealOrWarrantPrc) : null,
        rentPrc: editForm.rentPrc ? parseInt(editForm.rentPrc) : null,
        area1: editForm.area1 ? parseFloat(editForm.area1) : null,
        area2: editForm.area2 ? parseFloat(editForm.area2) : null,
        floorInfo: editForm.floorInfo || null,
        managerName: editForm.managerName || null,
        managerPhone: editForm.managerPhone || null,
        articleFeatureDesc: editForm.articleFeatureDesc || null,
      };

      const response = await fetch(`${API_BASE}/api/properties/${editingArticle.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        // 업데이트된 매물을 리스트에서 반영
        setArticles(prev => prev.map(a =>
          a.id === editingArticle.id ? { ...a, ...body } : a
        ));
        setShowEditModal(false);
        alert('✓ 매물이 수정되었습니다.');
      } else {
        alert('수정에 실패했습니다.');
      }
    } catch (error) {
      console.error('매물 수정 실패:', error);
      alert('매물 수정에 실패했습니다.');
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
            case 'detailAddress':
              value = article.detailAddress || '';
              break;
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
            case 'managerName':
              value = article.managerName || '';
              break;
            case 'managerPhone':
              value = article.managerPhone || '';
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
    const dateStr = new Date().toISOString().slice(0, 10);
    link.download = `업로드매물_${dateStr}.csv`;
    link.click();

    return Promise.resolve();
  };

  // 포맷 함수
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
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-hud-text-primary flex items-center gap-2">
              <Upload className="w-6 h-6 text-hud-accent-primary" />
              업로드한 매물 목록
            </h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-hud-text-muted">
              <span>총 <strong className="text-hud-accent-primary">{stats.totalCount}</strong>건</span>
              <span className="w-1 h-1 bg-hud-border-secondary rounded-full" />
              <span><strong className="text-hud-accent-info">{stats.uniqueComplexes}</strong>개 건물</span>
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
      <div className="mb-5 p-4 bg-hud-bg-secondary border border-hud-border-secondary rounded-xl space-y-4">
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
                : 'bg-hud-bg-primary text-hud-text-secondary hover:bg-hud-bg-hover border border-hud-border-secondary'
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
                    : 'bg-hud-bg-primary text-hud-text-secondary hover:bg-hud-bg-hover border border-hud-border-secondary'
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
                  : 'bg-hud-bg-primary text-hud-text-secondary hover:bg-hud-bg-hover border border-hud-border-secondary'
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
                { field: 'complex' as const, label: '건물명' },
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
                placeholder="건물명 검색..."
                value={filterComplex}
                onChange={(e) => setFilterComplex(e.target.value)}
                className="w-full sm:w-48 pl-9 pr-4 py-2 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary placeholder:text-hud-text-muted focus:outline-none focus:border-hud-accent-primary focus:ring-1 focus:ring-hud-accent-primary/50 transition-all"
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
              onClick={loadUploadedArticles}
            >
              다시 시도
            </Button>
          </div>
        ) : processedArticles.length === 0 ? (
          <div className="p-16 text-center">
            <div className="p-4 bg-hud-bg-secondary rounded-2xl w-20 h-20 mx-auto mb-5 flex items-center justify-center">
              <Upload className="w-10 h-10 text-hud-text-muted" />
            </div>
            <p className="text-lg font-semibold text-hud-text-primary">업로드한 매물이 없습니다</p>
            <p className="text-sm text-hud-text-muted mt-2 max-w-sm mx-auto">파일에서 매물을 업로드해주세요</p>
            <Button
              variant="primary"
              className="mt-6"
              onClick={() => navigate('/real-estate/register')}
            >
              매물 업로드하러 가기
            </Button>
          </div>
        ) : (
          <HudCard noPadding className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              {/* 테이블 헤더 */}
              <thead>
                <tr className="border-b-2 border-hud-border-primary bg-hud-bg-tertiary">
                  <th className="px-3 py-3.5 text-center w-10">
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
                  <th className="px-3 py-3.5 text-left text-xs font-semibold text-hud-text-primary uppercase tracking-wide" style={{ width: '200px' }}>
                    매물명
                  </th>
                  <th className="px-3 py-3.5 text-left text-xs font-semibold text-hud-text-primary uppercase tracking-wide" style={{ width: '100px' }}>
                    매물유형
                  </th>
                  <th className="px-3 py-3.5 text-center text-xs font-semibold text-hud-text-primary uppercase tracking-wide" style={{ width: '70px' }}>
                    거래
                  </th>
                  <th className="px-3 py-3.5 text-right text-xs font-semibold text-hud-text-primary uppercase tracking-wide cursor-pointer hover:text-hud-accent-primary transition-colors" onClick={() => handleSort('price')} style={{ width: '90px' }}>
                    가격 {sortField === 'price' && <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                  </th>
                  <th className="px-3 py-3.5 text-right text-xs font-semibold text-hud-text-primary uppercase tracking-wide" style={{ width: '70px' }}>
                    월세
                  </th>
                  <th className="px-3 py-3.5 text-right text-xs font-semibold text-hud-text-primary uppercase tracking-wide cursor-pointer hover:text-hud-accent-primary transition-colors" onClick={() => handleSort('area')} style={{ width: '70px' }}>
                    면적 {sortField === 'area' && <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                  </th>
                  <th className="px-3 py-3.5 text-center text-xs font-semibold text-hud-text-primary uppercase tracking-wide cursor-pointer hover:text-hud-accent-primary transition-colors" onClick={() => handleSort('floor')} style={{ width: '60px' }}>
                    층 {sortField === 'floor' && <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                  </th>
                  <th className="px-3 py-3.5 text-left text-xs font-semibold text-hud-text-primary uppercase tracking-wide" style={{ width: '80px' }}>
                    책임자명
                  </th>
                  <th className="px-3 py-3.5 text-left text-xs font-semibold text-hud-text-primary uppercase tracking-wide" style={{ width: '110px' }}>
                    전화번호
                  </th>
                  <th className="px-3 py-3.5 text-center text-xs font-semibold text-hud-text-primary uppercase tracking-wide" style={{ width: '100px' }}>
                    관리
                  </th>
                </tr>
              </thead>

              {/* 테이블 바디 */}
              <tbody className="bg-hud-bg-secondary">
                {currentArticles.map((article, idx) => (
                  <tr
                    key={article.id}
                    className={`border-b border-hud-border-primary/50 text-sm transition-all duration-150 ${selectedItems.has(article.id)
                      ? 'bg-hud-accent-primary/15'
                      : 'hover:bg-hud-bg-hover'
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
                      <p className="truncate font-medium text-hud-text-primary" title={article.articleName}>
                        {article.articleName || '-'}
                      </p>
                    </td>
                    <td className="px-3 py-2">
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
                    <td className="px-3 py-2 text-hud-text-secondary text-sm">
                      {article.managerName || '-'}
                    </td>
                    <td className="px-3 py-2 text-hud-text-secondary text-sm">
                      {article.managerPhone || '-'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => viewDetail(article)}
                          className="p-2 text-hud-text-muted hover:text-hud-accent-info hover:bg-hud-accent-info/10 rounded-lg transition-all"
                          title="상세보기"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteItem(article.id)}
                          className="p-2 text-hud-text-muted hover:text-hud-accent-danger hover:bg-hud-accent-danger/10"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <button
                          onClick={() => toggleFavorite(article)}
                          className={`p-2 rounded-lg transition-all ${
                            favoriteArticleIds.has(article.id)
                              ? 'text-pink-500 hover:text-pink-600'
                              : 'text-hud-text-muted hover:text-pink-400'
                          }`}
                          title={favoriteArticleIds.has(article.id) ? '관심매물 삭제' : '관심매물 등록'}
                        >
                          <Heart
                            className="w-4 h-4"
                            fill={favoriteArticleIds.has(article.id) ? 'currentColor' : 'none'}
                          />
                        </button>
                        <button
                          onClick={() => addToManaged(article)}
                          className={`p-2 rounded-lg transition-all ${
                            managedArticleIds.has(article.id)
                              ? 'text-emerald-500 hover:text-emerald-600'
                              : 'text-hud-text-muted hover:text-emerald-400'
                          }`}
                          title="관리매물 등록"
                        >
                          <ClipboardList
                            className="w-4 h-4"
                            fill={managedArticleIds.has(article.id) ? 'currentColor' : 'none'}
                          />
                        </button>
                        <button
                          onClick={() => editItem(article)}
                          className="p-2 text-hud-text-muted hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all"
                          title="수정"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 페이징 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-4 bg-hud-bg-secondary border-t border-hud-border-primary">
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
                  <div className="flex items-center gap-1 px-3 py-1 bg-hud-bg-primary rounded-lg border border-hud-border-secondary">
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

        {/* 모바일: 카드 뷰 */}
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
              onClick={loadUploadedArticles}
            >
              다시 시도
            </Button>
          </div>
        ) : processedArticles.length === 0 ? (
          <div className="p-16 text-center">
            <div className="p-4 bg-hud-bg-secondary rounded-2xl w-20 h-20 mx-auto mb-5 flex items-center justify-center">
              <Upload className="w-10 h-10 text-hud-text-muted" />
            </div>
            <p className="text-lg font-semibold text-hud-text-primary">업로드한 매물이 없습니다</p>
            <p className="text-sm text-hud-text-muted mt-2 max-w-sm mx-auto">파일에서 매물을 업로드해주세요</p>
            <Button
              variant="primary"
              className="mt-6"
              onClick={() => navigate('/real-estate/register')}
            >
              매물 업로드하러 가기
            </Button>
          </div>
        ) : (
          <div className="sm:hidden space-y-3">
            {currentArticles.map((article) => (
              <div key={article.id} className="bg-hud-bg-secondary rounded-xl border border-hud-border-secondary overflow-hidden">
                {/* 헤더: 매물명 + 거래유형 + 선택체크박스 */}
                <div className="flex items-center gap-3 p-4 border-b border-hud-border-secondary/50">
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
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-hud-text-primary truncate">{article.articleName || '-'}</h3>
                    {article.buildingName && <p className="text-xs text-hud-text-muted mt-0.5 truncate">{article.buildingName}</p>}
                  </div>
                  {article.tradeTypeName && (
                    <span className={`shrink-0 inline-flex px-2 py-1 text-xs font-medium rounded-lg ${article.tradeTypeName === '매매' ? 'bg-red-500/15 text-red-400'
                            : article.tradeTypeName === '전세' ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-amber-500/15 text-amber-400'
                        }`}>{article.tradeTypeName}</span>
                  )}
                </div>

                {/* 본문 */}
                <div className="p-4 space-y-3">
                  {/* 가격 정보 */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-hud-text-muted">매매/보증금</span>
                    <span className="text-base font-bold text-hud-accent-primary">{formatPrice(article.dealOrWarrantPrc)}</span>
                  </div>
                  {article.rentPrc && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-hud-text-muted">월세</span>
                      <span className="text-sm text-hud-text-secondary">{article.rentPrc}만</span>
                    </div>
                  )}

                  {/* 상세 정보 */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-hud-border-secondary/30">
                    <div className="text-center">
                      <div className="text-xs text-hud-text-muted mb-1">유형</div>
                      <div className="text-xs px-2 py-1 bg-hud-bg-primary rounded-md text-hud-text-secondary inline-block">
                        {PROPERTY_TYPES.find((t) => t.code === article.realEstateTypeCode)?.label || article.realEstateTypeName || '-'}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-hud-text-muted mb-1">면적</div>
                      <div className="text-sm text-hud-text-secondary">{article.area1 || '-'}㎡</div>
                    </div>
                  </div>

                  {/* 층/방향 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-hud-text-muted">층</span>
                      <span className="text-sm text-hud-text-secondary">{parseFloor(article.floorInfo)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-hud-text-muted">방향</span>
                      <span className="text-sm text-hud-text-secondary">{article.direction || '-'}</span>
                    </div>
                  </div>

                  {/* 담당자 정보 */}
                  {article.managerName && (
                    <div className="flex items-center justify-between pt-2 border-t border-hud-border-secondary/30">
                      <span className="text-xs text-hud-text-muted">책임자</span>
                      <span className="text-sm text-hud-text-secondary">{article.managerName}</span>
                    </div>
                  )}
                </div>

                {/* 하단: 관리 버튼 */}
                <div className="flex items-center justify-between px-4 py-3 bg-hud-bg-primary/30">
                  <span className="text-xs text-hud-text-muted">
                    {new Date(article.savedAt).toLocaleDateString('ko-KR')}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => viewDetail(article)}
                      className="p-2 text-hud-text-muted hover:text-hud-accent-info hover:bg-hud-accent-info/10 rounded-lg transition-all"
                      title="상세보기"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleFavorite(article)}
                      className={`p-2 rounded-lg transition-all ${
                        favoriteArticleIds.has(article.id)
                          ? 'text-pink-500 hover:text-pink-600'
                          : 'text-hud-text-muted hover:text-pink-400'
                      }`}
                      title={favoriteArticleIds.has(article.id) ? '관심매물 삭제' : '관심매물 등록'}
                    >
                      <Heart className="w-4 h-4" fill={favoriteArticleIds.has(article.id) ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      onClick={() => addToManaged(article)}
                      className={`p-2 rounded-lg transition-all ${
                        managedArticleIds.has(article.id)
                          ? 'text-emerald-500 hover:text-emerald-600'
                          : 'text-hud-text-muted hover:text-emerald-400'
                      }`}
                      title="관리매물 등록"
                    >
                      <ClipboardList className="w-4 h-4" fill={managedArticleIds.has(article.id) ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      onClick={() => editItem(article)}
                      className="p-2 text-hud-text-muted hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all"
                      title="수정"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteItem(article.id)}
                      className="p-2 text-hud-text-muted hover:text-hud-accent-danger hover:bg-hud-accent-danger/10"
                      title="삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {/* 모바일 페이징 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 bg-hud-bg-secondary border-t border-hud-border-secondary rounded-xl">
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
                  <div className="flex items-center gap-1 px-3 py-1 bg-hud-bg-primary rounded-lg">
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
          </div>
        )}
      </HudCard>

      {/* 엑셀 다운로드 모달 */}
      <ExcelExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
        title="업로드 매물 엑셀 다운로드"
        totalCount={selectedItems.size > 0 ? selectedItems.size : processedArticles.length}
      />

      {/* 관리매물 등록 모달 */}
      {showManagedModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm" onClick={() => setShowManagedModal(false)}>
          <div className="bg-hud-bg-secondary rounded-2xl border border-hud-border-secondary shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-hud-border-secondary">
              <h2 className="text-lg font-bold text-hud-text-primary">관리매물 등록</h2>
              <button onClick={() => setShowManagedModal(false)} className="p-2 hover:bg-hud-bg-hover rounded-lg transition-colors">
                <X className="w-5 h-5 text-hud-text-muted" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* 기본 정보 */}
              <div>
                <h3 className="text-sm font-semibold text-hud-text-primary mb-3">기본 정보</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-hud-text-muted mb-1">매물명 *</label>
                    <input
                      type="text"
                      value={managedForm.articleName}
                      onChange={(e) => setManagedForm(prev => ({ ...prev, articleName: e.target.value }))}
                      className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-hud-text-muted mb-1">건물명/단지명</label>
                    <input
                      type="text"
                      value={managedForm.buildingName}
                      onChange={(e) => setManagedForm(prev => ({ ...prev, buildingName: e.target.value }))}
                      className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-hud-text-muted mb-1">주소</label>
                    <input
                      type="text"
                      value={managedForm.address}
                      onChange={(e) => setManagedForm(prev => ({ ...prev, address: e.target.value }))}
                      className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-hud-text-muted mb-1">거래 유형 *</label>
                    <select
                      value={managedForm.contractType}
                      onChange={(e) => setManagedForm(prev => ({ ...prev, contractType: e.target.value }))}
                      className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30"
                    >
                      <option value="매매">매매</option>
                      <option value="전세">전세</option>
                      <option value="월세">월세</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-hud-text-muted mb-1">매물 유형</label>
                    <select
                      value={managedForm.propertyType}
                      onChange={(e) => setManagedForm(prev => ({ ...prev, propertyType: e.target.value }))}
                      className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30"
                    >
                      <option value="">선택안함</option>
                      <option value="아파트">아파트</option>
                      <option value="오피스텔">오피스텔</option>
                      <option value="빌라">빌라</option>
                      <option value="원룸">원룸</option>
                      <option value="투룸">투룸</option>
                      <option value="상가">상가</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 계약 기간 */}
              <div>
                <h3 className="text-sm font-semibold text-hud-text-primary mb-3">계약 기간</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-hud-text-muted mb-1">계약 시작일 *</label>
                    <input
                      type="date"
                      value={managedForm.contractDate}
                      onChange={(e) => setManagedForm(prev => ({ ...prev, contractDate: e.target.value }))}
                      className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-hud-text-muted mb-1">계약 만료일 *</label>
                    <input
                      type="date"
                      value={managedForm.contractEndDate}
                      onChange={(e) => setManagedForm(prev => ({ ...prev, contractEndDate: e.target.value }))}
                      className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30"
                    />
                  </div>
                </div>
              </div>

              {/* 금액 정보 */}
              <div>
                <h3 className="text-sm font-semibold text-hud-text-primary mb-3">금액 정보</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-hud-text-muted mb-1">총 거래금액 (만원)</label>
                    <input
                      type="number"
                      value={managedForm.totalPrice}
                      onChange={(e) => setManagedForm(prev => ({ ...prev, totalPrice: e.target.value }))}
                      placeholder="매매의 경우"
                      className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-hud-text-muted mb-1">보증금 (만원)</label>
                    <input
                      type="number"
                      value={managedForm.depositAmount}
                      onChange={(e) => setManagedForm(prev => ({ ...prev, depositAmount: e.target.value }))}
                      placeholder="전세의 경우"
                      className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-hud-text-muted mb-1">월세 (만원)</label>
                    <input
                      type="number"
                      value={managedForm.monthlyRent}
                      onChange={(e) => setManagedForm(prev => ({ ...prev, monthlyRent: e.target.value }))}
                      placeholder="월세의 경우"
                      className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30"
                    />
                  </div>
                </div>
              </div>

              {/* 담당 정보 */}
              <div>
                <h3 className="text-sm font-semibold text-hud-text-primary mb-3">담당 정보</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-hud-text-muted mb-1">세입자명</label>
                    <input
                      type="text"
                      value={managedForm.tenantName}
                      onChange={(e) => setManagedForm(prev => ({ ...prev, tenantName: e.target.value }))}
                      className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-hud-text-muted mb-1">세입자 연락처</label>
                    <input
                      type="text"
                      value={managedForm.tenantPhone}
                      onChange={(e) => setManagedForm(prev => ({ ...prev, tenantPhone: e.target.value }))}
                      className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-hud-text-muted mb-1">책임자명</label>
                    <input
                      type="text"
                      value={managedForm.managerName}
                      onChange={(e) => setManagedForm(prev => ({ ...prev, managerName: e.target.value }))}
                      className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-hud-text-muted mb-1">책임자 연락처</label>
                    <input
                      type="text"
                      value={managedForm.managerPhone}
                      onChange={(e) => setManagedForm(prev => ({ ...prev, managerPhone: e.target.value }))}
                      className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30"
                    />
                  </div>
                </div>
              </div>

              {/* 메모 */}
              <div>
                <label className="block text-xs font-medium text-hud-text-muted mb-1">메모</label>
                <textarea
                  value={managedForm.notes}
                  onChange={(e) => setManagedForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-hud-border-secondary">
              <Button variant="outline" onClick={() => setShowManagedModal(false)}>취소</Button>
              <Button onClick={saveManagedProperty} className="bg-emerald-500 hover:bg-emerald-600 text-white">등록</Button>
            </div>
          </div>
        </div>
      )}

      {/* 매물 수정 모달 */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm" onClick={() => setShowEditModal(false)}>
          <div className="bg-hud-bg-secondary rounded-2xl border border-hud-border-secondary shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-hud-border-secondary">
              <h2 className="text-lg font-bold text-hud-text-primary">매물 수정</h2>
              <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-hud-bg-hover rounded-lg transition-colors">
                <X className="w-5 h-5 text-hud-text-muted" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* 기본 정보 */}
              <div>
                <h3 className="text-sm font-semibold text-hud-text-primary mb-3">기본 정보</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-hud-text-muted mb-1">매물명 *</label>
                    <input
                      type="text"
                      value={editForm.articleName}
                      onChange={(e) => setEditForm(prev => ({ ...prev, articleName: e.target.value }))}
                      className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-hud-text-muted mb-1">건물명/단지명</label>
                    <input
                      type="text"
                      value={editForm.buildingName}
                      onChange={(e) => setEditForm(prev => ({ ...prev, buildingName: e.target.value }))}
                      className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-hud-text-muted mb-1">상세 주소</label>
                    <input
                      type="text"
                      value={editForm.detailAddress}
                      onChange={(e) => setEditForm(prev => ({ ...prev, detailAddress: e.target.value }))}
                      className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-hud-text-muted mb-1">매물 유형</label>
                    <select
                      value={editForm.realEstateTypeName}
                      onChange={(e) => setEditForm(prev => ({ ...prev, realEstateTypeName: e.target.value }))}
                      className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30"
                    >
                      <option value="아파트">아파트</option>
                      <option value="오피스텔">오피스텔</option>
                      <option value="빌라">빌라</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-hud-text-muted mb-1">거래 유형</label>
                    <select
                      value={editForm.tradeTypeName}
                      onChange={(e) => setEditForm(prev => ({ ...prev, tradeTypeName: e.target.value }))}
                      className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30"
                    >
                      <option value="매매">매매</option>
                      <option value="전세">전세</option>
                      <option value="월세">월세</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 가격 정보 */}
              <div>
                <h3 className="text-sm font-semibold text-hud-text-primary mb-3">가격 정보 (만원)</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-hud-text-muted mb-1">매매/보증금</label>
                    <input
                      type="number"
                      value={editForm.dealOrWarrantPrc}
                      onChange={(e) => setEditForm(prev => ({ ...prev, dealOrWarrantPrc: e.target.value }))}
                      className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-hud-text-muted mb-1">월세</label>
                    <input
                      type="number"
                      value={editForm.rentPrc}
                      onChange={(e) => setEditForm(prev => ({ ...prev, rentPrc: e.target.value }))}
                      className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30"
                    />
                  </div>
                </div>
              </div>

              {/* 상세 정보 */}
              <div>
                <h3 className="text-sm font-semibold text-hud-text-primary mb-3">상세 정보</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-hud-text-muted mb-1">면적 (㎡)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.area1}
                      onChange={(e) => setEditForm(prev => ({ ...prev, area1: e.target.value }))}
                      className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-hud-text-muted mb-1">층 정보</label>
                    <input
                      type="text"
                      value={editForm.floorInfo}
                      onChange={(e) => setEditForm(prev => ({ ...prev, floorInfo: e.target.value }))}
                      placeholder="예: 3층, 지하1층"
                      className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30"
                    />
                  </div>
                </div>
              </div>

              {/* 담당자 정보 */}
              <div>
                <h3 className="text-sm font-semibold text-hud-text-primary mb-3">담당자 정보</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-hud-text-muted mb-1">책임자명</label>
                    <input
                      type="text"
                      value={editForm.managerName}
                      onChange={(e) => setEditForm(prev => ({ ...prev, managerName: e.target.value }))}
                      className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-hud-text-muted mb-1">책임자 연락처</label>
                    <input
                      type="text"
                      value={editForm.managerPhone}
                      onChange={(e) => setEditForm(prev => ({ ...prev, managerPhone: e.target.value }))}
                      className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30"
                    />
                  </div>
                </div>
              </div>

              {/* 매물 특징 */}
              <div>
                <label className="block text-xs font-medium text-hud-text-muted mb-1">매물 특징</label>
                <textarea
                  value={editForm.articleFeatureDesc}
                  onChange={(e) => setEditForm(prev => ({ ...prev, articleFeatureDesc: e.target.value }))}
                  rows={3}
                  placeholder="예: 주방 리모델링 완료, 남향, 역세권..."
                  className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-hud-border-secondary">
              <Button variant="outline" onClick={() => setShowEditModal(false)}>취소</Button>
              <Button onClick={updateArticle} className="bg-amber-500 hover:bg-amber-600 text-white">수정</Button>
            </div>
          </div>
        </div>
      )}

      {/* 매물 상세보기 모달 */}
      {showDetailModal && detailArticle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4" onClick={() => setShowDetailModal(false)}>
          <div className="bg-hud-bg-secondary rounded-2xl border border-hud-border-secondary shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-hud-border-secondary sticky top-0 bg-hud-bg-secondary z-10">
              <h2 className="text-lg font-bold text-hud-text-primary">매물 상세정보</h2>
              <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-hud-bg-hover rounded-lg transition-colors">
                <X className="w-5 h-5 text-hud-text-muted" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* 기본 정보 */}
              <div>
                <h3 className="text-sm font-semibold text-hud-text-primary mb-4 flex items-center gap-2">
                  <Home className="w-4 h-4 text-hud-accent-primary" />
                  기본 정보
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <span className="text-xs text-hud-text-muted">매물명</span>
                    <p className="text-base font-medium text-hud-text-primary mt-1">{detailArticle.articleName || '-'}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs text-hud-text-muted">건물명/단지명</span>
                    <p className="text-sm text-hud-text-secondary mt-1">{detailArticle.buildingName || detailArticle.complexName || '-'}</p>
                  </div>
                  <div>
                    <span className="text-xs text-hud-text-muted">매물 유형</span>
                    <p className="text-sm text-hud-text-secondary mt-1">
                      {PROPERTY_TYPES.find((t) => t.code === detailArticle.realEstateTypeCode)?.label || detailArticle.realEstateTypeName || '-'}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-hud-text-muted">거래 유형</span>
                    <p className="text-sm text-hud-text-secondary mt-1">{detailArticle.tradeTypeName || '-'}</p>
                  </div>
                </div>
              </div>

              {/* 가격 정보 */}
              <div>
                <h3 className="text-sm font-semibold text-hud-text-primary mb-4 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-hud-accent-warning" />
                  가격 정보
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-hud-text-muted">매매/보증금</span>
                    <p className="text-lg font-bold text-hud-accent-primary mt-1">{formatPrice(detailArticle.dealOrWarrantPrc)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-hud-text-muted">월세</span>
                    <p className="text-lg font-bold text-hud-accent-primary mt-1">{detailArticle.rentPrc ? `${detailArticle.rentPrc}만` : '-'}</p>
                  </div>
                </div>
              </div>

              {/* 상세 정보 */}
              <div>
                <h3 className="text-sm font-semibold text-hud-text-primary mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-hud-accent-info" />
                  상세 정보
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-hud-text-muted">공급면적</span>
                    <p className="text-sm text-hud-text-secondary mt-1">{detailArticle.area1 ? `${detailArticle.area1}㎡` : '-'}</p>
                  </div>
                  <div>
                    <span className="text-xs text-hud-text-muted">전용면적</span>
                    <p className="text-sm text-hud-text-secondary mt-1">{detailArticle.area2 ? `${detailArticle.area2}㎡` : '-'}</p>
                  </div>
                  <div>
                    <span className="text-xs text-hud-text-muted">층</span>
                    <p className="text-sm text-hud-text-secondary mt-1">{parseFloor(detailArticle.floorInfo)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-hud-text-muted">방향</span>
                    <p className="text-sm text-hud-text-secondary mt-1">{detailArticle.direction || '-'}</p>
                  </div>
                </div>
              </div>

              {/* 주소 정보 */}
              {detailArticle.detailAddress && (
                <div>
                  <h3 className="text-sm font-semibold text-hud-text-primary mb-4 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-hud-accent-success" />
                    주소 정보
                  </h3>
                  <p className="text-sm text-hud-text-secondary">{detailArticle.detailAddress}</p>
                </div>
              )}

              {/* 담당자 정보 */}
              {(detailArticle.managerName || detailArticle.managerPhone) && (
                <div>
                  <h3 className="text-sm font-semibold text-hud-text-primary mb-4 flex items-center gap-2">
                    <User className="w-4 h-4 text-hud-accent-danger" />
                    담당자 정보
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-hud-text-muted">책임자명</span>
                      <p className="text-sm text-hud-text-secondary mt-1">{detailArticle.managerName || '-'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-hud-text-muted">연락처</span>
                      <p className="text-sm text-hud-text-secondary mt-1">{detailArticle.managerPhone || '-'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 매물 특징 */}
              {detailArticle.articleFeatureDesc && (
                <div>
                  <h3 className="text-sm font-semibold text-hud-text-primary mb-4 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-hud-accent-primary" />
                    매물 특징
                  </h3>
                  <p className="text-sm text-hud-text-secondary bg-hud-bg-primary p-3 rounded-lg">{detailArticle.articleFeatureDesc}</p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-hud-border-secondary sticky bottom-0 bg-hud-bg-secondary">
              <Button
                variant="outline"
                onClick={() => { setShowDetailModal(false); editItem(detailArticle); }}
                className="flex items-center gap-2"
              >
                <Pencil className="w-4 h-4" />
                수정
              </Button>
              <Button
                onClick={() => setShowDetailModal(false)}
                className="bg-hud-accent-primary hover:bg-hud-accent-primary/90 text-white"
              >
                닫기
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadedPropertyList;
