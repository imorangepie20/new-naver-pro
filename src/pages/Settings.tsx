import { useState, useEffect } from 'react'
import {
    User,
    Bell,
    Lock,
    Palette,
    Globe,
    Shield,
    CreditCard,
    Mail,
    Smartphone,
    Moon,
    Sun,
    Monitor,
    Coffee,
    Check,
    Sparkles,
    Trash2,
    Database,
    Calendar,
    AlertTriangle,
    Loader2,
    MapPin,
    Building2,
    Save,
    X,
} from 'lucide-react'
import HudCard from '../components/common/HudCard'
import Button from '../components/common/Button'
import { useThemeStore, AccentColor, ThemeMode, FontSize, BorderRadius, ACCENT_COLORS } from '../stores/themeStore'
import { API_BASE } from '../lib/api'

const settingsSections = [
    { id: 'profile', label: '프로필', icon: <User size={18} /> },
    { id: 'notifications', label: '알림', icon: <Bell size={18} /> },
    { id: 'security', label: '보안', icon: <Lock size={18} /> },
    { id: 'appearance', label: '외관', icon: <Palette size={18} /> },
    { id: 'data', label: '데이터 관리', icon: <Database size={18} /> },
    { id: 'language', label: '언어', icon: <Globe size={18} /> },
    { id: 'privacy', label: '개인정보', icon: <Shield size={18} /> },
    { id: 'billing', label: '결제', icon: <CreditCard size={18} /> },
]

const themeModes: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { value: 'light', label: '라이트', icon: <Sun size={16} /> },
    { value: 'dark', label: '다크', icon: <Moon size={16} /> },
    { value: 'smart', label: '스마트', icon: <Coffee size={16} /> },
    { value: 'system', label: '시스템', icon: <Monitor size={16} /> },
]

const fontSizes: { value: FontSize; label: string }[] = [
    { value: 'small', label: '작게' },
    { value: 'medium', label: '보통' },
    { value: 'large', label: '크게' },
]

const borderRadii: { value: BorderRadius; label: string; preview: string }[] = [
    { value: 'sharp', label: '없음', preview: 'rounded-none' },
    { value: 'medium', label: '보통', preview: 'rounded-lg' },
    { value: 'rounded', label: '둥글게', preview: 'rounded-2xl' },
]

// ============================================
// 프로필 섹션 컴포넌트
// ============================================

interface ProfileData {
    name: string
    email: string
    phone: string
    zipCode: string
    address: string
    detailAddress: string
    companyName: string
    businessNumber: string
}

const ProfileSection = () => {
    const [profile, setProfile] = useState<ProfileData>({
        name: '',
        email: '',
        phone: '',
        zipCode: '',
        address: '',
        detailAddress: '',
        companyName: '',
        businessNumber: '',
    })
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [showDaumPostcode, setShowDaumPostcode] = useState(false)

    // 프로필 로드
    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const headers = { 'x-user-id': 'temp-user' }
                const res = await fetch(`${API_BASE}/api/user/profile`, { headers })

                if (res.ok) {
                    const data = await res.json()
                    setProfile({
                        name: data.name || '',
                        email: data.email || '',
                        phone: data.phone || '',
                        zipCode: data.zipCode || '',
                        address: data.address || '',
                        detailAddress: data.detailAddress || '',
                        companyName: data.companyName || '',
                        businessNumber: data.businessNumber || '',
                    })
                }
            } catch (error) {
                console.error('프로필 로드 실패:', error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchProfile()
    }, [])

    // 프로필 저장
    const handleSave = async () => {
        setIsSaving(true)
        setSaveMessage(null)

        try {
            const headers = {
                'x-user-id': 'temp-user',
                'Content-Type': 'application/json',
            }
            const res = await fetch(`${API_BASE}/api/user/profile`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(profile),
            })

            if (res.ok) {
                setSaveMessage({ type: 'success', text: '프로필이 저장되었습니다.' })
                setTimeout(() => setSaveMessage(null), 3000)
            } else {
                setSaveMessage({ type: 'error', text: '저장에 실패했습니다. 다시 시도해주세요.' })
            }
        } catch (error) {
            console.error('프로필 저장 실패:', error)
            setSaveMessage({ type: 'error', text: '저장에 실패했습니다. 다시 시도해주세요.' })
        } finally {
            setIsSaving(false)
        }
    }

    // 다음 우편번호 검색 완료 핸들러
    const handlePostcodeComplete = (data: any) => {
        setProfile(prev => ({
            ...prev,
            zipCode: data.zonecode,
            address: data.address,
        }))
        setShowDaumPostcode(false)
    }

    // 다음 우편번호 스크립트 로드 및 초기화
    useEffect(() => {
        const loadDaumPostcode = () => {
            const script = document.createElement('script')
            script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
            script.async = true
            document.body.appendChild(script)
        }

        // 스크립트가 없으면 로드
        if (!document.querySelector('script[src*="postcode.v2.js"]')) {
            loadDaumPostcode()
        }

        // 모달이 열릴 때 우편번호 검색 실행
        if (showDaumPostcode && typeof window !== 'undefined') {
            const daum = (window as any).daum
            if (daum && daum.Postcode) {
                new daum.Postcode({
                    oncomplete: handlePostcodeComplete,
                    width: '100%',
                    height: '100%',
                }).embed(document.getElementById('daum-postcode')!)
            }
        }
    }, [showDaumPostcode])

    if (isLoading) {
        return (
            <HudCard title="프로필 설정" subtitle="중개사 정보를 관리하세요">
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-hud-accent-primary" />
                </div>
            </HudCard>
        )
    }

    return (
        <div className="space-y-6">
            {/* 다음 우편번호 검색 모달 */}
            {showDaumPostcode && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-hud-bg-secondary rounded-xl border border-hud-border-primary w-full max-w-lg overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-hud-border-secondary">
                            <h3 className="text-lg font-semibold text-hud-text-primary">우편번호 검색</h3>
                            <button
                                onClick={() => setShowDaumPostcode(false)}
                                className="p-1 rounded-lg hover:bg-hud-bg-hover text-hud-text-muted"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div id="daum-postcode" className="h-[500px]" />
                    </div>
                </div>
            )}

            {/* 기본 정보 카드 */}
            <HudCard title="기본 정보" subtitle="이름과 연락처 정보를 입력하세요">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-hud-text-secondary mb-2">
                            <User size={16} />
                            이름 *
                        </label>
                        <input
                            type="text"
                            value={profile.name}
                            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                            placeholder="홍길동"
                            className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-primary rounded-lg text-hud-text-primary placeholder:text-hud-text-muted focus:outline-none focus:border-hud-accent-primary focus:ring-1 focus:ring-hud-accent-primary"
                        />
                    </div>
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-hud-text-secondary mb-2">
                            <Mail size={16} />
                            이메일 *
                        </label>
                        <input
                            type="email"
                            value={profile.email}
                            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                            placeholder="example@email.com"
                            className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-primary rounded-lg text-hud-text-primary placeholder:text-hud-text-muted focus:outline-none focus:border-hud-accent-primary focus:ring-1 focus:ring-hud-accent-primary"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-hud-text-secondary mb-2">
                            <Smartphone size={16} />
                            휴대폰 *
                        </label>
                        <input
                            type="tel"
                            value={profile.phone}
                            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                            placeholder="010-1234-5678"
                            className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-primary rounded-lg text-hud-text-primary placeholder:text-hud-text-muted focus:outline-none focus:border-hud-accent-primary focus:ring-1 focus:ring-hud-accent-primary"
                        />
                    </div>
                </div>
            </HudCard>

            {/* 중개업소 정보 카드 */}
            <HudCard title="중개업소 정보" subtitle="중개업소 주소와 상호 정보를 입력하세요">
                <div className="space-y-4">
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-hud-text-secondary mb-2">
                            <Building2 size={16} />
                            상호 (중개업소명) *
                        </label>
                        <input
                            type="text"
                            value={profile.companyName}
                            onChange={(e) => setProfile({ ...profile, companyName: e.target.value })}
                            placeholder="OO부동산"
                            className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-primary rounded-lg text-hud-text-primary placeholder:text-hud-text-muted focus:outline-none focus:border-hud-accent-primary focus:ring-1 focus:ring-hud-accent-primary"
                        />
                    </div>
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-hud-text-secondary mb-2">
                            <Shield size={16} />
                            사업자등록번호
                        </label>
                        <input
                            type="text"
                            value={profile.businessNumber}
                            onChange={(e) => setProfile({ ...profile, businessNumber: e.target.value })}
                            placeholder="123-45-67890"
                            className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-primary rounded-lg text-hud-text-primary placeholder:text-hud-text-muted focus:outline-none focus:border-hud-accent-primary focus:ring-1 focus:ring-hud-accent-primary"
                        />
                    </div>

                    {/* 주소 검색 */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-1">
                            <label className="flex items-center gap-2 text-sm font-medium text-hud-text-secondary mb-2">
                                <MapPin size={16} />
                                우편번호 *
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={profile.zipCode}
                                    readOnly
                                    placeholder="우편번호"
                                    className="flex-1 px-4 py-2.5 bg-hud-bg-primary border border-hud-border-primary rounded-lg text-hud-text-primary placeholder:text-hud-text-muted"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowDaumPostcode(true)}
                                    className="px-4 py-2.5 bg-hud-accent-primary/20 hover:bg-hud-accent-primary/30 text-hud-accent-primary border border-hud-accent-primary/50 rounded-lg transition-hud text-sm font-medium whitespace-nowrap"
                                >
                                    주소 검색
                                </button>
                            </div>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-hud-text-secondary mb-2">
                                주소 *
                            </label>
                            <input
                                type="text"
                                value={profile.address}
                                readOnly
                                placeholder="주소 검색 후 자동 입력"
                                className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-primary rounded-lg text-hud-text-primary placeholder:text-hud-text-muted"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-hud-text-secondary mb-2">
                            상세 주소
                        </label>
                        <input
                            type="text"
                            value={profile.detailAddress}
                            onChange={(e) => setProfile({ ...profile, detailAddress: e.target.value })}
                            placeholder="동/호수 등 상세 주소 입력"
                            className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-primary rounded-lg text-hud-text-primary placeholder:text-hud-text-muted focus:outline-none focus:border-hud-accent-primary focus:ring-1 focus:ring-hud-accent-primary"
                        />
                    </div>
                </div>
            </HudCard>

            {/* 저장 버튼 및 메시지 */}
            <div className="flex items-center justify-between">
                {saveMessage && (
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                        saveMessage.type === 'success'
                            ? 'bg-hud-accent-success/10 text-hud-accent-success'
                            : 'bg-hud-accent-danger/10 text-hud-accent-danger'
                    }`}>
                        {saveMessage.type === 'success' ? (
                            <Check size={16} />
                        ) : (
                            <AlertTriangle size={16} />
                        )}
                        <span className="text-sm">{saveMessage.text}</span>
                    </div>
                )}
                <div className="ml-auto">
                    <Button
                        variant="primary"
                        glow
                        onClick={handleSave}
                        disabled={isSaving}
                        leftIcon={isSaving ? undefined : <Save size={18} />}
                    >
                        {isSaving ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                저장 중...
                            </>
                        ) : (
                            '프로필 저장'
                        )}
                    </Button>
                </div>
            </div>
        </div>
    )
}

// ============================================
// 데이터 관리 섹션 컴포넌트
// ============================================
const DataManagementSection = () => {
    const [isDeletingProfile, setIsDeletingProfile] = useState(false);
    const [isDeletingCalendar, setIsDeletingCalendar] = useState(false);
    const [deleteResult, setDeleteResult] = useState<{ type: 'profile' | 'calendar'; success: boolean } | null>(null);

    // 프로필 삭제 핸들러
    const handleDeleteProfile = async () => {
        if (!confirm('정말로 프로필을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return;

        setIsDeletingProfile(true);
        setDeleteResult(null);

        try {
            const response = await fetch(`${API_BASE}/api/user/profile`, {
                method: 'DELETE',
                headers: { 'x-user-id': 'temp-user' },
            });

            if (response.ok) {
                setDeleteResult({ type: 'profile', success: true });
                setTimeout(() => {
                    window.location.href = '/login';
                }, 2000);
            } else {
                setDeleteResult({ type: 'profile', success: false });
            }
        } catch (error) {
            console.error('프로필 삭제 실패:', error);
            setDeleteResult({ type: 'profile', success: false });
        } finally {
            setIsDeletingProfile(false);
        }
    };

    // 캘린더 삭제 핸들러
    const handleDeleteCalendar = async () => {
        if (!confirm('정말로 캘린더 데이터를 모두 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return;

        setIsDeletingCalendar(true);
        setDeleteResult(null);

        try {
            const response = await fetch(`${API_BASE}/api/user/calendar`, {
                method: 'DELETE',
                headers: { 'x-user-id': 'temp-user' },
            });

            if (response.ok) {
                setDeleteResult({ type: 'calendar', success: true });
            } else {
                setDeleteResult({ type: 'calendar', success: false });
            }
        } catch (error) {
            console.error('캘린더 삭제 실패:', error);
            setDeleteResult({ type: 'calendar', success: false });
        } finally {
            setIsDeletingCalendar(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* 경고 안내 */}
            <HudCard className="border-l-4 border-l-hud-accent-danger">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-hud-accent-danger/10 rounded-xl">
                        <AlertTriangle className="w-6 h-6 text-hud-accent-danger" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-hud-text-primary mb-1">데이터 삭제 경고</h3>
                        <p className="text-sm text-hud-text-muted">
                            삭제된 데이터는 복구할 수 없습니다. 신중하게 진행해 주세요.
                        </p>
                    </div>
                </div>
            </HudCard>

            {/* 프로필 삭제 */}
            <HudCard title="프로필 삭제" subtitle="계정과 관련된 모든 데이터를 삭제합니다">
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-5 bg-hud-bg-primary rounded-xl border border-hud-border-secondary">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-hud-accent-danger/10 rounded-xl">
                                <User className="w-6 h-6 text-hud-accent-danger" />
                            </div>
                            <div>
                                <h4 className="text-base font-semibold text-hud-text-primary">프로필 삭제</h4>
                                <p className="text-sm text-hud-text-muted mt-1">
                                    계정 정보, 개인 설정, 모든 개인 데이터가 영구적으로 삭제됩니다.
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="danger"
                            size="sm"
                            onClick={handleDeleteProfile}
                            disabled={isDeletingProfile}
                            className="flex items-center gap-2"
                        >
                            {isDeletingProfile ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    삭제 중...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="w-4 h-4" />
                                    프로필 삭제
                                </>
                            )}
                        </Button>
                    </div>

                    {/* 삭제 결과 메시지 */}
                    {deleteResult?.type === 'profile' && (
                        <div className={`p-4 rounded-xl ${deleteResult.success
                            ? 'bg-hud-accent-success/10 border border-hud-accent-success/30'
                            : 'bg-hud-accent-danger/10 border border-hud-accent-danger/30'
                            }`}>
                            <p className={`text-sm ${deleteResult.success ? 'text-hud-accent-success' : 'text-hud-accent-danger'}`}>
                                {deleteResult.success
                                    ? '프로필이 삭제되었습니다. 로그아웃됩니다...'
                                    : '프로필 삭제에 실패했습니다. 다시 시도해 주세요.'}
                            </p>
                        </div>
                    )}
                </div>
            </HudCard>

            {/* 캘린더 데이터 삭제 */}
            <HudCard title="캘린더 데이터 삭제" subtitle="모든 일정과 이벤트 데이터를 삭제합니다">
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-5 bg-hud-bg-primary rounded-xl border border-hud-border-secondary">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-hud-accent-warning/10 rounded-xl">
                                <Calendar className="w-6 h-6 text-hud-accent-warning" />
                            </div>
                            <div>
                                <h4 className="text-base font-semibold text-hud-text-primary">캘린더 데이터 삭제</h4>
                                <p className="text-sm text-hud-text-muted mt-1">
                                    모든 일정, 이벤트, 반복 설정 등 캘린더 관련 데이터가 영구적으로 삭제됩니다.
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="danger"
                            size="sm"
                            onClick={handleDeleteCalendar}
                            disabled={isDeletingCalendar}
                            className="flex items-center gap-2"
                        >
                            {isDeletingCalendar ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    삭제 중...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="w-4 h-4" />
                                    캘린더 삭제
                                </>
                            )}
                        </Button>
                    </div>

                    {/* 삭제 결과 메시지 */}
                    {deleteResult?.type === 'calendar' && (
                        <div className={`p-4 rounded-xl ${deleteResult.success
                            ? 'bg-hud-accent-success/10 border border-hud-accent-success/30'
                            : 'bg-hud-accent-danger/10 border border-hud-accent-danger/30'
                            }`}>
                            <p className={`text-sm ${deleteResult.success ? 'text-hud-accent-success' : 'text-hud-accent-danger'}`}>
                                {deleteResult.success
                                    ? '캘린더 데이터가 삭제되었습니다.'
                                    : '캘린더 데이터 삭제에 실패했습니다. 다시 시도해 주세요.'}
                            </p>
                        </div>
                    )}
                </div>
            </HudCard>

            {/* 추가 정보 */}
            <HudCard className="bg-hud-bg-secondary/50">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-hud-text-muted flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-hud-text-muted">
                        <p className="font-medium text-hud-text-primary mb-1">참고사항</p>
                        <ul className="list-disc list-inside space-y-1">
                            <li>삭제된 데이터는 백업되지 않으므로 복구할 수 없습니다.</li>
                            <li>프로필 삭제 후에는 동일 이메일로 재가입이 제한될 수 있습니다.</li>
                            <li>캘린더 삭제만 진행하면 프로필 정보는 유지됩니다.</li>
                        </ul>
                    </div>
                </div>
            </HudCard>
        </div>
    );
};

const Settings = () => {
    const [activeSection, setActiveSection] = useState('profile')

    // Theme store
    const {
        mode,
        accentColor,
        fontSize,
        borderRadius,
        compactMode,
        setMode,
        setAccentColor,
        setFontSize,
        setBorderRadius,
        setCompactMode,
    } = useThemeStore()

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-hud-text-primary">설정</h1>
                    <p className="text-hud-text-muted mt-1">계정과 환경설정을 관리하세요.</p>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
                {/* Sidebar */}
                <div className="w-full md:w-56 flex-shrink-0">
                    <HudCard noPadding>
                        <div className="py-2">
                            {settingsSections.map((section) => (
                                <button
                                    key={section.id}
                                    onClick={() => setActiveSection(section.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 transition-hud ${activeSection === section.id
                                        ? 'bg-hud-accent-primary/10 text-hud-accent-primary border-l-2 border-hud-accent-primary'
                                        : 'text-hud-text-secondary hover:bg-hud-bg-hover hover:text-hud-text-primary'
                                        }`}
                                >
                                    {section.icon}
                                    <span className="text-sm">{section.label}</span>
                                </button>
                            ))}
                        </div>
                    </HudCard>
                </div>

                {/* Content */}
                <div className="flex-1 space-y-6">
                    {activeSection === 'profile' && (
                        <ProfileSection />
                    )}

                    {activeSection === 'notifications' && (
                        <HudCard title="Notification Preferences" subtitle="Manage how you receive notifications">
                            <div className="space-y-6">
                                {[
                                    { icon: <Mail size={18} />, title: 'Email Notifications', desc: 'Receive email updates about your account' },
                                    { icon: <Bell size={18} />, title: 'Push Notifications', desc: 'Get push notifications on your devices' },
                                    { icon: <Smartphone size={18} />, title: 'SMS Notifications', desc: 'Receive SMS for important updates' },
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 bg-hud-bg-primary rounded-lg">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 bg-hud-accent-primary/10 rounded-lg text-hud-accent-primary">
                                                {item.icon}
                                            </div>
                                            <div>
                                                <p className="text-sm text-hud-text-primary">{item.title}</p>
                                                <p className="text-xs text-hud-text-muted">{item.desc}</p>
                                            </div>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" defaultChecked className="sr-only peer" />
                                            <div className="w-11 h-6 bg-hud-bg-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-hud-accent-primary"></div>
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </HudCard>
                    )}

                    {activeSection === 'appearance' && (
                        <div className="space-y-6">
                            {/* ===== 테마 모드 - Premium Redesign ===== */}
                            <HudCard title="테마 모드" subtitle="선호하는 테마를 선택하세요">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {/* 라이트 테마 */}
                                    <button
                                        onClick={() => setMode('light')}
                                        className={`group relative overflow-hidden rounded-2xl border-2 transition-all duration-300 ${mode === 'light'
                                            ? 'border-hud-accent-primary shadow-[0_0_20px_rgba(var(--hud-accent-primary-rgb),0.25)] scale-[1.02]'
                                            : 'border-hud-border-secondary hover:border-hud-border-primary hover:scale-[1.01]'
                                            }`}
                                    >
                                        {/* Mini Preview */}
                                        <div className="p-3 pb-2">
                                            <div className="rounded-lg overflow-hidden border border-gray-600/30" style={{ background: '#1a1f2e' }}>
                                                <div className="flex items-center gap-1 px-2 py-1 border-b border-gray-600/20">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div>
                                                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-400"></div>
                                                    <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
                                                </div>
                                                <div className="flex h-14">
                                                    <div className="w-8 border-r border-gray-600/20 p-1 space-y-1">
                                                        <div className="w-full h-1 rounded bg-gray-500/40"></div>
                                                        <div className="w-full h-1 rounded bg-gray-500/30"></div>
                                                        <div className="w-full h-1 rounded bg-gray-500/20"></div>
                                                    </div>
                                                    <div className="flex-1 p-1.5 space-y-1">
                                                        <div className="w-3/4 h-1.5 rounded bg-gray-400/40"></div>
                                                        <div className="flex gap-1">
                                                            <div className="flex-1 h-4 rounded bg-gray-500/20 border border-gray-500/10"></div>
                                                            <div className="flex-1 h-4 rounded bg-gray-500/20 border border-gray-500/10"></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="px-3 pb-3 flex items-center gap-2">
                                            <div className={`p-1.5 rounded-lg transition-colors ${mode === 'light' ? 'bg-hud-accent-primary/20 text-hud-accent-primary' : 'bg-hud-bg-hover text-hud-text-muted'}`}>
                                                <Sun size={14} />
                                            </div>
                                            <span className={`text-sm font-medium ${mode === 'light' ? 'text-hud-accent-primary' : 'text-hud-text-secondary'}`}>라이트</span>
                                        </div>
                                        {mode === 'light' && (
                                            <div className="absolute top-2 right-2 w-5 h-5 bg-hud-accent-primary rounded-full flex items-center justify-center shadow-lg">
                                                <Check size={12} className="text-hud-bg-primary" />
                                            </div>
                                        )}
                                    </button>

                                    {/* 다크 테마 */}
                                    <button
                                        onClick={() => setMode('dark')}
                                        className={`group relative overflow-hidden rounded-2xl border-2 transition-all duration-300 ${mode === 'dark'
                                            ? 'border-hud-accent-primary shadow-[0_0_20px_rgba(var(--hud-accent-primary-rgb),0.25)] scale-[1.02]'
                                            : 'border-hud-border-secondary hover:border-hud-border-primary hover:scale-[1.01]'
                                            }`}
                                    >
                                        <div className="p-3 pb-2">
                                            <div className="rounded-lg overflow-hidden border border-gray-700/30" style={{ background: '#0a0e1a' }}>
                                                <div className="flex items-center gap-1 px-2 py-1 border-b border-gray-700/30">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div>
                                                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-400"></div>
                                                    <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
                                                </div>
                                                <div className="flex h-14">
                                                    <div className="w-8 border-r border-cyan-500/10 p-1 space-y-1">
                                                        <div className="w-full h-1 rounded bg-cyan-400/30"></div>
                                                        <div className="w-full h-1 rounded bg-gray-600/30"></div>
                                                        <div className="w-full h-1 rounded bg-gray-600/20"></div>
                                                    </div>
                                                    <div className="flex-1 p-1.5 space-y-1">
                                                        <div className="w-3/4 h-1.5 rounded bg-gray-300/30"></div>
                                                        <div className="flex gap-1">
                                                            <div className="flex-1 h-4 rounded bg-cyan-400/10 border border-cyan-400/20"></div>
                                                            <div className="flex-1 h-4 rounded bg-cyan-400/10 border border-cyan-400/20"></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="px-3 pb-3 flex items-center gap-2">
                                            <div className={`p-1.5 rounded-lg transition-colors ${mode === 'dark' ? 'bg-hud-accent-primary/20 text-hud-accent-primary' : 'bg-hud-bg-hover text-hud-text-muted'}`}>
                                                <Moon size={14} />
                                            </div>
                                            <span className={`text-sm font-medium ${mode === 'dark' ? 'text-hud-accent-primary' : 'text-hud-text-secondary'}`}>다크</span>
                                        </div>
                                        {mode === 'dark' && (
                                            <div className="absolute top-2 right-2 w-5 h-5 bg-hud-accent-primary rounded-full flex items-center justify-center shadow-lg">
                                                <Check size={12} className="text-hud-bg-primary" />
                                            </div>
                                        )}
                                    </button>

                                    {/* 스마트 테마 - Special Premium Card */}
                                    <button
                                        onClick={() => setMode('smart')}
                                        className={`group relative overflow-hidden rounded-2xl border-2 transition-all duration-300 ${mode === 'smart'
                                            ? 'border-hud-accent-primary shadow-[0_0_24px_rgba(var(--hud-accent-primary-rgb),0.3)] scale-[1.02]'
                                            : 'border-hud-border-secondary hover:border-hud-border-primary hover:scale-[1.01]'
                                            }`}
                                    >
                                        {/* Animated gradient background for smart theme */}
                                        <div className="absolute inset-0 opacity-20" style={{
                                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #ffd89b 75%, #667eea 100%)',
                                            backgroundSize: '400% 400%',
                                            animation: 'smartGradient 6s ease infinite',
                                        }}></div>
                                        <div className="relative p-3 pb-2">
                                            {/* Split preview: day + night */}
                                            <div className="rounded-lg overflow-hidden border border-purple-400/20 flex">
                                                {/* Day half */}
                                                <div className="flex-1" style={{ background: '#f1f5f9' }}>
                                                    <div className="flex items-center gap-0.5 px-1.5 py-1 border-b border-gray-300/50">
                                                        <div className="w-1 h-1 rounded-full bg-red-400"></div>
                                                        <div className="w-1 h-1 rounded-full bg-yellow-400"></div>
                                                        <div className="w-1 h-1 rounded-full bg-green-400"></div>
                                                    </div>
                                                    <div className="p-1 h-12 space-y-0.5">
                                                        <div className="w-full h-1 rounded bg-gray-400/40"></div>
                                                        <div className="w-3/4 h-1 rounded bg-gray-400/30"></div>
                                                        <div className="flex gap-0.5 mt-1">
                                                            <div className="flex-1 h-3 rounded-sm bg-purple-200/60"></div>
                                                            <div className="flex-1 h-3 rounded-sm bg-blue-200/60"></div>
                                                        </div>
                                                    </div>
                                                </div>
                                                {/* Night half */}
                                                <div className="flex-1" style={{ background: '#0a0e1a' }}>
                                                    <div className="flex items-center gap-0.5 px-1.5 py-1 border-b border-gray-700/50">
                                                        <div className="w-1 h-1 rounded-full bg-red-400"></div>
                                                        <div className="w-1 h-1 rounded-full bg-yellow-400"></div>
                                                        <div className="w-1 h-1 rounded-full bg-green-400"></div>
                                                    </div>
                                                    <div className="p-1 h-12 space-y-0.5">
                                                        <div className="w-full h-1 rounded bg-gray-400/30"></div>
                                                        <div className="w-3/4 h-1 rounded bg-gray-400/20"></div>
                                                        <div className="flex gap-0.5 mt-1">
                                                            <div className="flex-1 h-3 rounded-sm bg-cyan-400/20"></div>
                                                            <div className="flex-1 h-3 rounded-sm bg-cyan-400/15"></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Day/Night indicator */}
                                            <div className="flex justify-center gap-3 mt-1">
                                                <span className="text-[9px] text-amber-400/70 flex items-center gap-0.5"><Sun size={8} /> 낮</span>
                                                <span className="text-[9px] text-indigo-300/70 flex items-center gap-0.5"><Moon size={8} /> 밤</span>
                                            </div>
                                        </div>
                                        <div className="relative px-3 pb-3 flex items-center gap-2">
                                            <div className={`p-1.5 rounded-lg transition-colors ${mode === 'smart'
                                                ? 'bg-gradient-to-br from-amber-400/30 to-indigo-500/30 text-hud-accent-primary'
                                                : 'bg-hud-bg-hover text-hud-text-muted'}`}>
                                                <Coffee size={14} />
                                            </div>
                                            <div className="text-left">
                                                <span className={`text-sm font-medium block leading-tight ${mode === 'smart' ? 'text-hud-accent-primary' : 'text-hud-text-secondary'}`}>스마트</span>
                                                <span className="text-[10px] text-hud-text-muted leading-tight">시간대 자동 전환</span>
                                            </div>
                                        </div>
                                        {mode === 'smart' && (
                                            <div className="absolute top-2 right-2 w-5 h-5 bg-hud-accent-primary rounded-full flex items-center justify-center shadow-lg">
                                                <Check size={12} className="text-hud-bg-primary" />
                                            </div>
                                        )}
                                    </button>

                                    {/* 시스템 테마 */}
                                    <button
                                        onClick={() => setMode('system')}
                                        className={`group relative overflow-hidden rounded-2xl border-2 transition-all duration-300 ${mode === 'system'
                                            ? 'border-hud-accent-primary shadow-[0_0_20px_rgba(var(--hud-accent-primary-rgb),0.25)] scale-[1.02]'
                                            : 'border-hud-border-secondary hover:border-hud-border-primary hover:scale-[1.01]'
                                            }`}
                                    >
                                        <div className="p-3 pb-2">
                                            <div className="rounded-lg overflow-hidden border border-gray-600/20 flex" style={{ background: 'linear-gradient(135deg, #1e293b 50%, #e2e8f0 50%)' }}>
                                                <div className="w-full">
                                                    <div className="flex items-center gap-1 px-2 py-1 border-b border-gray-500/20">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div>
                                                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-400"></div>
                                                        <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
                                                    </div>
                                                    <div className="flex h-14 items-center justify-center">
                                                        <Monitor size={16} className="text-gray-400/60" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="px-3 pb-3 flex items-center gap-2">
                                            <div className={`p-1.5 rounded-lg transition-colors ${mode === 'system' ? 'bg-hud-accent-primary/20 text-hud-accent-primary' : 'bg-hud-bg-hover text-hud-text-muted'}`}>
                                                <Monitor size={14} />
                                            </div>
                                            <span className={`text-sm font-medium ${mode === 'system' ? 'text-hud-accent-primary' : 'text-hud-text-secondary'}`}>시스템</span>
                                        </div>
                                        {mode === 'system' && (
                                            <div className="absolute top-2 right-2 w-5 h-5 bg-hud-accent-primary rounded-full flex items-center justify-center shadow-lg">
                                                <Check size={12} className="text-hud-bg-primary" />
                                            </div>
                                        )}
                                    </button>
                                </div>
                            </HudCard>

                            {/* ===== 강조 색상 ===== */}
                            <HudCard title="강조 색상" subtitle="앱의 강조 색상을 선택하세요">
                                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-10 gap-3">
                                    {(Object.keys(ACCENT_COLORS) as Array<AccentColor>).map((color) => {
                                        const config = ACCENT_COLORS[color]
                                        return (
                                            <button
                                                key={color}
                                                onClick={() => setAccentColor(color)}
                                                className="relative group"
                                            >
                                                <div
                                                    className={`w-full aspect-square rounded-2xl transition-all duration-300 ${accentColor === color
                                                        ? 'ring-2 ring-offset-2 ring-offset-hud-bg-secondary ring-white scale-110 shadow-lg'
                                                        : 'ring-0 scale-100 hover:scale-105 hover:shadow-md'
                                                        }`}
                                                    style={{
                                                        background: `linear-gradient(135deg, ${config.primary}, ${config.info})`,
                                                        boxShadow: accentColor === color ? `0 8px 24px ${config.primary}40` : undefined,
                                                    }}
                                                />
                                                <div className="mt-2 text-center">
                                                    <span className={`text-xs font-medium transition-colors ${accentColor === color ? 'text-hud-accent-primary' : 'text-hud-text-muted'}`}>
                                                        {config.name}
                                                    </span>
                                                </div>
                                                {accentColor === color && (
                                                    <div className="absolute top-1 right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-lg">
                                                        <Check size={12} className="text-gray-900" />
                                                    </div>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            </HudCard>

                            {/* ===== 글자 크기 ===== */}
                            <HudCard title="글자 크기" subtitle="텍스트 크기를 조절하세요">
                                <div className="grid grid-cols-3 gap-4">
                                    {fontSizes.map((size) => (
                                        <button
                                            key={size.value}
                                            onClick={() => setFontSize(size.value)}
                                            className={`p-5 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center gap-2 ${fontSize === size.value
                                                ? 'border-hud-accent-primary bg-hud-accent-primary/10 shadow-[0_0_16px_rgba(var(--hud-accent-primary-rgb),0.15)]'
                                                : 'border-hud-border-secondary bg-hud-bg-primary hover:border-hud-border-primary hover:bg-hud-bg-hover'
                                                }`}
                                        >
                                            <span className={`font-semibold ${size.value === 'small' ? 'text-lg' : size.value === 'large' ? 'text-3xl' : 'text-2xl'} ${fontSize === size.value ? 'text-hud-accent-primary' : 'text-hud-text-secondary'}`}>
                                                가
                                            </span>
                                            <span className={`text-xs ${fontSize === size.value ? 'text-hud-accent-primary' : 'text-hud-text-muted'}`}>
                                                {size.label}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </HudCard>

                            {/* ===== 모서리 둥글기 ===== */}
                            <HudCard title="모서리 둥글기" subtitle="UI 요소의 모서리 스타일을 선택하세요">
                                <div className="grid grid-cols-3 gap-4">
                                    {borderRadii.map((radius) => (
                                        <button
                                            key={radius.value}
                                            onClick={() => setBorderRadius(radius.value)}
                                            className={`p-5 border-2 transition-all duration-300 flex flex-col items-center gap-3 ${radius.preview} ${borderRadius === radius.value
                                                ? 'border-hud-accent-primary bg-hud-accent-primary/10 shadow-[0_0_16px_rgba(var(--hud-accent-primary-rgb),0.15)]'
                                                : 'border-hud-border-secondary bg-hud-bg-primary hover:border-hud-border-primary hover:bg-hud-bg-hover'
                                                }`}
                                        >
                                            {/* Visual preview of border radius */}
                                            <div
                                                className={`w-10 h-10 border-2 transition-colors ${radius.value === 'sharp' ? 'rounded-none' : radius.value === 'medium' ? 'rounded-lg' : 'rounded-2xl'} ${borderRadius === radius.value ? 'border-hud-accent-primary bg-hud-accent-primary/20' : 'border-hud-text-muted/30 bg-hud-bg-hover'}`}
                                            ></div>
                                            <span className={`text-xs ${borderRadius === radius.value ? 'text-hud-accent-primary' : 'text-hud-text-muted'}`}>
                                                {radius.label}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </HudCard>

                            {/* ===== 기타 설정 ===== */}
                            <HudCard title="기타 설정" subtitle="추가 표시 옵션">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between p-4 bg-hud-bg-primary rounded-xl border border-hud-border-secondary/50 transition-all hover:border-hud-border-primary/50">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-hud-accent-primary/10">
                                                <Sparkles size={18} className="text-hud-accent-primary" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-hud-text-primary">컴팩트 모드</p>
                                                <p className="text-xs text-hud-text-muted">더 좁은 간격으로 표시</p>
                                            </div>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={compactMode}
                                                onChange={(e) => setCompactMode(e.target.checked)}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-hud-bg-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-hud-accent-primary"></div>
                                        </label>
                                    </div>
                                </div>
                            </HudCard>
                        </div>
                    )}

                    {activeSection === 'security' && (
                        <HudCard title="Security Settings" subtitle="Protect your account">
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm text-hud-text-secondary mb-2">Current Password</label>
                                    <input
                                        type="password"
                                        placeholder="Enter current password"
                                        className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-primary transition-hud"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-hud-text-secondary mb-2">New Password</label>
                                    <input
                                        type="password"
                                        placeholder="Enter new password"
                                        className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-primary transition-hud"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-hud-text-secondary mb-2">Confirm Password</label>
                                    <input
                                        type="password"
                                        placeholder="Confirm new password"
                                        className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-primary transition-hud"
                                    />
                                </div>

                                <div className="pt-4 border-t border-hud-border-secondary">
                                    <div className="flex items-center justify-between p-4 bg-hud-bg-primary rounded-lg">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 bg-hud-accent-primary/10 rounded-lg text-hud-accent-primary">
                                                <Shield size={18} />
                                            </div>
                                            <div>
                                                <p className="text-sm text-hud-text-primary">Two-Factor Authentication</p>
                                                <p className="text-xs text-hud-text-muted">Add an extra layer of security</p>
                                            </div>
                                        </div>
                                        <Button variant="outline" size="sm">Enable</Button>
                                    </div>
                                </div>
                            </div>
                        </HudCard>
                    )}

                    {activeSection === 'data' && (
                        <DataManagementSection />
                    )}

                    {(activeSection !== 'profile' && activeSection !== 'notifications' && activeSection !== 'appearance' && activeSection !== 'security' && activeSection !== 'data') && (
                        <HudCard title={settingsSections.find(s => s.id === activeSection)?.label} subtitle="Settings coming soon">
                            <div className="py-12 text-center">
                                <p className="text-hud-text-muted">This section is under development.</p>
                            </div>
                        </HudCard>
                    )}
                </div>
            </div>
        </div>
    )
}

export default Settings
