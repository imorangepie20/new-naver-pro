// ============================================
// 엑셀 다운로드 필드 선택 모달
// ============================================

import { useState } from 'react';
import { X, Download, Check } from 'lucide-react';
import HudCard from '../common/HudCard';
import Button from '../common/Button';

// 필드 정의
export const EXPORT_FIELDS = [
  { key: 'articleName', label: '매물명', default: true },
  { key: 'tradeTypeName', label: '거래타입', default: true },
  { key: 'realEstateTypeName', label: '매물유형', default: true },
  { key: 'dealOrWarrantPrc', label: '매매가/보증금(만원)', default: true },
  { key: 'rentPrc', label: '월세(만원)', default: true },
  { key: 'area1', label: '공급면적(㎡)', default: true },
  { key: 'area2', label: '전용면적(㎡)', default: true },
  { key: 'floorInfo', label: '층수', default: true },
  { key: 'direction', label: '방향', default: false },
  { key: 'articleConfirmYmd', label: '확정일', default: true },
  { key: 'buildingName', label: '건물명', default: false },
  { key: 'cortarAddress', label: '법정동주소', default: true },
  { key: 'roadAddress', label: '도로명주소', default: true },
  { key: 'articleFeatureDesc', label: '매물설명', default: false },
  { key: 'tagList', label: '태그', default: false },
  { key: 'cpName', label: '중개업소', default: true },
  { key: 'realtorName', label: '중개사', default: true },
  { key: 'managerName', label: '책임자명', default: true },
  { key: 'managerPhone', label: '책임자 전화번호', default: true },
  { key: 'latitude', label: '위도', default: false },
  { key: 'longitude', label: '경도', default: false },
] as const;

export type ExportFieldKey = typeof EXPORT_FIELDS[number]['key'];

interface ExcelExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (fields: ExportFieldKey[]) => Promise<void> | void;
  title?: string;
  totalCount?: number;
}

const ExcelExportModal: React.FC<ExcelExportModalProps> = ({
  isOpen,
  onClose,
  onExport,
  title = '엑셀 다운로드',
  totalCount = 0,
}) => {
  const [selectedFields, setSelectedFields] = useState<Set<ExportFieldKey>>(
    new Set(EXPORT_FIELDS.filter((f) => f.default).map((f) => f.key))
  );
  const [isExporting, setIsExporting] = useState(false);

  // 전체 선택 토글
  const toggleSelectAll = () => {
    if (selectedFields.size === EXPORT_FIELDS.length) {
      setSelectedFields(new Set());
    } else {
      setSelectedFields(new Set(EXPORT_FIELDS.map((f) => f.key)));
    }
  };

  // 개별 필드 토글
  const toggleField = (key: ExportFieldKey) => {
    const newSelected = new Set(selectedFields);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedFields(newSelected);
  };

  // 기본 선택으로 초기화
  const resetToDefault = () => {
    setSelectedFields(new Set(EXPORT_FIELDS.filter((f) => f.default).map((f) => f.key)));
  };

  // 내보내기 핸들러
  const handleExport = async () => {
    if (selectedFields.size === 0) {
      alert('최소 하나의 필드를 선택해주세요.');
      return;
    }

    setIsExporting(true);
    try {
      await onExport(Array.from(selectedFields));
      onClose();
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <HudCard className="w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-hud-border-secondary">
          <div>
            <h2 className="text-lg font-semibold text-hud-text-primary">{title}</h2>
            <p className="text-sm text-hud-text-muted">
              총 {totalCount.toLocaleString()}건 • {selectedFields.size}개 필드 선택
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-hud-bg-hover rounded transition-colors"
          >
            <X className="w-5 h-5 text-hud-text-muted" />
          </button>
        </div>

        {/* 필드 목록 */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={toggleSelectAll}
              className="text-sm text-hud-accent-primary hover:text-hud-accent-primary/80 transition-colors"
            >
              {selectedFields.size === EXPORT_FIELDS.length ? '전체 해제' : '전체 선택'}
            </button>
            <button
              onClick={resetToDefault}
              className="text-sm text-hud-text-secondary hover:text-hud-text-primary transition-colors"
            >
              기본 설정으로 초기화
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {EXPORT_FIELDS.map((field) => (
              <button
                key={field.key}
                onClick={() => toggleField(field.key)}
                className={`
                  flex items-center gap-2 p-3 rounded-lg border transition-all text-left
                  ${selectedFields.has(field.key)
                    ? 'bg-hud-accent-primary/10 border-hud-accent-primary text-hud-text-primary'
                    : 'bg-hud-bg-secondary border-hud-border-secondary text-hud-text-secondary hover:bg-hud-bg-hover'
                  }
                `}
              >
                <div className={`
                  w-5 h-5 rounded border flex items-center justify-center flex-shrink-0
                  ${selectedFields.has(field.key)
                    ? 'bg-hud-accent-primary border-hud-accent-primary'
                    : 'border-hud-border-secondary'
                  }
                `}>
                  {selectedFields.has(field.key) && (
                    <Check className="w-3 h-3 text-white" />
                  )}
                </div>
                <span className="text-sm">{field.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-hud-border-secondary bg-hud-bg-secondary">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isExporting}
          >
            취소
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(Array.from(selectedFields).join(','));
              alert('선택한 필드 목록이 클립보드에 복사되었습니다.');
            }}
            disabled={isExporting}
          >
            필드 목록 복사
          </Button>
          <Button
            variant="primary"
            onClick={handleExport}
            disabled={selectedFields.size === 0 || isExporting}
          >
            <Download className="w-4 h-4 mr-1" />
            {isExporting ? '내보내는 중...' : '엑셀 다운로드'}
          </Button>
        </div>
      </HudCard>
    </div>
  );
};

export default ExcelExportModal;
