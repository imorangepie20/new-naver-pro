// ============================================
// 매물 그리드 뷰 컴포넌트 (반응형)
// ============================================

import React, { useMemo } from 'react';
import type { Article } from '../../types/naver-land';
import { Building2, MapPin, Square, Home } from 'lucide-react';

interface PropertyGridProps {
  articles: Article[];
  isLoading?: boolean;
  onArticleClick?: (article: Article) => void;
}

// 컬럼 정의
interface Column {
  key: string;
  label: string;
  render: (article: Article) => React.ReactNode;
  className?: string;
  visible: (screenSize: 'mobile' | 'tablet' | 'desktop') => boolean;
}

const columns: Column[] = [
  {
    key: 'select',
    label: '',
    render: () => (
      <input type="checkbox" className="w-4 h-4 rounded border-gray-300" />
    ),
    className: 'w-10',
    visible: () => true,
  },
  {
    key: 'image',
    label: '이미지',
    render: (article) => (
      <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-200 rounded-lg flex items-center justify-center">
        <Home className="w-6 h-6 text-gray-400" />
      </div>
    ),
    className: 'w-12 sm:w-20',
    visible: () => true,
  },
  {
    key: 'title',
    label: '매물 제목',
    render: (article) => (
      <div className="min-w-0">
        <p className="font-medium text-gray-900 truncate">{article.articleName || article.buildingName || '-'}</p>
        <p className="text-xs sm:text-sm text-gray-500 truncate">
          {article.articleFeatureDesc || '-'}
        </p>
      </div>
    ),
    visible: () => true,
  },
  {
    key: 'type',
    label: '유형',
    render: (article) => (
      <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
        {article.realEstateTypeName}
      </span>
    ),
    className: 'w-16',
    visible: () => true,
  },
  {
    key: 'tradeType',
    label: '거래',
    render: (article) => (
      <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
        article.tradeTypeCode === 'A1'
          ? 'bg-red-100 text-red-800'
          : article.tradeTypeCode === 'B1'
          ? 'bg-green-100 text-green-800'
          : 'bg-yellow-100 text-yellow-800'
      }`}>
        {article.tradeTypeName}
      </span>
    ),
    className: 'w-14',
    visible: (size) => size !== 'mobile',
  },
  {
    key: 'price',
    label: '가격',
    render: (article) => {
      const priceStr = article.dealOrWarrantPrc || '';
      const formatted = priceStr;
      return (
        <div>
          <p className="font-semibold text-hud-text-primary">{formatted}</p>
          {article.rentPrc && article.tradeTypeCode === 'B2' && (
            <p className="text-xs text-hud-text-muted">{parseInt(String(article.rentPrc)).toLocaleString()}만/월</p>
          )}
        </div>
      );
    },
    className: 'w-24',
    visible: () => true,
  },
  {
    key: 'area',
    label: '면적',
    render: (article) => (
      <div className="flex items-center gap-1">
        <Square className="w-3 h-3 text-gray-400" />
        <span>{article.area1}㎡</span>
        {article.area2 && article.area2 !== article.area1 && (
          <span className="text-xs text-gray-500">/ {article.area2}㎡</span>
        )}
      </div>
    ),
    className: 'w-20',
    visible: (size) => size !== 'mobile',
  },
  {
    key: 'floor',
    label: '층수',
    render: (article) => (
      <span className="text-sm text-gray-600">{article.floorInfo || '-'}</span>
    ),
    className: 'w-14',
    visible: (size) => size === 'desktop',
  },
  {
    key: 'direction',
    label: '방향',
    render: (article) => (
      <span className="text-sm text-gray-600">{article.direction || '-'}</span>
    ),
    className: 'w-12',
    visible: (size) => size === 'desktop',
  },
  {
    key: 'confirmDate',
    label: '확정일',
    render: (article) => {
      const date = article.articleConfirmYmd;
      if (!date) return '-';
      const formatted = date.replace(/(\d{4})(\d{2})(\d{2})/, '$1.$2.$3');
      return <span className="text-xs text-gray-500">{formatted}</span>;
    },
    className: 'w-20',
    visible: (size) => size === 'desktop',
  },
  {
    key: 'location',
    label: '위치',
    render: (article) => (
      <div className="flex items-center gap-1 min-w-0">
        <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
        <span className="text-xs text-gray-500 truncate">{article.cortarNo || '-'}</span>
      </div>
    ),
    className: 'w-32',
    visible: (size) => size === 'desktop',
  },
  {
    key: 'realtor',
    label: '중개사',
    render: (article) => (
      <div className="min-w-0">
        <p className="text-sm text-gray-700 truncate">{article.realtorName || '-'}</p>
        <p className="text-xs text-gray-500 truncate">{article.cpName || '-'}</p>
      </div>
    ),
    className: 'w-28',
    visible: (size) => size === 'desktop',
  },
  {
    key: 'tags',
    label: '태그',
    render: (article) => (
      <div className="flex flex-wrap gap-1 max-w-48">
        {article.tagList?.slice(0, 3).map((tag, idx) => (
          <span key={idx} className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
            {tag}
          </span>
        ))}
        {article.tagList?.length > 3 && (
          <span className="text-xs text-gray-400">+{article.tagList.length - 3}</span>
        )}
      </div>
    ),
    visible: (size) => size === 'desktop',
  },
];

export const PropertyGrid: React.FC<PropertyGridProps> = ({
  articles,
  isLoading = false,
  onArticleClick,
}) => {
  const [screenSize, setScreenSize] = React.useState<'mobile' | 'tablet' | 'desktop'>('desktop');

  React.useEffect(() => {
    const updateSize = () => {
      const width = window.innerWidth;
      if (width < 640) setScreenSize('mobile');
      else if (width < 1024) setScreenSize('tablet');
      else setScreenSize('desktop');
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const visibleColumns = useMemo(() => {
    return columns.filter((col) => col.visible(screenSize));
  }, [screenSize]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">매물을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <Building2 className="w-16 h-16 mb-4 text-gray-300" />
        <p className="text-lg font-medium">조회된 매물이 없습니다</p>
        <p className="text-sm">검색 조건을 변경해보세요</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <div className="inline-block min-w-full align-middle sm:px-6 lg:px-8">
        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
          <table className="min-w-full divide-y divide-hud-border-secondary">
            <thead className="bg-hud-bg-secondary">
              <tr>
                {visibleColumns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={`px-3 py-3 text-left text-xs font-medium text-hud-text-secondary uppercase tracking-wider ${
                      column.className || ''
                    }`}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-hud-bg-primary divide-y divide-hud-border-secondary">
              {articles.map((article) => (
                <tr
                  key={article.articleNo}
                  className="hover:bg-hud-bg-hover cursor-pointer transition-colors bg-hud-bg-primary"
                  onClick={() => onArticleClick?.(article)}
                >
                  {visibleColumns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-3 py-4 whitespace-nowrap ${column.className || ''}`}
                    >
                      {column.render(article)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PropertyGrid;
