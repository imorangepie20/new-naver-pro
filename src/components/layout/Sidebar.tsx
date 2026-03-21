import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
    Home,
    BarChart3,
    Calendar,
    SlidersHorizontal,
    FileText,
    Building2,
    Users,
    LogOut,
    ChevronDown,
    Compass,
} from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'

interface SidebarProps {
    collapsed: boolean
    onToggle: () => void
}

interface MenuItem {
    title: string
    icon: React.ReactNode
    path?: string
    color: string
    children?: { title: string; path: string }[]
}

interface MenuSection {
    label: string
    icon: React.ReactNode
    items: MenuItem[]
}

const menuSections: MenuSection[] = [
    {
        label: '메인',
        icon: <Compass size={14} />,
        items: [
            { title: 'Dashboard', icon: <Home size={20} />, path: '/', color: 'cyan' },
            { title: '주변 지역 거래 분석', icon: <BarChart3 size={20} />, path: '/real-estate/address-market-stats', color: 'amber' },
            { title: 'REB 통계', icon: <BarChart3 size={20} />, path: '/real-estate/reb-market-stats', color: 'amber' },
            {
                title: '고객정보',
                icon: <Users size={20} />,
                color: 'pink',
                children: [
                    { title: '고객정보관리', path: '/customers/management' },
                ],
            },
            /*{ title: 'Analytics', icon: <BarChart3 size={20} />, path: '/analytics', color: 'amber' },*/
        ],
    },
    {
        label: '부동산',
        icon: <Building2 size={14} />,
        items: [
            {
                title: '매물 관리',
                icon: <FileText size={20} />,
                color: 'emerald',
                children: [
                    { title: '매물 등록', path: '/real-estate/register' },
                    { title: '매물 목록', path: '/real-estate/uploaded-properties' },
                    { title: '관심 매물', path: '/real-estate/favorites' },
                    { title: '관리 매물', path: '/real-estate/managed' },
                ],
            },
            {
                title: '네이버 부동산 매물',
                icon: <Building2 size={20} />,
                color: 'sky',
                children: [
                    { title: '네이버 매물 검색', path: '/real-estate' },
                    { title: '네이버 정규 매물 목록', path: '/real-estate/regular-properties' },
                ],
            },
        ],
    },
    {
        label: '설정',
        icon: <SlidersHorizontal size={14} />,
        items: [
            /*{ title: 'Profile', icon: <User size={20} />, path: '/profile', color: 'pink' },
            */{ title: 'Calendar', icon: <Calendar size={20} />, path: '/calendar', color: 'orange' },

            { title: 'Settings', icon: <SlidersHorizontal size={20} />, path: '/settings', color: 'rose' },
        ],
    },
]

const allItems = menuSections.flatMap(s => s.items)

// 색상 스타일 정의
const C: Record<string, {
    icon: string; iconBg: string; activeBg: string; activeText: string;
    indicator: string; subDot: string; subActive: string;
}> = {
    cyan: { icon: 'text-cyan-600', iconBg: 'bg-cyan-100', activeBg: 'bg-cyan-50 ring-cyan-200', activeText: 'text-cyan-700', indicator: 'bg-cyan-500', subDot: 'bg-cyan-400', subActive: 'bg-cyan-50' },
    amber: { icon: 'text-amber-600', iconBg: 'bg-amber-100', activeBg: 'bg-amber-50 ring-amber-200', activeText: 'text-amber-700', indicator: 'bg-amber-500', subDot: 'bg-amber-400', subActive: 'bg-amber-50' },
    emerald: { icon: 'text-emerald-600', iconBg: 'bg-emerald-100', activeBg: 'bg-emerald-50 ring-emerald-200', activeText: 'text-emerald-700', indicator: 'bg-emerald-500', subDot: 'bg-emerald-400', subActive: 'bg-emerald-50' },
    sky: { icon: 'text-sky-600', iconBg: 'bg-sky-100', activeBg: 'bg-sky-50 ring-sky-200', activeText: 'text-sky-700', indicator: 'bg-sky-500', subDot: 'bg-sky-400', subActive: 'bg-sky-50' },
    pink: { icon: 'text-pink-600', iconBg: 'bg-pink-100', activeBg: 'bg-pink-50 ring-pink-200', activeText: 'text-pink-700', indicator: 'bg-pink-500', subDot: 'bg-pink-400', subActive: 'bg-pink-50' },
    orange: { icon: 'text-orange-600', iconBg: 'bg-orange-100', activeBg: 'bg-orange-50 ring-orange-200', activeText: 'text-orange-700', indicator: 'bg-orange-500', subDot: 'bg-orange-400', subActive: 'bg-orange-50' },
    rose: { icon: 'text-rose-600', iconBg: 'bg-rose-100', activeBg: 'bg-rose-50 ring-rose-200', activeText: 'text-rose-700', indicator: 'bg-rose-500', subDot: 'bg-rose-400', subActive: 'bg-rose-50' },
}

const Sidebar = ({ collapsed }: SidebarProps) => {
    const location = useLocation()
    const navigate = useNavigate()
    const { user, logout } = useAuthStore()
    const [expandedMenus, setExpandedMenus] = useState<string[]>([])
    const [hoveredItem, setHoveredItem] = useState<string | null>(null)

    const isActive = (path?: string) => path ? location.pathname === path : false
    const isParentActive = (children?: { path: string }[]) =>
        children ? children.some(c => location.pathname === c.path) : false

    useEffect(() => {
        const auto = allItems
            .filter(i => i.children && isParentActive(i.children))
            .map(i => i.title)
        if (auto.length > 0) {
            setExpandedMenus(prev => [...prev, ...auto.filter(t => !prev.includes(t))])
        }
    }, [location.pathname])

    const toggleMenu = (title: string) => {
        setExpandedMenus(prev =>
            prev.includes(title) ? prev.filter(i => i !== title) : [...prev, title]
        )
    }

    const itemActive = (item: MenuItem) => isActive(item.path) || isParentActive(item.children)

    let globalIdx = 0

    return (
        <aside
            className={`fixed top-0 left-0 h-full z-50 transition-all duration-500 ease-out flex flex-col overflow-hidden ${collapsed ? 'w-20' : 'w-60'}`}
            style={{
                background: 'linear-gradient(165deg, #667eea 0%, #764ba2 40%, #f093fb 100%)',
            }}
        >
            {/* 배경 장식 */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-20 -right-20 w-60 h-60 bg-white/10 rounded-full blur-3xl" />
                <div className="absolute top-1/2 -left-10 w-40 h-40 bg-yellow-300/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-10 right-0 w-48 h-48 bg-cyan-300/10 rounded-full blur-3xl" />
            </div>

            {/* Logo */}
            <div className="relative h-16 flex items-center justify-center" style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                <Link to="/" className="group inline-flex items-center leading-none align-middle">
                    {collapsed ? (
                        <div className="relative">
                            <div className="absolute inset-0 rounded-2xl bg-white blur-md opacity-0 transition-opacity duration-500 group-hover:opacity-40" />
                            <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-white/70 bg-white shadow-lg shadow-blue-950/25 transition-all duration-300 group-hover:scale-105 group-hover:shadow-xl">
                                <img
                                    src="/icon.png"
                                    alt="집돌이9 아이콘"
                                    className="h-full w-full object-cover"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="relative">
                            <div className="absolute inset-0 rounded-2xl bg-white blur-md opacity-0 transition-opacity duration-500 group-hover:opacity-30" />
                            <div className="relative inline-flex h-9 items-center overflow-hidden rounded-2xl border border-white/65 bg-white/95 px-1 shadow-lg shadow-blue-950/25 transition-all duration-300 group-hover:shadow-xl">
                                <img
                                    src="/logo-full.png"
                                    alt="집돌이9 로고"
                                    className="h-[44px] w-auto max-w-full object-contain"
                                    style={{ imageRendering: 'auto' }}
                                />
                            </div>
                        </div>
                    )}
                </Link>
            </div>

            {/* Navigation */}
            <nav className="relative flex-1 py-3 overflow-y-auto min-h-0 sidebar-scroll">
                {menuSections.map((section, sIdx) => (
                    <div key={section.label}>
                        {/* ── 섹션 구분선 ── */}
                        {sIdx > 0 && (
                            <div className={`${collapsed ? 'mx-4 my-3' : 'mx-4 mt-5 mb-2'}`}>
                                <div className="h-[2px] rounded-full" style={{
                                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), rgba(255,220,100,0.4), rgba(255,255,255,0.5), transparent)',
                                }} />
                            </div>
                        )}

                        {/* 섹션 라벨 */}
                        {!collapsed && (
                            <div className="px-5 mb-1.5 mt-1 flex items-center gap-2">
                                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white/10 text-white/80">
                                    {section.icon}
                                </span>
                                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/70 select-none">
                                    {section.label}
                                </span>
                                <div className="flex-1 h-px bg-white/10" />
                            </div>
                        )}

                        <ul className="space-y-1 px-3">
                            {section.items.map((item) => {
                                const idx = globalIdx++
                                const active = itemActive(item)
                                const hovered = hoveredItem === item.title
                                const c = C[item.color] || C.cyan

                                return (
                                    <li key={item.title}>
                                        {item.children ? (
                                            <div>
                                                <button
                                                    onClick={() => toggleMenu(item.title)}
                                                    onMouseEnter={() => setHoveredItem(item.title)}
                                                    onMouseLeave={() => setHoveredItem(null)}
                                                    className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 ease-out
                                                        ${active
                                                            ? 'text-white'
                                                            : hovered
                                                                ? 'bg-white/20 text-white shadow-md backdrop-blur-sm'
                                                                : 'text-white/80 hover:text-white'
                                                        }`}
                                                    style={{ animation: `sbSlide 0.5s ease-out ${idx * 60}ms both` }}
                                                >
                                                    {active && (
                                                        <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 rounded-r-full ${c.indicator}`}
                                                            style={{ boxShadow: '2px 0 8px currentColor' }}
                                                        />
                                                    )}
                                                    <span className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-300 ${active ? `${c.iconBg} ${c.icon} scale-110` : hovered ? 'bg-white/15 scale-105' : ''
                                                        }`}>
                                                        {item.icon}
                                                    </span>
                                                    {!collapsed && (
                                                        <>
                                                            <span className={`flex-1 text-left text-sm ${active ? 'font-bold' : 'font-semibold'}`}>
                                                                {item.title}
                                                            </span>
                                                            <ChevronDown size={14}
                                                                className={`transition-transform duration-300 ${expandedMenus.includes(item.title) ? 'rotate-180' : ''}`}
                                                            />
                                                        </>
                                                    )}
                                                </button>

                                                {!collapsed && (
                                                    <ul className={`overflow-hidden transition-all duration-400 ease-out ${expandedMenus.includes(item.title) ? 'max-h-96 opacity-100 mt-1' : 'max-h-0 opacity-0'
                                                        }`}>
                                                        <div className="ml-6 pl-3 space-y-0.5" style={{ borderLeft: '2px solid rgba(255,255,255,0.2)' }}>
                                                            {item.children.map((child, cIdx) => {
                                                                const childActive = isActive(child.path)
                                                                return (
                                                                    <li key={child.path}>
                                                                        <Link
                                                                            to={child.path}
                                                                            onMouseEnter={() => setHoveredItem(child.path)}
                                                                            onMouseLeave={() => setHoveredItem(null)}
                                                                            className={`relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-200
                                                                                ${childActive
                                                                                    ? `bg-white/20 backdrop-blur-lg text-white font-bold shadow-md ring-1 ring-white/25`
                                                                                    : hoveredItem === child.path
                                                                                        ? 'bg-white/15 text-white font-medium'
                                                                                        : 'text-white/60 hover:text-white font-medium'
                                                                                }`}
                                                                            style={{
                                                                                animation: expandedMenus.includes(item.title)
                                                                                    ? `sbSlide 0.3s ease-out ${cIdx * 60}ms both`
                                                                                    : undefined,
                                                                            }}
                                                                        >
                                                                            <span className={`w-2 h-2 rounded-full transition-all duration-300 ${childActive ? `${c.subDot} scale-125 shadow-[0_0_6px] shadow-current` : 'bg-white/30'
                                                                                }`} />
                                                                            <span>{child.title}</span>
                                                                        </Link>
                                                                    </li>
                                                                )
                                                            })}
                                                        </div>
                                                    </ul>
                                                )}
                                            </div>
                                        ) : (
                                            <Link
                                                to={item.path!}
                                                onMouseEnter={() => setHoveredItem(item.title)}
                                                onMouseLeave={() => setHoveredItem(null)}
                                                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 ease-out
                                                    ${active
                                                        ? 'text-white'
                                                        : hovered
                                                            ? 'bg-white/20 text-white shadow-md backdrop-blur-sm'
                                                            : 'text-white/80 hover:text-white'
                                                    }`}
                                                style={{ animation: `sbSlide 0.5s ease-out ${idx * 60}ms both` }}
                                            >
                                                {active && (
                                                    <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 rounded-r-full ${c.indicator}`}
                                                        style={{ boxShadow: '2px 0 8px currentColor' }}
                                                    />
                                                )}
                                                <span className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-300 ${active ? `${c.iconBg} ${c.icon} scale-110` : hovered ? 'bg-white/15 scale-105' : ''
                                                    }`}>
                                                    {item.icon}
                                                </span>
                                                {!collapsed && (
                                                    <span className={`text-sm ${active ? 'font-bold' : 'font-semibold'}`}>
                                                        {item.title}
                                                    </span>
                                                )}
                                            </Link>
                                        )}
                                    </li>
                                )
                            })}
                        </ul>
                    </div>
                ))}
            </nav>

            {/* User Section */}
            <div className="relative shrink-0 p-3" style={{ borderTop: '2px solid rgba(255,255,255,0.2)' }}>
                <div
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300
                        ${hoveredItem === 'user' ? 'bg-white/20 backdrop-blur-sm shadow-md' : 'hover:bg-white/10'}`}
                    onMouseEnter={() => setHoveredItem('user')}
                    onMouseLeave={() => setHoveredItem(null)}
                >
                    <div className="relative w-9 h-9 bg-white rounded-lg flex items-center justify-center text-purple-600 font-extrabold text-sm shadow-lg shadow-purple-900/30">
                        {user?.name?.[0] || 'U'}
                    </div>
                    {!collapsed && (
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate drop-shadow">
                                {user?.name || '사용자'}
                            </p>
                            <p className="text-xs text-white/50 truncate">
                                {user?.email || ''}
                            </p>
                        </div>
                    )}
                    <button
                        onClick={() => { logout(); navigate('/login') }}
                        className="p-2 text-white/50 hover:text-red-200 hover:bg-red-400/20 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95"
                        title="로그아웃"
                    >
                        <LogOut size={16} />
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes sbSlide {
                    from { opacity: 0; transform: translateX(-20px); }
                    to { opacity: 1; transform: translateX(0); }
                }
                .sidebar-scroll::-webkit-scrollbar { width: 3px; }
                .sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
                .sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 10px; }
            `}</style>
        </aside>
    )
}

export default Sidebar
