import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
    Search,
    Bell,
    Menu,
    Mail,
    Calendar,
    Settings,
    LogOut,
    User,
    ChevronDown,
} from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'

interface HeaderProps {
    onMenuToggle: () => void
    showMenuToggle?: boolean
}

const notifications = [
    { id: 1, title: 'New order received ($1,299)', time: 'Just now', isNew: true },
    { id: 2, title: '3 new accounts created', time: '2 minutes ago', isNew: true },
    { id: 3, title: 'Setup completed', time: '3 minutes ago', isNew: false },
    { id: 4, title: 'Widget installation done', time: '5 minutes ago', isNew: false },
    { id: 5, title: 'Payment method enabled', time: '10 minutes ago', isNew: false },
]

const Header = ({ onMenuToggle, showMenuToggle = true }: HeaderProps) => {
    const [showNotifications, setShowNotifications] = useState(false)
    const [showProfile, setShowProfile] = useState(false)
    const { user, isAuthenticated, logout } = useAuthStore()
    const navigate = useNavigate()

    const handleLogout = () => {
        logout()
        navigate('/login')
        setShowProfile(false)
    }
    return (
        <header
            className="h-16 bg-hud-bg-secondary/80 backdrop-blur-md border-b border-hud-border-secondary px-6 flex items-center justify-between sticky top-0 z-40"
            style={{ boxShadow: 'var(--hud-shadow)' }}
        >
            {/* Left Section */}
            <div className={`flex items-center ${showMenuToggle ? 'gap-4' : 'gap-2'}`}>
                {showMenuToggle && (
                    <button
                        onClick={onMenuToggle}
                        className="p-2 rounded-lg hover:bg-hud-bg-hover transition-hud text-hud-text-secondary hover:text-hud-text-primary"
                    >
                        <Menu size={20} />
                    </button>
                )}

                {/* Search */}
                <div className="relative hidden md:block">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-hud-text-muted" size={18} />
                    <input
                        type="text"
                        placeholder="검색..."
                        className="w-72 lg:w-80 pl-10 pr-4 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                    />
                </div>
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-2">
                {/* Quick Links */}
                <div className="hidden lg:flex items-center gap-1">
                    <Link
                        to="/email/inbox"
                        className="p-2 rounded-lg hover:bg-hud-bg-hover transition-hud text-hud-text-secondary hover:text-hud-accent-primary"
                        title="받은메일"
                    >
                        <Mail size={20} />
                    </Link>
                    <Link
                        to="/calendar"
                        className="p-2 rounded-lg hover:bg-hud-bg-hover transition-hud text-hud-text-secondary hover:text-hud-accent-primary"
                        title="캘린더"
                    >
                        <Calendar size={20} />
                    </Link>
                    <Link
                        to="/settings"
                        className="p-2 rounded-lg hover:bg-hud-bg-hover transition-hud text-hud-text-secondary hover:text-hud-accent-primary"
                        title="설정"
                    >
                        <Settings size={20} />
                    </Link>
                </div>

                {/* Divider */}
                <div className="w-px h-8 bg-hud-border-secondary mx-2 hidden lg:block" />

                {/* Notifications */}
                <div className="relative">
                    <button
                        onClick={() => {
                            setShowNotifications(!showNotifications)
                            setShowProfile(false)
                        }}
                        className="relative p-2 rounded-lg hover:bg-hud-bg-hover transition-hud text-hud-text-secondary hover:text-hud-accent-primary"
                    >
                        <Bell size={20} />
                        <span className="absolute top-1 right-1 w-2 h-2 bg-hud-accent-danger rounded-full animate-pulse" />
                    </button>

                    {/* Notifications Dropdown */}
                    {
                        showNotifications && (
                            <div className="absolute right-0 mt-2 w-80 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg shadow-hud-glow animate-fade-in overflow-hidden">
                                <div className="px-4 py-3 border-b border-hud-border-secondary">
                                    <h3 className="font-semibold text-hud-text-primary">알림</h3>
                                </div>
                                <div className="max-h-80 overflow-y-auto">
                                    {notifications.map((notif) => (
                                        <div
                                            key={notif.id}
                                            className="px-4 py-3 hover:bg-hud-bg-hover transition-hud cursor-pointer border-b border-hud-border-secondary last:border-0"
                                        >
                                            <div className="flex items-start gap-3">
                                                {notif.isNew && (
                                                    <span className="w-2 h-2 mt-2 bg-hud-accent-primary rounded-full flex-shrink-0" />
                                                )}
                                                <div className={notif.isNew ? '' : 'ml-5'}>
                                                    <p className="text-sm text-hud-text-primary">{notif.title}</p>
                                                    <p className="text-xs text-hud-text-muted mt-1">{notif.time}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="px-4 py-3 border-t border-hud-border-secondary">
                                    <button className="w-full text-sm text-hud-accent-primary hover:underline">
                                        모든 알림 보기
                                    </button>
                                </div>
                            </div>
                        )
                    }
                </div >

                {/* Profile / Login Button */}
                {
                    isAuthenticated ? (
                        <div className="relative">
                            <button
                                onClick={() => {
                                    setShowProfile(!showProfile)
                                    setShowNotifications(false)
                                }}
                                className="flex items-center gap-2 p-2 rounded-lg hover:bg-hud-bg-hover transition-hud"
                            >
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-hud-accent-primary to-hud-accent-secondary flex items-center justify-center">
                                    <User size={16} className="text-hud-bg-primary" />
                                </div>
                                <span className="hidden md:block text-sm text-hud-text-primary">
                                    {user?.name || '사용자'}
                                </span>
                                <ChevronDown size={16} className="hidden md:block text-hud-text-muted" />
                            </button>

                            {/* Profile Dropdown */}
                            {showProfile && (
                                <div className="absolute right-0 mt-2 w-48 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg shadow-hud-glow animate-fade-in overflow-hidden">
                                    <div className="px-4 py-3 border-b border-hud-border-secondary">
                                        <p className="font-semibold text-hud-text-primary">
                                            {user?.name || '사용자'}
                                        </p>
                                        <p className="text-xs text-hud-text-muted">{user?.email || ''}</p>
                                    </div>
                                    <div className="py-1">
                                        <Link
                                            to="/profile"
                                            className="flex items-center gap-3 px-4 py-2 text-sm text-hud-text-secondary hover:bg-hud-bg-hover hover:text-hud-text-primary transition-hud"
                                        >
                                            <User size={16} />
                                            프로필
                                        </Link>
                                        <Link
                                            to="/settings"
                                            className="flex items-center gap-3 px-4 py-2 text-sm text-hud-text-secondary hover:bg-hud-bg-hover hover:text-hud-text-primary transition-hud"
                                        >
                                            <Settings size={16} />
                                            설정
                                        </Link>
                                    </div>
                                    <div className="border-t border-hud-border-secondary py-1">
                                        <button
                                            onClick={handleLogout}
                                            className="flex items-center gap-3 w-full px-4 py-2 text-sm text-hud-accent-danger hover:bg-hud-bg-hover transition-hud text-left"
                                        >
                                            <LogOut size={16} />
                                            로그아웃
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <Link
                            to="/login"
                            className="px-4 py-2 bg-hud-accent-primary text-hud-bg-primary rounded-lg text-sm font-medium hover:bg-hud-accent-primary/90 transition-hud"
                        >
                            로그인
                        </Link>
                    )
                }
            </div >
        </header >
    )
}

export default Header
