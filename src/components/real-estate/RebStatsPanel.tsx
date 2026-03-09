import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Database, RefreshCw } from 'lucide-react';
import HudCard from '../common/HudCard';
import Button from '../common/Button';
import { API_BASE } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';

type RebRow = Record<string, unknown>;

interface RebTableDataResponse {
  success: boolean;
  rows: RebRow[];
  listTotalCount: number | null;
  serviceName: string | null;
  error?: string;
}

const TABLE_PRESETS = [
  { label: '월 매매수급동향(주택종합)', value: 'A_2024_00041' },
  { label: '월 전세수급동향(주택종합)', value: 'A_2024_00042' },
  { label: '월 월세수급동향(주택종합)', value: 'A_2024_00043' },
  { label: '월 매매가격지수(주택종합)', value: 'A_2024_00016' },
];

function formatCellValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function pickPreviewColumns(rows: RebRow[]) {
  if (rows.length === 0) return [] as string[];
  const keys = Object.keys(rows[0]);

  const preferred = [
    'WRTTIME_IDTFR_ID',
    'WRTTIME_IDTFR',
    'BASE_DE',
    'DTACYCLE_CD',
    'CLS_NM',
    'C1_NM',
    'C2_NM',
    'ITM_NM',
    'DTA_VAL',
    'DTVAL_CO',
    'VAL',
  ];

  const ordered = preferred.filter((key) => keys.includes(key));
  for (const key of keys) {
    if (ordered.length >= 6) break;
    if (!ordered.includes(key)) ordered.push(key);
  }

  return ordered.slice(0, 6);
}

const RebStatsPanel = () => {
  const authFetch = useAuthStore((state) => state.authFetch);
  const [statblId, setStatblId] = useState('');
  const [rows, setRows] = useState<RebRow[]>([]);
  const [listTotalCount, setListTotalCount] = useState<number | null>(null);
  const [serviceName, setServiceName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewColumns = useMemo(() => pickPreviewColumns(rows), [rows]);

  const fetchRebData = async (refresh = false) => {
    const selectedStatblId = statblId.trim();
    if (!selectedStatblId) {
      setRows([]);
      setListTotalCount(null);
      setServiceName(null);
      setError(null);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        statblId: selectedStatblId,
        size: '12',
        type: 'json',
      });

      const response = await authFetch(`${API_BASE}/api/public/reb/table-data?${params.toString()}`);
      const data = (await response.json()) as RebTableDataResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'REB 통계 데이터를 불러오지 못했습니다.');
      }

      setRows(Array.isArray(data.rows) ? data.rows : []);
      setListTotalCount(data.listTotalCount ?? null);
      setServiceName(data.serviceName ?? null);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'REB 통계 API 호출 실패');
      setRows([]);
      setListTotalCount(null);
      setServiceName(null);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!statblId.trim()) {
      setIsLoading(false);
      return;
    }
    fetchRebData();
  }, [statblId]);

  return (
    <HudCard
      title="공공 통계 (REB)"
      subtitle={serviceName ? `${serviceName} 응답` : '한국부동산원 Open API 연동'}
      action={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fetchRebData(true)}
          disabled={isRefreshing}
          leftIcon={<RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />}
        >
          새로고침
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-3">
          <input
            value={statblId}
            onChange={(e) => setStatblId(e.target.value.trim())}
            placeholder="통계표 ID 입력 (예: A_2024_00016)"
            className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:border-hud-accent-primary"
          />
          <select
            value={statblId}
            onChange={(e) => setStatblId(e.target.value)}
            className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:border-hud-accent-primary"
          >
            <option value="">통계표 선택</option>
            {TABLE_PRESETS.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-hud-bg-primary border border-hud-border-secondary rounded-lg p-3">
            <p className="text-xs text-hud-text-muted mb-1">표본 건수</p>
            <p className="text-lg font-semibold text-hud-text-primary">{rows.length.toLocaleString()}</p>
          </div>
          <div className="bg-hud-bg-primary border border-hud-border-secondary rounded-lg p-3">
            <p className="text-xs text-hud-text-muted mb-1">총 건수</p>
            <p className="text-lg font-semibold text-hud-text-primary">
              {listTotalCount !== null ? listTotalCount.toLocaleString() : '-'}
            </p>
          </div>
          <div className="bg-hud-bg-primary border border-hud-border-secondary rounded-lg p-3">
            <p className="text-xs text-hud-text-muted mb-1">통계표 ID</p>
            <p className="text-sm font-mono text-hud-accent-primary truncate">{statblId || '-'}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="h-44 rounded-lg border border-hud-border-secondary bg-hud-bg-primary flex items-center justify-center">
            <div className="flex items-center gap-2 text-hud-text-muted text-sm">
              <RefreshCw size={16} className="animate-spin" />
              불러오는 중...
            </div>
          </div>
        ) : error ? (
          <div className="rounded-lg border border-hud-accent-danger/40 bg-hud-accent-danger/10 p-4 text-sm text-hud-accent-danger">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="h-44 rounded-lg border border-hud-border-secondary bg-hud-bg-primary flex items-center justify-center text-hud-text-muted text-sm">
            <Database size={16} className="mr-2" />
            표시할 데이터가 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-hud-border-secondary">
            <table className="w-full min-w-[780px] text-sm">
              <thead className="bg-hud-bg-primary">
                <tr>
                  {previewColumns.map((column) => (
                    <th
                      key={column}
                      className="px-3 py-2 text-left text-xs font-semibold text-hud-text-secondary border-b border-hud-border-secondary"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 8).map((row, index) => (
                  <tr key={`${index}-${String(row[previewColumns[0]] ?? index)}`} className="bg-hud-bg-secondary">
                    {previewColumns.map((column) => (
                      <td
                        key={column}
                        className="px-3 py-2 text-xs text-hud-text-primary border-b border-hud-border-secondary/50 max-w-[220px] truncate"
                        title={formatCellValue(row[column])}
                      >
                        {formatCellValue(row[column])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </HudCard>
  );
};

export default RebStatsPanel;
