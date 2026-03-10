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
    TrendingUp,
    Loader2,
    RefreshCw,
    CheckCircle,
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

const daysUntil = (dateString: string): number => {
    const target = new Date(dateString);
    const now = new Date();
    target.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
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
                        일정 추가
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
                                    <h4 className="text-sm font-medium text-hud-text-primary">{schedule.title}</h4>
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
                        <p>오늘 예정된 일정이 없습니다</p>
                    </div>
                )}
            </div>
        </HudCard>
    );
};

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

    const activityFeed = useMemo(() => {
        return [
            ...recentProperties.map((item) => ({
                id: `property-${item.articleNo}`,
                title: item.articleName,
                detail: `${item.realEstateTypeName} · ${item.tradeTypeName}`,
                time: item.createdAt,
                tone: 'property',
            })),
            ...recentFavorites.map((item) => ({
                id: `favorite-${item.id}`,
                title: item.articleName,
                detail: `관심매물${item.tradeType ? ` · ${item.tradeType}` : ''}`,
                time: item.createdAt,
                tone: 'favorite',
            })),
            ...recentManaged.map((item) => ({
                id: `managed-${item.id}`,
                title: item.articleName,
                detail: `관리매물 · ${item.contractType}`,
                time: item.createdAt,
                tone: 'managed',
            })),
        ]
            .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
            .slice(0, 6);
    }, [recentProperties, recentFavorites, recentManaged]);

    const quickLinks = [
        {
            title: '매물 등록',
            description: '새 매물 추가',
            path: '/real-estate/register',
            icon: <Building2 className="w-5 h-5 text-hud-accent-primary" />,
        },
        {
            title: '매물 목록',
            description: '업로드 매물 관리',
            path: '/real-estate/uploaded-properties',
            icon: <ClipboardList className="w-5 h-5 text-hud-accent-info" />,
        },
        {
            title: '관심 매물',
            description: '찜한 매물 확인',
            path: '/real-estate/favorites',
            icon: <Heart className="w-5 h-5 text-hud-accent-danger" />,
        },
        {
            title: '관리 매물',
            description: '계약/임대 관리',
            path: '/real-estate/managed',
            icon: <Briefcase className="w-5 h-5 text-hud-accent-warning" />,
        },
        {
            title: '주소 통계',
            description: '입지 분석 보기',
            path: '/real-estate/address-market-stats',
            icon: <BarChart3 className="w-5 h-5 text-hud-accent-success" />,
        },
        {
            title: '일정 관리',
            description: '캘린더 열기',
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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-hud-text-primary">부동산 대시보드</h1>
                    <p className="text-hud-text-muted mt-1">오늘 해야 할 일과 최근 파이프라인 변화를 한 화면에서 확인합니다.</p>
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

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.25fr)_360px] gap-6">
                <HudCard className="overflow-hidden">
                    <div className="p-6 bg-gradient-to-br from-hud-accent-primary/14 via-hud-bg-secondary to-hud-bg-primary">
                        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
                            <div className="space-y-3">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-hud-accent-primary/30 bg-hud-accent-primary/10 text-xs text-hud-accent-primary">
                                    <Sparkles size={14} />
                                    오늘의 브리핑
                                </div>
                                <div>
                                    <p className="text-3xl font-bold text-hud-text-primary">
                                        총 {summary?.totalProperties?.toLocaleString() || '0'}건의 매물이 운영 중입니다.
                                    </p>
                                    <p className="text-sm text-hud-text-muted mt-2">
                                        관심매물 {summary?.favoriteCount?.toLocaleString() || '0'}건, 관리매물 {summary?.managedCount?.toLocaleString() || '0'}건을 기준으로 오늘 우선순위를 정리했습니다.
                                    </p>
                                </div>
                            </div>
                            <div className="min-w-[240px] rounded-2xl border border-hud-border-secondary bg-hud-bg-primary/70 p-4">
                                <p className="text-xs text-hud-text-muted">가장 가까운 일정</p>
                                {nextSchedule ? (
                                    <>
                                        <p className="text-lg font-semibold text-hud-text-primary mt-2">{nextSchedule.title}</p>
                                        <p className="text-sm text-hud-text-muted mt-1">
                                            {nextSchedule.isAllDay ? '하루 종일' : `${formatTime(nextSchedule.startTime)}${nextSchedule.endTime ? ` ~ ${formatTime(nextSchedule.endTime)}` : ''}`}
                                        </p>
                                        <p className="text-xs text-hud-text-muted mt-2">
                                            {nextSchedule.location || '장소 미등록'}
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-sm text-hud-text-muted mt-2">오늘 등록된 일정이 없습니다.</p>
                                )}
                                <Button variant="ghost" size="sm" className="mt-4" onClick={() => navigate('/calendar')}>
                                    캘린더 열기
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
                            <div className="rounded-2xl border border-hud-border-secondary bg-hud-bg-primary/65 p-4">
                                <p className="text-xs text-hud-text-muted">전체 매물</p>
                                <p className="text-2xl font-bold text-hud-text-primary mt-2">{summary?.totalProperties?.toLocaleString() || '0'}</p>
                                <p className="text-xs text-hud-text-muted mt-2">현재 관리 가능한 풀</p>
                            </div>
                            <div className="rounded-2xl border border-hud-border-secondary bg-hud-bg-primary/65 p-4">
                                <p className="text-xs text-hud-text-muted">관심 전환율</p>
                                <p className="text-2xl font-bold text-hud-text-primary mt-2">
                                    {summary?.totalProperties ? `${((summary.favoriteCount / summary.totalProperties) * 100).toFixed(1)}%` : '0%'}
                                </p>
                                <p className="text-xs text-hud-text-muted mt-2">관심매물 비중</p>
                            </div>
                            <div className="rounded-2xl border border-hud-border-secondary bg-hud-bg-primary/65 p-4">
                                <p className="text-xs text-hud-text-muted">관리 전환율</p>
                                <p className="text-2xl font-bold text-hud-text-primary mt-2">
                                    {summary?.totalProperties ? `${((summary.managedCount / summary.totalProperties) * 100).toFixed(1)}%` : '0%'}
                                </p>
                                <p className="text-xs text-hud-text-muted mt-2">관리매물 비중</p>
                            </div>
                            <div className="rounded-2xl border border-hud-border-secondary bg-hud-bg-primary/65 p-4">
                                <p className="text-xs text-hud-text-muted">오늘 일정</p>
                                <p className="text-2xl font-bold text-hud-text-primary mt-2">{todaySchedules.length.toLocaleString()}</p>
                                <p className="text-xs text-hud-text-muted mt-2">일정 우선순위 확인</p>
                            </div>
                        </div>
                    </div>
                </HudCard>

                <HudCard title="빠른 실행" subtitle="자주 쓰는 메뉴로 바로 이동">
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-3">
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <PriceTrendChart title="최근 거래 금액 추이" period="6month" />
                </div>
                <div className="space-y-6">
                    <TodayScheduleCard
                        schedules={todaySchedules}
                        onAdd={() => navigate('/calendar')}
                    />

                    <HudCard title="계약 리스크" subtitle="30일 이내 만료 예정 계약">
                        <div className="space-y-3">
                            {expiringContracts.length > 0 ? (
                                expiringContracts.map((contract) => (
                                    <div key={contract.id} className="rounded-xl border border-hud-border-secondary bg-hud-bg-primary p-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-hud-text-primary truncate">{contract.articleName}</p>
                                                <p className="text-xs text-hud-text-muted mt-1">
                                                    {contract.contractType} · 만료 {formatDate(contract.contractEndDate)}
                                                </p>
                                            </div>
                                            <div className={`px-2 py-1 rounded-md text-xs font-medium ${contract.daysLeft <= 7 ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'}`}>
                                                {contract.daysLeft === 0 ? '오늘 만료' : `${contract.daysLeft}일 남음`}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="rounded-xl border border-dashed border-hud-border-secondary p-4 text-sm text-hud-text-muted">
                                    임박한 계약이 없습니다.
                                </div>
                            )}
                        </div>
                    </HudCard>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] gap-6">
                <HudCard title="최근 변화" subtitle="등록·관심·관리 흐름을 시간순으로 요약">
                    <div className="space-y-3">
                        {activityFeed.length > 0 ? (
                            activityFeed.map((item) => (
                                <div key={item.id} className="flex items-start gap-3 rounded-xl border border-hud-border-secondary bg-hud-bg-primary p-3">
                                    <div className={`mt-1 w-2.5 h-2.5 rounded-full ${
                                        item.tone === 'property'
                                            ? 'bg-hud-accent-primary'
                                            : item.tone === 'favorite'
                                              ? 'bg-hud-accent-danger'
                                              : 'bg-hud-accent-warning'
                                    }`} />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-hud-text-primary truncate">{item.title}</p>
                                        <p className="text-xs text-hud-text-muted mt-1">{item.detail}</p>
                                    </div>
                                    <p className="text-xs text-hud-text-muted flex-shrink-0">{formatDateTime(item.time)}</p>
                                </div>
                            ))
                        ) : (
                            <div className="rounded-xl border border-dashed border-hud-border-secondary p-4 text-sm text-hud-text-muted">
                                최근 변화 데이터가 없습니다.
                            </div>
                        )}
                    </div>
                </HudCard>

                <RecentListCard
                    title="최근 등록 매물"
                    subtitle="최근 10일 동안 등록된 매물"
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
            </div>

            <RebStatsPanel />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <RecentListCard
                    title="최근 관심 매물"
                    subtitle="최근 10일 동안 등록된 관심 매물"
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
                    title="최근 관리 매물"
                    subtitle="최근 10일 동안 등록된 관리 매물"
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
                    title="최근 계약 매물"
                    subtitle="최근 30일 동안 계약된 매물"
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
                <HudCard title="운영 체크" subtitle="실시간으로 보기 좋은 핵심 신호">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-hud-border-secondary bg-hud-bg-primary p-4">
                            <div className="flex items-center gap-2 text-hud-accent-warning">
                                <TimerReset size={16} />
                                <span className="text-xs font-medium">계약 만료 임박</span>
                            </div>
                            <p className="text-2xl font-bold text-hud-text-primary mt-3">{expiringContracts.length}</p>
                            <p className="text-xs text-hud-text-muted mt-1">30일 이내 관리 필요</p>
                        </div>
                        <div className="rounded-2xl border border-hud-border-secondary bg-hud-bg-primary p-4">
                            <div className="flex items-center gap-2 text-hud-accent-success">
                                <CheckCircle size={16} />
                                <span className="text-xs font-medium">오늘 처리 가능</span>
                            </div>
                            <p className="text-2xl font-bold text-hud-text-primary mt-3">
                                {(todaySchedules.length + expiringContracts.length).toLocaleString()}
                            </p>
                            <p className="text-xs text-hud-text-muted mt-1">일정 + 만료 점검 합계</p>
                        </div>
                        <div className="rounded-2xl border border-hud-border-secondary bg-hud-bg-primary p-4 sm:col-span-2">
                            <div className="flex items-center gap-2 text-hud-accent-info">
                                <AlertCircle size={16} />
                                <span className="text-xs font-medium">운영 메모</span>
                            </div>
                            <p className="text-sm text-hud-text-primary mt-3">
                                {expiringContracts.length > 0
                                    ? `이번 달 안에 만료될 계약이 ${expiringContracts.length}건 있습니다. 관리매물 페이지에서 계약 연장 여부를 먼저 확인하는 편이 좋습니다.`
                                    : '당장 위험 신호는 크지 않습니다. 신규 매물 등록과 관심매물 전환 관리에 시간을 배분하기 좋습니다.'}
                            </p>
                        </div>
                    </div>
                </HudCard>
            </div>
        </div>
    );
};

export default Dashboard;
