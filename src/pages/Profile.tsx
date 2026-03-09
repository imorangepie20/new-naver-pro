import { useEffect, useState } from 'react'
import {
    User,
    Mail,
    Phone,
    MapPin,
    Briefcase,
    Edit,
    Loader2,
    RefreshCw,
} from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import HudCard from '../components/common/HudCard'
import Button from '../components/common/Button'
import { useProfileStore } from '../stores/profileStore'

const projects = [
    { name: '부동산 매물 관리', status: 'Active', progress: 100 },
    { name: '스마트 캘린더', status: 'Completed', progress: 100 },
    { name: '대시보드', status: 'Active', progress: 85 },
]

const Profile = () => {
    const navigate = useNavigate()
    const location = useLocation()
    const { profile, isLoading, fetchProfile } = useProfileStore()
    const [isRefreshing, setIsRefreshing] = useState(false)
    const fromRegister = new URLSearchParams(location.search).get('from') === 'register'

    // 페이지가 보일 때마다 데이터 갱신
    useEffect(() => {
        fetchProfile()
    }, [location.key]) // route 변경 시 갱신

    const handleRefresh = async () => {
        setIsRefreshing(true)
        await fetchProfile()
        setIsRefreshing(false)
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-hud-accent-primary" />
            </div>
        )
    }

    // 기본값 설정 (프로필 데이터가 없을 경우)
    const displayName = profile?.name || '사용자'
    const displayEmail = profile?.email || 'user@example.com'
    const displayPhone = profile?.phone || ''
    const displayAddress = profile?.address ? (profile?.detailAddress ? `${profile.address} ${profile.detailAddress}` : profile.address) : ''
    const displayCompany = profile?.companyName || '중개업소'

    return (
        <div className="space-y-6 animate-fade-in">
            {fromRegister && (
                <HudCard>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <p className="text-sm text-hud-text-secondary">
                            회원가입이 완료되었습니다. 프로필 편집에서 연락처, 사무실 주소, 사업자 정보를 입력해주세요.
                        </p>
                        <Button
                            size="sm"
                            variant="primary"
                            onClick={() => navigate('/settings')}
                        >
                            프로필 편집으로 이동
                        </Button>
                    </div>
                </HudCard>
            )}

            {/* Profile Header */}
            <HudCard>
                <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                    {/* Avatar */}
                    <div className="relative">
                        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-hud-accent-primary via-hud-accent-info to-hud-accent-secondary p-1">
                            <div className="w-full h-full rounded-full bg-hud-bg-secondary flex items-center justify-center">
                                <User size={48} className="text-hud-accent-primary" />
                            </div>
                        </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1">
                        <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-hud-text-primary">{displayName}</h1>
                                <p className="text-hud-text-muted mt-1">{displayCompany}</p>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    leftIcon={<RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />}
                                    onClick={handleRefresh}
                                    disabled={isRefreshing}
                                >
                                    새로고침
                                </Button>
                                <Button
                                    variant="outline"
                                    leftIcon={<Edit size={16} />}
                                    onClick={() => navigate('/settings')}
                                >
                                    프로필 편집
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                            {displayEmail && (
                                <div className="flex items-center gap-2 text-hud-text-secondary">
                                    <Mail size={16} className="text-hud-accent-primary" />
                                    <span className="text-sm">{displayEmail}</span>
                                </div>
                            )}
                            {displayPhone && (
                                <div className="flex items-center gap-2 text-hud-text-secondary">
                                    <Phone size={16} className="text-hud-accent-primary" />
                                    <span className="text-sm">{displayPhone}</span>
                                </div>
                            )}
                            {displayAddress && (
                                <div className="flex items-center gap-2 text-hud-text-secondary">
                                    <MapPin size={16} className="text-hud-accent-primary" />
                                    <span className="text-sm">{displayAddress}</span>
                                </div>
                            )}
                            {profile?.businessNumber && (
                                <div className="flex items-center gap-2 text-hud-text-secondary">
                                    <Briefcase size={16} className="text-hud-accent-primary" />
                                    <span className="text-sm">사업자번호: {profile.businessNumber}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-hud-border-secondary">
                    {[
                        { label: '등록 매물', value: projects.length.toString() },
                        { label: '관리 매물', value: '12' },
                        { label: '관심 매물', value: '8' },
                        { label: '계약 완료', value: '45' },
                    ].map((stat) => (
                        <div key={stat.label} className="text-center">
                            <p className="text-2xl font-bold text-hud-accent-primary font-mono">{stat.value}</p>
                            <p className="text-sm text-hud-text-muted mt-1">{stat.label}</p>
                        </div>
                    ))}
                </div>
            </HudCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Projects */}
                <HudCard title="활성 프로젝트" subtitle="현재 진행 중인 작업" noPadding>
                    <div className="divide-y divide-hud-border-secondary">
                        {projects.map((project) => (
                            <div key={project.name} className="px-5 py-4 hover:bg-hud-bg-hover transition-hud">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-hud-text-primary">{project.name}</span>
                                    <span className={`text-xs px-2 py-1 rounded ${project.status === 'Completed' ? 'bg-hud-accent-success/10 text-hud-accent-success' :
                                            project.status === 'Active' ? 'bg-hud-accent-info/10 text-hud-accent-info' :
                                                'bg-hud-bg-hover text-hud-text-muted'
                                        }`}>
                                        {project.status}
                                    </span>
                                </div>
                                <div className="h-1.5 bg-hud-bg-primary rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${project.status === 'Completed' ? 'bg-hud-accent-success' :
                                                project.status === 'Active' ? 'bg-hud-accent-info' :
                                                    'bg-hud-text-muted'
                                            }`}
                                        style={{ width: `${project.progress}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </HudCard>

                {/* Activity */}
                <HudCard title="최근 활동" subtitle="최근 업무 내역" noPadding>
                    <div className="divide-y divide-hud-border-secondary">
                        {[
                            { action: '새로운 매물이 등록되었습니다', time: '2시간 전' },
                            { action: '계약이 완료되었습니다', time: '5시간 전' },
                            { action: '문의사항이 등록되었습니다', time: '1일 전' },
                            { action: '매물 정보가 수정되었습니다', time: '2일 전' },
                        ].map((item, i) => (
                            <div key={i} className="px-5 py-4 hover:bg-hud-bg-hover transition-hud">
                                <p className="text-sm text-hud-text-primary">{item.action}</p>
                                <p className="text-xs text-hud-text-muted mt-1">{item.time}</p>
                            </div>
                        ))}
                    </div>
                </HudCard>
            </div>
        </div>
    )
}

export default Profile
