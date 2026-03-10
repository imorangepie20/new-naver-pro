// ============================================
// 부동산 분석 대시보드 (재작성)
// 매물관리.md 요구사항 기반 구현
// ============================================

import { useEffect, useMemo, useState } from 'react';
import {
    Building2,
    Briefcase,
    Calendar as CalendarIcon,
    Clock,
    MapPin,
    Loader2,
    RefreshCw,
    ArrowRight,
    AlertCircle,
    Sparkles,
    BarChart3,
    Heart,
    ClipboardList,
    TimerReset,
} from 'lucide-react';
import HudCard from '../../components/common/HudCard';
import Button from '../../components/common/Button';
import PriceTrendChart from '../../components/real-estate/PriceTrendChart';
import RebStatsPanel from '../../components/real-estate/RebStatsPanel';
import { useAuthStore } from '../../stores/authStore';
import { useNavigate } from 'react-router-dom';

import { API_BASE } from '../../lib/api';
import { getHolidayName } from '../../lib/korean-holidays';

// ============================================
// 타입 정의
// ============================================

interface DashboardSummary {
    totalProperties: number;
    favoriteCount: number;
    managedCount: number;
}

interface RecentProperty {
    articleNo: string;
    articleName: string;
    realEstateTypeName: string;
    tradeTypeName: string;
    dealOrWarrantPrc: number | null;
    rentPrc: number | null;
    area1: number | null;
    createdAt: string;
}

interface RecentFavorite {
    id: string;
    articleName: string;
    propertyType: string | null;
    tradeType: string | null;
    price: number | null;
    area: number | null;
    createdAt: string;
}

interface RecentManaged {
    id: string;
    articleName: string;
    propertyType: string | null;
    contractType: string;
    totalPrice: number | null;
    depositAmount: number | null;
    monthlyRent: number | null;
    createdAt: string;
}

interface RecentContract {
    id: string;
    articleName: string;
    contractType: string;
    totalPrice: number | null;
    depositAmount: number | null;
    monthlyRent: number | null;
    contractDate: string;
    contractEndDate: string;
}

interface Schedule {
    id: string;
    title: string;
    description: string | null;
    startTime: string;
    endTime: string | null;
    type: string;
    location: string | null;
    isAllDay: boolean;
}

// ============================================
// 유틸리티 함수
// ============================================

const formatPrice = (price: number | null | undefined): string => {
    if (price == null) return '-';
    const ok = Math.floor(price / 10000);
    const man = Math.floor((price % 10000) / 100);

    const parts: string[] = [];
    if (ok > 0) parts.push(`${ok}억`);
    if (man > 0) parts.push(`${man}만`);

    return parts.join(' ') || '0';
};

const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '오늘';
    if (diffDays === 1) return '어제';
    if (diffDays < 7) return `${diffDays}일 전`;

    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
};

const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
};

const formatDateTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return formatTime(dateString);
    if (diffDays < 7) return `${diffDays}일 전`;

    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
};

const formatPercent = (value: number, total: number): string => {
    if (!total) return '0%';
    return `${((value / total) * 100).toFixed(1)}%`;
};

const daysUntil = (dateString: string): number => {
    const target = new Date(dateString);
    const now = new Date();
    target.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};

const getScheduleTypeLabel = (type: string): string => {
    switch (type) {
        case 'meeting':
            return '미팅';
        case 'task':
            return '할 일';
        case 'event':
            return '이벤트';
        case 'break':
            return '휴식';
        default:
            return '일정';
    }
};

const getScheduleTypeColor = (type: string): string => {
    switch (type) {
        case 'meeting':
            return 'bg-hud-accent-primary/12 text-hud-accent-primary';
        case 'task':
            return 'bg-hud-accent-warning/12 text-hud-accent-warning';
        case 'event':
            return 'bg-hud-accent-info/12 text-hud-accent-info';
        case 'break':
            return 'bg-hud-accent-success/12 text-hud-accent-success';
        default:
            return 'bg-hud-bg-tertiary text-hud-text-muted';
    }
};

const getTradeTypeBadgeColor = (tradeType: string): string => {
    switch (tradeType) {
        case '매매':
            return 'bg-red-500/15 text-red-400';
        case '전세':
            return 'bg-emerald-500/15 text-emerald-400';
        case '월세':
            return 'bg-amber-500/15 text-amber-400';
        default:
            return 'bg-hud-bg-tertiary text-hud-text-muted';
    }
};

// ============================================
// 공통 컴포넌트
// ============================================

interface RecentListCardProps {
    title: string;
    subtitle: string;
    items: Array<{
        id: string;
        name: string;
        type?: string;
        tradeType?: string;
        price?: number | null;
        deposit?: number | null;
        monthlyRent?: number | null;
        area?: number | null;
        date?: string;
        contractDate?: string;
        contractEndDate?: string;
    }>;
    emptyMessage: string;
    onItemClick?: (id: string) => void;
    showDate?: boolean;
}

const RecentListCard = ({ title, subtitle, items, emptyMessage, onItemClick, showDate = true }: RecentListCardProps) => {
    return (
        <HudCard title={title} subtitle={subtitle} noPadding>
            <div className="divide-y divide-hud-border-secondary max-h-80 overflow-y-auto">
                {items.length > 0 ? (
                    items.map((item) => (
                        <div
                            key={item.id}
                            className="p-4 hover:bg-hud-bg-hover transition-hud cursor-pointer"
                            onClick={() => onItemClick?.(item.id)}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-hud-text-primary truncate">{item.name}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        {item.type && (
                                            <span className="text-xs text-hud-text-muted">{item.type}</span>
                                        )}
                                        {item.tradeType && (
                                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getTradeTypeBadgeColor(item.tradeType)}`}>
                                                {item.tradeType}
                                            </span>
                                        )}
                                        {item.area && (
                                            <span className="text-xs text-hud-text-muted">{item.area}㎡</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        {(item.price || item.deposit) && (
                                            <span className="text-sm font-mono text-hud-accent-primary">
                                                {formatPrice(item.price || item.deposit)}
                                            </span>
                                        )}
                                        {item.monthlyRent && item.monthlyRent > 0 && (
                                            <span className="text-sm font-mono text-hud-text-secondary">
                                                / {formatPrice(item.monthlyRent)}
                                            </span>
                                        )}
                                    </div>
                                    {showDate && (item.date || item.contractDate) && (
                                        <div className="flex items-center gap-1 mt-1 text-xs text-hud-text-muted">
                                            <Clock size={12} />
                                            <span>{item.date ? formatDate(item.date) : formatDate(item.contractDate!)}</span>
                                        </div>
                                    )}
                                </div>
                                <ArrowRight size={16} className="text-hud-text-muted flex-shrink-0" />
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="p-8 text-center text-hud-text-muted">
                        {emptyMessage}
                    </div>
                )}
            </div>
        </HudCard>
    );
};

interface TodayScheduleCardProps {
    schedules: Schedule[];
    onAdd?: () => void;
}

const TodayScheduleCard = ({ schedules, onAdd }: TodayScheduleCardProps) => {
    // 오늘이 공휴일인지 확인
    const todayHoliday = getHolidayName(new Date());

    return (
        <HudCard
            title="오늘의 일정"
            subtitle={new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
            action={
                onAdd && (
                    <Button variant="ghost" size="sm" leftIcon={<CalendarIcon size={14} />} onClick={onAdd}>
                        캘린더 열기
                    </Button>
                )
            }
            noPadding
        >
            {/* Holiday Banner */}
            {todayHoliday && (
                <div className="m-4 p-3 bg-hud-accent-danger/10 border border-hud-accent-danger/30 rounded-lg flex items-center gap-3">
                    <Sparkles size={18} className="text-hud-accent-danger flex-shrink-0" />
                    <div>
                        <p className="text-sm font-medium text-hud-accent-danger">{todayHoliday}</p>
                        <p className="text-xs text-hud-text-muted">오늘은 공휴일입니다</p>
                    </div>
                </div>
            )}

            <div className="divide-y divide-hud-border-secondary">
                {schedules.length > 0 ? (
                    schedules.map((schedule) => (
                        <div key={schedule.id} className="p-4 hover:bg-hud-bg-hover transition-hud cursor-pointer">
                            <div className="flex gap-3">
                                <div className={`w-1 rounded-full ${schedule.type === 'meeting' ? 'bg-hud-accent-primary' :
                                    schedule.type === 'task' ? 'bg-hud-accent-warning' :
                                        schedule.type === 'event' ? 'bg-hud-accent-info' :
                                            schedule.type === 'break' ? 'bg-hud-accent-success' :
                                                'bg-hud-text-muted'
                                    }`} />
                                <div className="flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h4 className="text-sm font-medium text-hud-text-primary">{schedule.title}</h4>
                                        <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${getScheduleTypeColor(schedule.type)}`}>
                                            {getScheduleTypeLabel(schedule.type)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 mt-1">
                                        <div className="flex items-center gap-1 text-xs text-hud-text-muted">
                                            <Clock size={12} />
                                            <span>
                                                {schedule.isAllDay ? '하루 종일' : formatTime(schedule.startTime)}
                                                {schedule.endTime && !schedule.isAllDay && ` ~ ${formatTime(schedule.endTime)}`}
                                            </span>
                                        </div>
                                        {schedule.location && (
                                            <div className="flex items-center gap-1 text-xs text-hud-text-muted">
                                                <MapPin size={12} />
                                                <span>{schedule.location}</span>
                                            </div>
                                        )}
                                    </div>
                                    {schedule.description && (
                                        <p className="text-xs text-hud-text-muted mt-1 line-clamp-1">{schedule.description}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="p-8 text-center text-hud-text-muted">
                        <CalendarIcon size={32} className="mx-auto mb-2 opacity-50" />
                        <p>오늘 일정이 없습니다</p>
                    </div>
                )}
            </div>
        </HudCard>
    );
};

interface SummaryMetricCardProps {
    title: string;
    value: string;
    description: string;
    icon: React.ReactNode;
}

const SummaryMetricCard = ({ title, value, description, icon }: SummaryMetricCardProps) => (
    <HudCard className="h-full">
        <div className="flex items-start justify-between gap-3">
            <div>
                <p className="text-xs font-medium text-hud-text-muted">{title}</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-hud-text-primary">{value}</p>
                <p className="mt-2 text-xs text-hud-text-muted">{description}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-hud-border-secondary bg-hud-bg-secondary text-hud-text-secondary">
                {icon}
            </div>
        </div>
    </HudCard>
);

// ============================================
// 메인 컴포넌트
// ============================================

const Dashboard = () => {
    const authFetch = useAuthStore((state) => state.authFetch);
    const navigate = useNavigate();
    const [summary, setSummary] = useState<DashboardSummary | null>(null);
    const [recentProperties, setRecentProperties] = useState<RecentProperty[]>([]);
    const [recentFavorites, setRecentFavorites] = useState<RecentFavorite[]>([]);
    const [recentManaged, setRecentManaged] = useState<RecentManaged[]>([]);
    const [recentContracts, setRecentContracts] = useState<RecentContract[]>([]);
    const [todaySchedules, setTodaySchedules] = useState<Schedule[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchDashboardData = async (showRefreshing = false) => {
        if (showRefreshing) {
            setIsRefreshing(true);
        } else {
            setIsLoading(true);
        }

        try {
            const [
                summaryRes,
                propertiesRes,
                favoritesRes,
                managedRes,
                contractsRes,
                schedulesRes,
            ] = await Promise.all([
                authFetch(`${API_BASE}/api/dashboard/summary`),
                authFetch(`${API_BASE}/api/dashboard/recent-properties?days=10`),
                authFetch(`${API_BASE}/api/dashboard/recent-favorites?days=10`),
                authFetch(`${API_BASE}/api/dashboard/recent-managed?days=10`),
                authFetch(`${API_BASE}/api/dashboard/recent-contracts?days=30`),
                authFetch(`${API_BASE}/api/schedules/today`),
            ]);

            if (summaryRes.ok) {
                const data = await summaryRes.json();
                setSummary(data);
            }

            if (propertiesRes.ok) {
                const data = await propertiesRes.json();
                setRecentProperties(data.properties || []);
            }

            if (favoritesRes.ok) {
                const data = await favoritesRes.json();
                setRecentFavorites(data.favorites || []);
            }

            if (managedRes.ok) {
                const data = await managedRes.json();
                setRecentManaged(data.managed || []);
            }

            if (contractsRes.ok) {
                const data = await contractsRes.json();
                setRecentContracts(data.contracts || []);
            }

            if (schedulesRes.ok) {
                const data = await schedulesRes.json();
                setTodaySchedules(data.schedules || []);
            }
        } catch (error) {
            console.error('Failed to fetch dashboard data:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const todayScheduleSorted = useMemo(
        () => [...todaySchedules].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
        [todaySchedules]
    );

    const nextSchedule = useMemo(() => {
        const now = new Date();
        return todayScheduleSorted.find((schedule) => new Date(schedule.startTime) >= now) || todayScheduleSorted[0] || null;
    }, [todayScheduleSorted]);

    const expiringContracts = useMemo(
        () => recentContracts
            .map((contract) => ({ ...contract, daysLeft: daysUntil(contract.contractEndDate) }))
            .filter((contract) => contract.daysLeft >= 0 && contract.daysLeft <= 30)
            .sort((a, b) => a.daysLeft - b.daysLeft)
            .slice(0, 4),
        [recentContracts]
    );

    const urgentContracts = useMemo(
        () => expiringContracts.filter((contract) => contract.daysLeft <= 7),
        [expiringContracts]
    );

    const summaryCards = useMemo(() => ([
        {
            title: '전체 매물',
            value: (summary?.totalProperties ?? 0).toLocaleString(),
            description: '현재 조회 가능한 전체 매물 수',
            icon: <Building2 size={20} />,
        },
        {
            title: '관심 매물',
            value: (summary?.favoriteCount ?? 0).toLocaleString(),
            description: `전체의 ${formatPercent(summary?.favoriteCount ?? 0, summary?.totalProperties ?? 0)}`,
            icon: <Heart size={20} />,
        },
        {
            title: '관리 매물',
            value: (summary?.managedCount ?? 0).toLocaleString(),
            description: `전체의 ${formatPercent(summary?.managedCount ?? 0, summary?.totalProperties ?? 0)}`,
            icon: <Briefcase size={20} />,
        },
        {
            title: '오늘 일정',
            value: todaySchedules.length.toLocaleString(),
            description: nextSchedule ? `다음 일정 ${nextSchedule.isAllDay ? '하루 종일' : formatTime(nextSchedule.startTime)}` : '등록된 일정 없음',
            icon: <CalendarIcon size={20} />,
        },
    ]), [nextSchedule, summary?.favoriteCount, summary?.managedCount, summary?.totalProperties, todaySchedules.length]);

    const quickLinks = [
        {
            title: '매물 등록',
            description: '새 매물을 바로 입력합니다',
            path: '/real-estate/register',
            icon: <Building2 className="w-5 h-5 text-hud-accent-primary" />,
        },
        {
            title: '매물 목록',
            description: '등록된 매물 목록을 확인합니다',
            path: '/real-estate/uploaded-properties',
            icon: <ClipboardList className="w-5 h-5 text-hud-accent-info" />,
        },
        {
            title: '관심 매물',
            description: '저장한 관심 매물을 봅니다',
            path: '/real-estate/favorites',
            icon: <Heart className="w-5 h-5 text-hud-accent-danger" />,
        },
        {
            title: '관리 매물',
            description: '계약과 만료 일정을 확인합니다',
            path: '/real-estate/managed',
            icon: <Briefcase className="w-5 h-5 text-hud-accent-warning" />,
        },
        {
            title: '주소 통계',
            description: '지역 시세와 입지 흐름을 봅니다',
            path: '/real-estate/address-market-stats',
            icon: <BarChart3 className="w-5 h-5 text-hud-accent-success" />,
        },
        {
            title: '일정 관리',
            description: '캘린더와 할 일을 관리합니다',
            path: '/calendar',
            icon: <CalendarIcon className="w-5 h-5 text-hud-accent-info" />,
        },
    ];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-12 h-12 text-hud-accent-primary animate-spin" />
                    <p className="text-hud-text-muted">데이터를 불러오는 중...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-hud-text-primary">대시보드</h1>
                    <p className="mt-1 text-hud-text-muted">오늘 확인할 일정, 계약 만료, 최근 매물 현황을 한 화면에 정리했습니다.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="hidden text-right md:block">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-hud-text-muted">Today</p>
                        <p className="mt-1 text-sm text-hud-text-primary">
                            {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
                        </p>
                    </div>
                    <Button
                        variant="primary"
                        glow
                        size="sm"
                        leftIcon={<RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />}
                        onClick={() => fetchDashboardData(true)}
                        disabled={isRefreshing}
                    >
                        새로고침
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {summaryCards.map((card) => (
                    <SummaryMetricCard
                        key={card.title}
                        title={card.title}
                        value={card.value}
                        description={card.description}
                        icon={card.icon}
                    />
                ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.2fr)_360px] gap-6">
                <HudCard title="오늘 확인할 일" subtitle="가까운 일정과 계약 만료 항목을 먼저 보세요">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                        <div className="rounded-2xl border border-hud-border-secondary bg-hud-bg-primary p-5">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-semibold text-hud-text-primary">다음 일정</p>
                                    <p className="mt-1 text-xs text-hud-text-muted">오늘 가장 먼저 다가오는 일정입니다.</p>
                                </div>
                                <CalendarIcon size={18} className="text-hud-accent-info" />
                            </div>
                            {nextSchedule ? (
                                <div className="mt-5 space-y-3">
                                    <div>
                                        <p className="text-xl font-semibold text-hud-text-primary">{nextSchedule.title}</p>
                                        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-hud-text-secondary">
                                            <span className={`rounded-md px-2 py-1 text-xs font-medium ${getScheduleTypeColor(nextSchedule.type)}`}>
                                                {getScheduleTypeLabel(nextSchedule.type)}
                                            </span>
                                            <span>
                                                {nextSchedule.isAllDay ? '하루 종일' : `${formatTime(nextSchedule.startTime)}${nextSchedule.endTime ? ` ~ ${formatTime(nextSchedule.endTime)}` : ''}`}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="space-y-1 text-sm text-hud-text-muted">
                                        <p>{nextSchedule.location || '장소 미등록'}</p>
                                        {nextSchedule.description && <p className="line-clamp-2">{nextSchedule.description}</p>}
                                    </div>
                                </div>
                            ) : (
                                <div className="mt-5 rounded-xl border border-dashed border-hud-border-secondary px-4 py-6 text-sm text-hud-text-muted">
                                    오늘 등록된 일정이 없습니다.
                                </div>
                            )}
                        </div>

                        <div className="rounded-2xl border border-hud-border-secondary bg-hud-bg-primary p-5">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-semibold text-hud-text-primary">계약 만료 예정</p>
                                    <p className="mt-1 text-xs text-hud-text-muted">30일 안에 확인해야 하는 계약입니다.</p>
                                </div>
                                <TimerReset size={18} className="text-hud-accent-warning" />
                            </div>
                            <div className="mt-5 space-y-3">
                                {expiringContracts.length > 0 ? (
                                    expiringContracts.slice(0, 3).map((contract) => (
                                        <div key={contract.id} className="rounded-xl border border-hud-border-secondary bg-hud-bg-secondary px-3 py-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-medium text-hud-text-primary">{contract.articleName}</p>
                                                    <p className="mt-1 text-xs text-hud-text-muted">
                                                        {contract.contractType} · {new Date(contract.contractEndDate).toLocaleDateString('ko-KR')}
                                                    </p>
                                                </div>
                                                <span className={`rounded-md px-2 py-1 text-xs font-medium ${contract.daysLeft <= 7 ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'}`}>
                                                    {contract.daysLeft === 0 ? '오늘' : `D-${contract.daysLeft}`}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="rounded-xl border border-dashed border-hud-border-secondary px-4 py-6 text-sm text-hud-text-muted">
                                        가까운 만료 계약이 없습니다.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-hud-border-secondary bg-hud-bg-secondary px-4 py-4">
                        <div className="flex items-start gap-3">
                            <AlertCircle size={18} className="mt-0.5 text-hud-accent-warning" />
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-hud-text-primary">오늘 우선순위</p>
                                <p className="mt-1 text-sm text-hud-text-muted">
                                    {urgentContracts.length > 0
                                        ? `7일 안에 만료되는 계약이 ${urgentContracts.length}건 있습니다. 관리 매물 화면에서 먼저 연장 여부를 확인하는 편이 좋습니다.`
                                        : nextSchedule
                                          ? '긴급한 만료 계약은 많지 않습니다. 오늘 일정과 신규 매물 점검을 우선 진행하면 됩니다.'
                                          : '긴급한 계약 만료와 오늘 일정이 모두 적습니다. 신규 등록과 관심 매물 정리에 시간을 쓰기 좋습니다.'}
                                </p>
                            </div>
                        </div>
                    </div>
                </HudCard>

                <HudCard title="자주 쓰는 메뉴" subtitle="대시보드에서 바로 이동할 수 있습니다">
                    <div className="grid grid-cols-1 gap-3">
                        {quickLinks.map((item) => (
                            <button
                                key={item.path}
                                onClick={() => navigate(item.path)}
                                className="rounded-2xl border border-hud-border-secondary bg-hud-bg-primary p-4 text-left hover:bg-hud-bg-hover transition-hud"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="mb-3">{item.icon}</div>
                                        <p className="text-sm font-medium text-hud-text-primary">{item.title}</p>
                                        <p className="text-xs text-hud-text-muted mt-1">{item.description}</p>
                                    </div>
                                    <ArrowRight size={16} className="text-hud-text-muted flex-shrink-0" />
                                </div>
                            </button>
                        ))}
                    </div>
                </HudCard>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] gap-6">
                <div>
                    <PriceTrendChart title="최근 거래 금액 추이" period="6month" />
                </div>
                <TodayScheduleCard
                    schedules={todaySchedules}
                    onAdd={() => navigate('/calendar')}
                />
            </div>

            <RebStatsPanel />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <RecentListCard
                    title="최근 등록 매물"
                    subtitle="최근 10일 안에 새로 등록된 매물"
                    items={recentProperties.map(p => ({
                        id: p.articleNo,
                        name: p.articleName,
                        type: p.realEstateTypeName,
                        tradeType: p.tradeTypeName,
                        price: p.dealOrWarrantPrc,
                        monthlyRent: p.rentPrc,
                        area: p.area1,
                        date: p.createdAt,
                    }))}
                    emptyMessage="최근 등록된 매물이 없습니다"
                />
                <RecentListCard
                    title="최근 관리 매물"
                    subtitle="최근 10일 안에 추가된 관리 매물"
                    items={recentManaged.map(m => ({
                        id: m.id,
                        name: m.articleName,
                        type: m.propertyType || undefined,
                        tradeType: m.contractType,
                        price: m.totalPrice,
                        deposit: m.depositAmount,
                        monthlyRent: m.monthlyRent,
                        date: m.createdAt,
                    }))}
                    emptyMessage="최근 등록된 관리 매물이 없습니다"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <RecentListCard
                    title="최근 관심 매물"
                    subtitle="최근 10일 안에 추가된 관심 매물"
                    items={recentFavorites.map(f => ({
                        id: f.id,
                        name: f.articleName,
                        type: f.propertyType || undefined,
                        tradeType: f.tradeType || undefined,
                        price: f.price,
                        area: f.area,
                        date: f.createdAt,
                    }))}
                    emptyMessage="최근 등록된 관심 매물이 없습니다"
                />
                <RecentListCard
                    title="최근 계약 매물"
                    subtitle="최근 30일 안에 계약된 매물"
                    items={recentContracts.map(c => ({
                        id: c.id,
                        name: c.articleName,
                        tradeType: c.contractType,
                        price: c.totalPrice,
                        deposit: c.depositAmount,
                        monthlyRent: c.monthlyRent,
                        contractDate: c.contractDate,
                    }))}
                    emptyMessage="최근 계약된 매물이 없습니다"
                    showDate={true}
                />
                <HudCard title="최근 처리 흐름" subtitle="최근 입력된 데이터가 언제 들어왔는지 확인합니다">
                    <div className="space-y-3">
                        {[
                            ...recentProperties.slice(0, 2).map((item) => ({
                                id: `property-${item.articleNo}`,
                                label: '매물 등록',
                                name: item.articleName,
                                detail: `${item.realEstateTypeName} · ${item.tradeTypeName}`,
                                time: item.createdAt,
                            })),
                            ...recentFavorites.slice(0, 2).map((item) => ({
                                id: `favorite-${item.id}`,
                                label: '관심 매물',
                                name: item.articleName,
                                detail: item.tradeType || '유형 미지정',
                                time: item.createdAt,
                            })),
                            ...recentManaged.slice(0, 2).map((item) => ({
                                id: `managed-${item.id}`,
                                label: '관리 매물',
                                name: item.articleName,
                                detail: item.contractType,
                                time: item.createdAt,
                            })),
                        ]
                            .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
                            .slice(0, 6)
                            .map((item) => (
                                <div key={item.id} className="rounded-xl border border-hud-border-secondary bg-hud-bg-primary px-4 py-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="rounded-md bg-hud-bg-secondary px-2 py-0.5 text-[11px] font-medium text-hud-text-secondary">
                                                    {item.label}
                                                </span>
                                                <p className="truncate text-sm font-medium text-hud-text-primary">{item.name}</p>
                                            </div>
                                            <p className="mt-1 text-xs text-hud-text-muted">{item.detail}</p>
                                        </div>
                                        <span className="flex-shrink-0 text-xs text-hud-text-muted">{formatDateTime(item.time)}</span>
                                    </div>
                                </div>
                            ))}
                    </div>
                </HudCard>
            </div>
        </div>
    );
};

export default Dashboard;
