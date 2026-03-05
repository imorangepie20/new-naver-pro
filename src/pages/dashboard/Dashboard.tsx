// ============================================
// 부동산 분석 대시보드 (재작성)
// 매물관리.md 요구사항 기반 구현
// ============================================

import { useEffect, useState } from 'react';
import {
    Building2,
    Home,
    Briefcase,
    Calendar as CalendarIcon,
    Clock,
    MapPin,
    TrendingUp,
    Loader2,
    RefreshCw,
    FileText,
    CheckCircle,
    ArrowRight,
    AlertCircle,
    Sparkles,
} from 'lucide-react';
import HudCard from '../../components/common/HudCard';
import StatCard from '../../components/common/StatCard';
import Button from '../../components/common/Button';
import PriceTrendChart from '../../components/real-estate/PriceTrendChart';

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

const getScheduleTypeColor = (type: string): string => {
    switch (type) {
        case 'meeting':
            return 'bg-hud-accent-primary/10 border-hud-accent-primary text-hud-accent-primary';
        case 'task':
            return 'bg-hud-accent-warning/10 border-hud-accent-warning text-hud-accent-warning';
        case 'event':
            return 'bg-hud-accent-info/10 border-hud-accent-info text-hud-accent-info';
        case 'break':
            return 'bg-hud-accent-success/10 border-hud-accent-success text-hud-accent-success';
        default:
            return 'bg-hud-bg-hover border-hud-border-secondary text-hud-text-muted';
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
                    <Button variant="ghost" size="sm" leftIcon={<CalendarIcon size={14} />}>
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
            const headers = { 'x-user-id': 'temp-user' };

            const [
                summaryRes,
                propertiesRes,
                favoritesRes,
                managedRes,
                contractsRes,
                schedulesRes,
            ] = await Promise.all([
                fetch(`${API_BASE}/api/dashboard/summary`),
                fetch(`${API_BASE}/api/dashboard/recent-properties?days=10`),
                fetch(`${API_BASE}/api/dashboard/recent-favorites?days=10`, { headers }),
                fetch(`${API_BASE}/api/dashboard/recent-managed?days=10`, { headers }),
                fetch(`${API_BASE}/api/dashboard/recent-contracts?days=30`, { headers }),
                fetch(`${API_BASE}/api/schedules/today`, { headers }),
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
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-hud-text-primary">부동산 대시보드</h1>
                    <p className="text-hud-text-muted mt-1">매물 현황 및 최신 정보 요약</p>
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

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    title="총 매물수"
                    value={summary?.totalProperties?.toLocaleString() || '0'}
                    icon={<Building2 size={24} />}
                    variant="primary"
                />
                <StatCard
                    title="관심 매물"
                    value={summary?.favoriteCount?.toLocaleString() || '0'}
                    icon={<Home size={24} />}
                    variant="secondary"
                />
                <StatCard
                    title="관리 매물"
                    value={summary?.managedCount?.toLocaleString() || '0'}
                    icon={<Briefcase size={24} />}
                    variant="warning"
                />
            </div>

            {/* Recent Lists Row - 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
            </div>

            {/* Today's Schedule Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                    <TodayScheduleCard
                        schedules={todaySchedules}
                    />
                </div>
                <div className="lg:col-span-2">
                    <PriceTrendChart title="최근 거래 금액 추이" period="6month" />
                </div>
            </div>

            {/* Recent Lists Row - 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
            </div>

            {/* Quick Links */}
            <HudCard title="빠른 링크" subtitle="자주 사용하는 기능으로 바로 이동">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <button className="p-4 bg-hud-bg-primary rounded-lg hover:bg-hud-bg-hover transition-hud text-left">
                        <Building2 className="w-6 h-6 text-hud-accent-primary mb-2" />
                        <p className="text-sm font-medium text-hud-text-primary">매물 등록</p>
                        <p className="text-xs text-hud-text-muted">새 매물 추가</p>
                    </button>
                    <button className="p-4 bg-hud-bg-primary rounded-lg hover:bg-hud-bg-hover transition-hud text-left">
                        <Home className="w-6 h-6 text-hud-accent-secondary mb-2" />
                        <p className="text-sm font-medium text-hud-text-primary">관심 매물</p>
                        <p className="text-xs text-hud-text-muted">찜한 매물 관리</p>
                    </button>
                    <button className="p-4 bg-hud-bg-primary rounded-lg hover:bg-hud-bg-hover transition-hud text-left">
                        <Briefcase className="w-6 h-6 text-hud-accent-warning mb-2" />
                        <p className="text-sm font-medium text-hud-text-primary">관리 매물</p>
                        <p className="text-xs text-hud-text-muted">계약 관리</p>
                    </button>
                    <button className="p-4 bg-hud-bg-primary rounded-lg hover:bg-hud-bg-hover transition-hud text-left">
                        <CalendarIcon className="w-6 h-6 text-hud-accent-info mb-2" />
                        <p className="text-sm font-medium text-hud-text-primary">일정 관리</p>
                        <p className="text-xs text-hud-text-muted">캘린더 보기</p>
                    </button>
                </div>
            </HudCard>
        </div>
    );
};

export default Dashboard;
