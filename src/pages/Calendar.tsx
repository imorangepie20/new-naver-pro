// ============================================
// 스마트 고급 캘린더
// - 다중 뷰 (월간/주간/일간/리스트)
// - 드래그 & 드롭 일정 생성/이동
// - AI 스마트 일정 분류
// - 충돌 감지
// - 반복 일정
// - 키보드 단축키
// ============================================

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
    ChevronLeft,
    ChevronRight,
    Plus,
    Calendar as CalendarIcon,
    Clock,
    MapPin,
    X,
    Sparkles,
    CalendarDays,
    CalendarClock,
    List,
    LayoutGrid,
    AlertTriangle,
    Copy,
    Search,
    Target,
    ArrowRight,
} from 'lucide-react'
import {
    format,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    isToday,
    addMonths,
    subMonths,
    startOfWeek,
    endOfWeek,
    addDays,
    addHours,
} from 'date-fns'
import { ko } from 'date-fns/locale'
import { motion, AnimatePresence } from 'framer-motion'
import { useHotkeys } from 'react-hotkeys-hook'
import HudCard from '../components/common/HudCard'
import Button from '../components/common/Button'
import { useAuthStore } from '../stores/authStore'
import { API_BASE } from '../lib/api'
import { isHoliday, getHolidaysInMonth, type Holiday } from '../lib/korean-holidays'

// ============================================
// 타입 정의
// ============================================

interface Schedule {
    id: string
    title: string
    description: string | null
    startTime: string
    endTime: string | null
    type: string
    location: string | null
    isAllDay: boolean
    isRecurring?: boolean
    recurrenceRule?: string | null
    recurrenceEnd?: string | null
    parentEventId?: string | null
    color?: string | null
    priority?: string
    attendees?: string | null
    status?: string
}

interface ScheduleFormData {
    title: string
    description: string
    startTime: string
    endTime: string
    type: string
    location: string
    isAllDay: boolean
    isRecurring: boolean
    recurrenceRule: string
    recurrenceEnd: string
    color: string
    priority: string
    attendees: string
}

type ViewType = 'month' | 'week' | 'day' | 'list'

// ============================================
// 상수
// ============================================

const EVENT_COLORS = {
    meeting: { bg: 'bg-blue-500/15', border: 'border-blue-500', text: 'text-blue-400', solid: 'bg-blue-500' },
    presentation: { bg: 'bg-purple-500/15', border: 'border-purple-500', text: 'text-purple-400', solid: 'bg-purple-500' },
    task: { bg: 'bg-amber-500/15', border: 'border-amber-500', text: 'text-amber-400', solid: 'bg-amber-500' },
    event: { bg: 'bg-cyan-500/15', border: 'border-cyan-500', text: 'text-cyan-400', solid: 'bg-cyan-500' },
    break: { bg: 'bg-emerald-500/15', border: 'border-emerald-500', text: 'text-emerald-400', solid: 'bg-emerald-500' },
    urgent: { bg: 'bg-red-500/15', border: 'border-red-500', text: 'text-red-400', solid: 'bg-red-500' },
    default: { bg: 'bg-hud-bg-hover', border: 'border-hud-border-secondary', text: 'text-hud-text-muted', solid: 'bg-hud-border-secondary' },
}

const AI_PATTERNS = {
    meeting: ['회의', '미팅', '모임', '협의', '점검', 'review', 'meeting'],
    presentation: ['발표', '프레젠테이션', '설명회', '데모', 'presentation'],
    task: ['업무', '작업', '처리', '완료', '보고', 'task'],
    event: ['행사', '파티', '연회', '기념일', '축하', 'event'],
    break: ['휴식', '식사', '점심', '저녁', '휴가', 'break'],
    urgent: ['긴급', '즉시', '바로', '촉급', 'urgent', 'asap'],
}

// ============================================
// 유틸리티 함수
// ============================================

const getEventColor = (type: string, priority?: string) => {
    if (priority === 'urgent') return EVENT_COLORS.urgent
    return EVENT_COLORS[type as keyof typeof EVENT_COLORS] || EVENT_COLORS.default
}

const formatTime = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

const detectEventType = (title: string, description: string = ''): { type: string; priority: string } => {
    const text = (title + ' ' + description).toLowerCase()

    // 우선순위 감지
    let priority = 'medium'
    if (AI_PATTERNS.urgent.some(p => text.includes(p))) priority = 'urgent'
    else if (text.includes('중요') || text.includes('important')) priority = 'high'
    else if (text.includes('선택') || text.includes('optional')) priority = 'low'

    // 유형 감지
    let type = 'default'
    for (const [key, patterns] of Object.entries(AI_PATTERNS)) {
        if (key === 'urgent') continue
        if (patterns.some(p => text.includes(p))) {
            type = key
            break
        }
    }

    return { type, priority }
}

const detectConflicts = (newEvent: { startTime: string; endTime?: string | null }, existingEvents: Schedule[]): Schedule[] => {
    const newStart = new Date(newEvent.startTime)
    const newEnd = newEvent.endTime ? new Date(newEvent.endTime) : newStart

    return existingEvents.filter(event => {
        if (event.status === 'cancelled') return false

        const eventStart = new Date(event.startTime)
        const eventEnd = event.endTime ? new Date(event.endTime) : eventStart

        // 시간 중복 확인
        return (
            (newStart >= eventStart && newStart < eventEnd) ||
            (newEnd > eventStart && newEnd <= eventEnd) ||
            (newStart <= eventStart && newEnd >= eventEnd)
        )
    })
}

const getTypeLabel = (type: string) => {
    switch (type) {
        case 'meeting': return '회의'
        case 'presentation': return '발표'
        case 'task': return '업무'
        case 'event': return '이벤트'
        case 'break': return '휴식'
        default: return '기본'
    }
}

const toDateTimeLocalValue = (date: Date) => format(date, "yyyy-MM-dd'T'HH:mm")

const getSuggestedSlots = (date: Date, schedules: Schedule[]) => {
    const daySchedules = schedules
        .filter(schedule => isSameDay(new Date(schedule.startTime), date))
        .filter(schedule => !schedule.isAllDay)
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

    if (daySchedules.length === 0) {
        return ['09:00 - 11:00', '13:00 - 15:00', '16:00 - 18:00']
    }

    const start = new Date(date)
    start.setHours(9, 0, 0, 0)
    const end = new Date(date)
    end.setHours(18, 0, 0, 0)

    const slots: string[] = []
    let cursor = start

    for (const schedule of daySchedules) {
        const scheduleStart = new Date(schedule.startTime)
        const scheduleEnd = schedule.endTime ? new Date(schedule.endTime) : addHours(scheduleStart, 1)

        if (scheduleStart.getTime() - cursor.getTime() >= 60 * 60 * 1000) {
            slots.push(`${format(cursor, 'HH:mm')} - ${format(scheduleStart, 'HH:mm')}`)
        }

        if (scheduleEnd > cursor) {
            cursor = scheduleEnd
        }
    }

    if (end.getTime() - cursor.getTime() >= 60 * 60 * 1000) {
        slots.push(`${format(cursor, 'HH:mm')} - ${format(end, 'HH:mm')}`)
    }

    return slots.slice(0, 3)
}

// ============================================
// 뷰 전환 탭 컴포넌트
// ============================================

const ViewTabs = ({ currentView, onViewChange }: { currentView: ViewType; onViewChange: (view: ViewType) => void }) => {
    const tabs = [
        { value: 'month' as ViewType, label: '월간', icon: LayoutGrid },
        { value: 'week' as ViewType, label: '주간', icon: CalendarDays },
        { value: 'day' as ViewType, label: '일간', icon: CalendarClock },
        { value: 'list' as ViewType, label: '리스트', icon: List },
    ]

    return (
        <div className="flex items-center gap-1 p-1 bg-hud-bg-primary rounded-lg border border-hud-border-secondary">
            {tabs.map(tab => {
                const Icon = tab.icon
                const isActive = currentView === tab.value
                return (
                    <button
                        key={tab.value}
                        onClick={() => onViewChange(tab.value)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-hud ${
                            isActive
                                ? 'bg-hud-accent-primary text-hud-bg-primary shadow-lg'
                                : 'text-hud-text-secondary hover:text-hud-text-primary hover:bg-hud-bg-hover'
                        }`}
                    >
                        <Icon size={16} />
                        <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                )
            })}
        </div>
    )
}

// ============================================
// 일정 칩 컴포넌트
// ============================================

const EventChip = ({
    schedule,
    compact = false,
    onClick,
    onDragStart,
}: {
    schedule: Schedule
    compact?: boolean
    onClick?: (e?: React.MouseEvent) => void
    onDragStart?: (e: React.DragEvent) => void
}) => {
    const colors = getEventColor(schedule.type, schedule.priority)
    const isUrgent = schedule.priority === 'urgent'

    return (
        <div
            draggable
            onDragStart={onDragStart}
            onClick={onClick}
            className={`${colors.bg} ${colors.border} ${colors.text} border-l-2 rounded px-2 py-1 text-xs cursor-pointer hover:opacity-80 transition-all truncate flex items-center gap-1.5`}
        >
            {isUrgent && <AlertTriangle size={10} />}
            {!compact && !schedule.isAllDay && schedule.endTime && (
                <span className="opacity-70">{formatTime(schedule.startTime)}</span>
            )}
            <span className="truncate flex-1">{schedule.title}</span>
            {schedule.isRecurring && <Copy size={10} className="opacity-50 flex-shrink-0" />}
        </div>
    )
}

// ============================================
// 월간 뷰 컴포넌트
// ============================================

const MonthView = ({
    currentDate,
    schedules,
    onDateClick,
    onEventClick,
    onDragStart,
    holidays,
}: {
    currentDate: Date
    schedules: Schedule[]
    onDateClick: (date: Date) => void
    onEventClick: (schedule: Schedule) => void
    onDragStart: (schedule: Schedule, e: React.DragEvent) => void
    holidays: Holiday[]
}) => {
    const monthStart = startOfMonth(currentDate)
    const calendarStart = new Date(monthStart)
    calendarStart.setDate(calendarStart.getDate() - monthStart.getDay())

    const calendarDays = eachDayOfInterval({
        start: calendarStart,
        end: new Date(calendarStart.getTime() + 41 * 24 * 60 * 60 * 1000),
    })

    const days = ['일', '월', '화', '수', '목', '금', '토']

    const getSchedulesForDate = useCallback((date: Date) => {
        return schedules.filter(s => isSameDay(new Date(s.startTime), date))
    }, [schedules])

    return (
        <div className="p-4">
            {/* 요일 헤더 */}
            <div className="grid grid-cols-7 gap-1 mb-2">
                {days.map((day, i) => (
                    <div
                        key={day}
                        className={`text-center text-xs font-bold py-2 ${
                            i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-hud-text-muted'
                        }`}
                    >
                        {day}
                    </div>
                ))}
            </div>

            {/* 날짜 그리드 */}
            <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, i) => {
                    const isCurrentMonth = isSameMonth(day, currentDate)
                    const isTodayDate = isToday(day)
                    const daySchedules = getSchedulesForDate(day)
                    const holiday = holidays.find(h => isSameDay(new Date(h.date), day))

                    return (
                        <div
                            key={i}
                            onClick={() => onDateClick(day)}
                            className={`aspect-square p-1 rounded-lg transition-hud cursor-pointer relative group
                                ${!isCurrentMonth ? 'opacity-30' : ''}
                                ${isTodayDate ? 'bg-hud-accent-primary/10 ring-2 ring-hud-accent-primary/50' : ''}
                                hover:bg-hud-bg-hover
                            `}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span
                                    className={`text-xs font-medium ${
                                        isTodayDate
                                            ? 'text-hud-accent-primary'
                                            : holiday
                                            ? 'text-red-400'
                                            : 'text-hud-text-primary'
                                    }`}
                                >
                                    {format(day, 'd')}
                                </span>
                                {holiday && <Sparkles size={10} className="text-red-400" />}
                            </div>

                            {/* 일정 칩들 */}
                            <div className="space-y-0.5 overflow-hidden max-h-16">
                                {daySchedules.slice(0, 3).map(schedule => (
                                    <EventChip
                                        key={schedule.id}
                                        schedule={schedule}
                                        compact
                                        onClick={() => onEventClick(schedule)}
                                        onDragStart={(e) => onDragStart(schedule, e)}
                                    />
                                ))}
                                {daySchedules.length > 3 && (
                                    <div className="text-xs text-hud-text-muted text-center">
                                        +{daySchedules.length - 3} 더보기
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// ============================================
// 주간 뷰 컴포넌트
// ============================================

const WeekView = ({
    currentDate,
    schedules,
    onDateClick,
    onEventClick,
    onDragStart,
    holidays,
}: {
    currentDate: Date
    schedules: Schedule[]
    onDateClick: (date: Date) => void
    onEventClick: (schedule: Schedule) => void
    onDragStart: (schedule: Schedule, e: React.DragEvent) => void
    holidays: Holiday[]
}) => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 })
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 })
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

    const hours = Array.from({ length: 24 }, (_, i) => i)

    const getSchedulesForDateAndHour = useCallback((date: Date, hour: number) => {
        return schedules.filter(s => {
            const scheduleDate = new Date(s.startTime)
            return (
                isSameDay(scheduleDate, date) &&
                scheduleDate.getHours() === hour
            )
        })
    }, [schedules])

    return (
        <div className="overflow-x-auto">
            <div className="min-w-[800px]">
                {/* 요일 헤더 + 시간대 그리드 */}
                <div className="flex">
                    {/* 시간 라벨 열 */}
                    <div className="w-16 flex-shrink-0" />

                    {/* 날짜 열들 */}
                    {weekDays.map((day, i) => {
                        const isTodayDate = isToday(day)
                        const holiday = holidays.find(h => isSameDay(new Date(h.date), day))

                        return (
                            <div
                                key={i}
                                onClick={() => onDateClick(day)}
                                className={`flex-1 text-center p-2 border-l border-hud-border-secondary cursor-pointer hover:bg-hud-bg-hover transition-hud
                                    ${isTodayDate ? 'bg-hud-accent-primary/10' : ''}
                                `}
                            >
                                <div className={`text-xs ${isTodayDate ? 'text-hud-accent-primary font-bold' : 'text-hud-text-muted'}`}>
                                    {['일', '월', '화', '수', '목', '금', '토'][i]}
                                </div>
                                <div className={`text-lg font-semibold ${isTodayDate ? 'text-hud-accent-primary' : holiday ? 'text-red-400' : 'text-hud-text-primary'}`}>
                                    {format(day, 'd')}
                                </div>
                                {holiday && (
                                    <div className="text-xs text-red-400 truncate">{holiday.name}</div>
                                )}
                            </div>
                        )
                    })}
                </div>

                {/* 시간대 그리드 */}
                <div className="flex max-h-[600px] overflow-y-auto">
                    {/* 시간 라벨 */}
                    <div className="w-16 flex-shrink-0">
                        {hours.map(hour => (
                            <div key={hour} className="h-16 text-xs text-hud-text-muted text-right pr-2 -mt-2">
                                {hour > 0 && `${hour}:00`}
                            </div>
                        ))}
                    </div>

                    {/* 날짜 셀들 */}
                    {weekDays.map((day, dayIndex) => (
                        <div key={dayIndex} className="flex-1 border-l border-hud-border-secondary relative">
                            {hours.map(hour => (
                                <div
                                    key={hour}
                                    className="h-16 border-b border-hud-border-secondary/50 hover:bg-hud-bg-hover/50 transition-hud"
                                >
                                    {getSchedulesForDateAndHour(day, hour).map(schedule => (
                                        <div
                                            key={schedule.id}
                                            onClick={() => onEventClick(schedule)}
                                            draggable
                                            onDragStart={(e) => onDragStart(schedule, e)}
                                        >
                                            <EventChip
                                                schedule={schedule}
                                                onClick={() => onEventClick(schedule)}
                                                onDragStart={(e) => onDragStart(schedule, e)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

// ============================================
// 일간 뷰 컴포넌트
// ============================================

const DayView = ({
    currentDate,
    schedules,
    onEventClick,
    onDragStart,
    holidays,
}: {
    currentDate: Date
    schedules: Schedule[]
    onEventClick: (schedule: Schedule) => void
    onDragStart: (schedule: Schedule, e: React.DragEvent) => void
    holidays: Holiday[]
}) => {
    const hours = Array.from({ length: 24 }, (_, i) => i)
    const holiday = holidays.find(h => isSameDay(new Date(h.date), currentDate))

    const getSchedulesForHour = useCallback((hour: number) => {
        return schedules.filter(s => {
            const scheduleDate = new Date(s.startTime)
            return scheduleDate.getHours() === hour
        })
    }, [schedules])

    return (
        <div className="p-4">
            {/* 날짜 정보 */}
            <div className="text-center mb-4">
                <div className="text-2xl font-bold text-hud-text-primary">
                    {format(currentDate, 'M월 d일', { locale: ko })}
                </div>
                <div className="text-sm text-hud-text-muted">
                    {['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'][currentDate.getDay()]}
                </div>
                {holiday && (
                    <div className="mt-2 text-red-400 flex items-center justify-center gap-2">
                        <Sparkles size={16} />
                        <span>{holiday.name}</span>
                    </div>
                )}
            </div>

            {/* 시간대별 일정 */}
            <div className="space-y-2">
                {hours.map(hour => {
                    const hourSchedules = getSchedulesForHour(hour)

                    return (
                        <div key={hour} className="flex gap-4">
                            <div className="w-16 text-right text-sm text-hud-text-muted pt-2">
                                {hour > 0 ? `${hour}:00` : ''}
                            </div>
                            <div className="flex-1 min-h-[60px] p-2 rounded-lg border border-hud-border-secondary/30 hover:bg-hud-bg-hover/30 transition-hud">
                                {hourSchedules.map(schedule => (
                                    <EventChip
                                        key={schedule.id}
                                        schedule={schedule}
                                        onClick={() => onEventClick(schedule)}
                                        onDragStart={(e) => onDragStart(schedule, e)}
                                    />
                                ))}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// ============================================
// 리스트 뷰 컴포넌트
// ============================================

const ListView = ({
    schedules,
    onEventClick,
}: {
    schedules: Schedule[]
    onEventClick: (schedule: Schedule) => void
}) => {
    // 날짜별로 그룹화
    const groupedData = useMemo(() => {
        const grouped: Record<string, Schedule[]> = {}
        schedules.forEach(schedule => {
            const dateKey = format(new Date(schedule.startTime), 'yyyy-MM-dd')
            if (!grouped[dateKey]) grouped[dateKey] = []
            grouped[dateKey].push(schedule)
        })
        return grouped
    }, [schedules])

    const sortedDates = Object.keys(groupedData).sort()

    return (
        <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
            {sortedDates.length > 0 ? (
                sortedDates.map(dateKey => (
                    <div key={dateKey}>
                        <div className="text-sm font-semibold text-hud-text-secondary mb-2 sticky top-0 bg-hud-bg-secondary py-1">
                            {format(new Date(dateKey), 'M월 d일 EEEE', { locale: ko })}
                        </div>
                        <div className="space-y-2">
                            {groupedData[dateKey].map(schedule => {
                                const colors = getEventColor(schedule.type, schedule.priority)

                                return (
                                    <motion.div
                                        key={schedule.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        onClick={() => onEventClick(schedule)}
                                        className={`p-4 rounded-xl border-l-4 ${colors.border} bg-hud-bg-tertiary hover:bg-hud-bg-hover transition-hud cursor-pointer`}
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h4 className="font-medium text-hud-text-primary">{schedule.title}</h4>
                                                    {schedule.priority === 'urgent' && (
                                                        <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />
                                                    )}
                                                    <span className={`px-2 py-0.5 rounded text-xs ${colors.bg} ${colors.text}`}>
                                                        {schedule.type === 'meeting' ? '회의' :
                                                            schedule.type === 'task' ? '업무' :
                                                            schedule.type === 'event' ? '이벤트' :
                                                            schedule.type === 'break' ? '휴식' : '기본'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3 text-sm text-hud-text-muted">
                                                    <div className="flex items-center gap-1">
                                                        <Clock size={14} />
                                                        <span>
                                                            {schedule.isAllDay ? '하루 종일' : formatTime(schedule.startTime)}
                                                            {schedule.endTime && !schedule.isAllDay && ` ~ ${formatTime(schedule.endTime)}`}
                                                        </span>
                                                    </div>
                                                    {schedule.location && (
                                                        <div className="flex items-center gap-1">
                                                            <MapPin size={14} />
                                                            <span className="truncate">{schedule.location}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                {schedule.description && (
                                                    <p className="text-sm text-hud-text-muted mt-2 line-clamp-2">
                                                        {schedule.description}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </div>
                    </div>
                ))
            ) : (
                <div className="text-center py-12 text-hud-text-muted">
                    <CalendarIcon size={48} className="mx-auto mb-4 opacity-30" />
                    <p>일정이 없습니다</p>
                </div>
            )}
        </div>
    )
}

// ============================================
// 일정 모달 컴포넌트
// ============================================

interface ScheduleModalProps {
    isOpen: boolean
    onClose: () => void
    onSave: (data: ScheduleFormData) => void
    onDelete?: (id: string) => void
    schedule?: Schedule | null
    selectedDate?: Date
    conflicts?: Schedule[]
}

const ScheduleModal = ({ isOpen, onClose, onSave, onDelete, schedule, selectedDate, conflicts = [] }: ScheduleModalProps) => {
    const [formData, setFormData] = useState<ScheduleFormData>({
        title: '',
        description: '',
        startTime: '',
        endTime: '',
        type: 'default',
        location: '',
        isAllDay: false,
        isRecurring: false,
        recurrenceRule: '',
        recurrenceEnd: '',
        color: '',
        priority: 'medium',
        attendees: '',
    })

    const [aiSuggestion, setAiSuggestion] = useState<{ type: string; priority: string } | null>(null)

    // AI 자동 분석
    useEffect(() => {
        if (formData.title || formData.description) {
            const suggestion = detectEventType(formData.title, formData.description)
            setAiSuggestion(suggestion)
        }
    }, [formData.title, formData.description])

    // 모달이 열릴 때마다 폼 초기화
    useEffect(() => {
        if (!isOpen) return

        if (schedule) {
            setFormData({
                title: schedule.title,
                description: schedule.description || '',
                startTime: schedule.startTime.slice(0, 16),
                endTime: schedule.endTime ? schedule.endTime.slice(0, 16) : '',
                type: schedule.type,
                location: schedule.location || '',
                isAllDay: schedule.isAllDay,
                isRecurring: schedule.isRecurring || false,
                recurrenceRule: schedule.recurrenceRule || '',
                recurrenceEnd: schedule.recurrenceEnd ? schedule.recurrenceEnd.slice(0, 10) : '',
                color: schedule.color || '',
                priority: schedule.priority || 'medium',
                attendees: schedule.attendees || '',
            })
        } else {
            const now = new Date()
            const baseDate = selectedDate || now
            const dateStr = toDateTimeLocalValue(baseDate)
            const endDateStr = toDateTimeLocalValue(addHours(baseDate, 1))
            setFormData({
                title: '',
                description: '',
                startTime: dateStr,
                endTime: endDateStr,
                type: 'default',
                location: '',
                isAllDay: false,
                isRecurring: false,
                recurrenceRule: '{"frequency":"weekly"}',
                recurrenceEnd: '',
                color: '',
                priority: 'medium',
                attendees: '',
            })
        }
    }, [isOpen, schedule, selectedDate])

    useEffect(() => {
        if (!formData.startTime || formData.isAllDay) return
        const suggestedEnd = toDateTimeLocalValue(addHours(new Date(formData.startTime), 1))
        if (!formData.endTime || new Date(formData.endTime) <= new Date(formData.startTime)) {
            setFormData(prev => prev.endTime === suggestedEnd ? prev : ({ ...prev, endTime: suggestedEnd }))
        }
    }, [formData.startTime, formData.isAllDay, formData.endTime])

    // AI 제안 적용
    const applyAiSuggestion = () => {
        if (aiSuggestion) {
            setFormData(prev => ({
                ...prev,
                type: aiSuggestion.type,
                priority: aiSuggestion.priority,
            }))
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-hud-bg-secondary rounded-xl border border-hud-border-primary w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
                <div className="flex items-center justify-between p-4 border-b border-hud-border-secondary sticky top-0 bg-hud-bg-secondary z-10">
                    <h3 className="text-lg font-semibold text-hud-text-primary">
                        {schedule ? '일정 수정' : '새 일정'}
                    </h3>
                    <div className="flex items-center gap-2">
                        {schedule && onDelete && (
                            <button
                                onClick={() => {
                                    if (confirm('이 일정을 삭제하시겠습니까?')) {
                                        onDelete(schedule.id)
                                        onClose()
                                    }
                                }}
                                className="p-1 rounded-lg hover:bg-red-500/20 text-red-400"
                            >
                                <X size={18} />
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-1 rounded-lg hover:bg-hud-bg-hover text-hud-text-muted"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="p-4 space-y-4">
                    {/* AI 제안 배너 */}
                    {aiSuggestion && (aiSuggestion.type !== 'default' || aiSuggestion.priority !== 'medium') && (
                        <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-lg">
                            <div className="flex items-center gap-2">
                                <Sparkles size={16} className="text-purple-400" />
                                <span className="text-sm text-hud-text-primary">
                                    AI 추천: <span className="font-medium">{aiSuggestion.type === 'meeting' ? '회의' :
                                        aiSuggestion.type === 'task' ? '업무' :
                                        aiSuggestion.type === 'event' ? '이벤트' :
                                        aiSuggestion.type === 'break' ? '휴식' : aiSuggestion.type}</span>
                                    {aiSuggestion.priority !== 'medium' && (
                                        <span className="ml-2 text-xs px-2 py-0.5 rounded bg-hud-accent-primary/20 text-hud-accent-primary">
                                            {aiSuggestion.priority === 'urgent' ? '긴급' :
                                             aiSuggestion.priority === 'high' ? '높음' :
                                             aiSuggestion.priority === 'low' ? '낮음' : ''}
                                        </span>
                                    )}
                                </span>
                            </div>
                            <button
                                onClick={applyAiSuggestion}
                                className="text-xs px-3 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg transition-hud"
                            >
                                적용
                            </button>
                        </div>
                    )}

                    {/* 충돌 경고 */}
                    {conflicts.length > 0 && (
                        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                            <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="text-sm text-red-400 font-medium">일정 충돌</p>
                                <p className="text-xs text-red-400/70 mt-1">
                                    다음 일정과 시간이 겹칩니다:
                                </p>
                                <ul className="text-xs text-red-400/70 mt-1 space-y-1">
                                    {conflicts.map(c => (
                                        <li key={c.id}>• {c.title} ({formatTime(c.startTime)})</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* 제목 */}
                    <div>
                        <label className="block text-sm font-medium text-hud-text-secondary mb-1">제목 *</label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="일정 제목을 입력하세요"
                            className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-primary rounded-lg text-hud-text-primary placeholder:text-hud-text-muted focus:outline-none focus:border-hud-accent-primary focus:ring-1 focus:ring-hud-accent-primary"
                        />
                    </div>

                    {/* 날짜/시간 */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-hud-text-secondary mb-1">시작일시 *</label>
                            <input
                                type="datetime-local"
                                value={formData.startTime}
                                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                className="w-full px-2 py-2 text-xs bg-hud-bg-primary border border-hud-border-primary rounded-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-primary"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-hud-text-secondary mb-1">종료일시</label>
                            <input
                                type="datetime-local"
                                value={formData.endTime}
                                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                                disabled={formData.isAllDay}
                                className="w-full px-2 py-2 text-xs bg-hud-bg-primary border border-hud-border-primary rounded-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-primary disabled:opacity-50"
                            />
                        </div>
                    </div>

                    {/* 종일 체크박스 */}
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="isAllDay"
                            checked={formData.isAllDay}
                            onChange={(e) => setFormData({ ...formData, isAllDay: e.target.checked })}
                            className="w-4 h-4 rounded border-hud-border-primary bg-hud-bg-primary text-hud-accent-primary focus:ring-hud-accent-primary"
                        />
                        <label htmlFor="isAllDay" className="text-sm text-hud-text-secondary">하루 종일</label>
                    </div>

                    {/* 반복 일정 */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="isRecurring"
                                checked={formData.isRecurring}
                                onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                                className="w-4 h-4 rounded border-hud-border-primary bg-hud-bg-primary text-hud-accent-primary focus:ring-hud-accent-primary"
                            />
                            <label htmlFor="isRecurring" className="text-sm text-hud-text-secondary">반복 일정</label>
                        </div>
                        {formData.isRecurring && (
                            <div className="grid grid-cols-2 gap-2 pl-6">
                                <select
                                    value={(() => {
                                        try {
                                            return JSON.parse(formData.recurrenceRule || '{"frequency":"weekly"}').frequency || 'weekly'
                                        } catch { return 'weekly' }
                                    })()}
                                    onChange={(e) => {
                                        try {
                                            const current = JSON.parse(formData.recurrenceRule || '{}')
                                            setFormData({
                                                ...formData,
                                                recurrenceRule: JSON.stringify({ ...current, frequency: e.target.value })
                                            })
                                        } catch {
                                            setFormData({
                                                ...formData,
                                                recurrenceRule: JSON.stringify({ frequency: e.target.value })
                                            })
                                        }
                                    }}
                                    className="px-2 py-1.5 text-sm bg-hud-bg-primary border border-hud-border-primary rounded-lg text-hud-text-primary"
                                >
                                    <option value="daily">매일</option>
                                    <option value="weekly">매주</option>
                                    <option value="monthly">매월</option>
                                    <option value="yearly">매년</option>
                                </select>
                                <input
                                    type="date"
                                    value={formData.recurrenceEnd}
                                    onChange={(e) => setFormData({ ...formData, recurrenceEnd: e.target.value })}
                                    placeholder="반복 종료일"
                                    className="px-2 py-1.5 text-sm bg-hud-bg-primary border border-hud-border-primary rounded-lg text-hud-text-primary"
                                />
                            </div>
                        )}
                    </div>

                    {/* 유형 & 우선순위 */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-hud-text-secondary mb-1">유형</label>
                            <select
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-primary rounded-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-primary"
                            >
                                <option value="default">기본</option>
                                <option value="meeting">회의</option>
                                <option value="presentation">발표</option>
                                <option value="task">업무</option>
                                <option value="event">이벤트</option>
                                <option value="break">휴식</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-hud-text-secondary mb-1">우선순위</label>
                            <select
                                value={formData.priority}
                                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-primary rounded-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-primary"
                            >
                                <option value="low">낮음</option>
                                <option value="medium">보통</option>
                                <option value="high">높음</option>
                                <option value="urgent">긴급</option>
                            </select>
                        </div>
                    </div>

                    {/* 장소 */}
                    <div>
                        <label className="block text-sm font-medium text-hud-text-secondary mb-1">장소</label>
                        <div className="relative">
                            <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-hud-text-muted" />
                            <input
                                type="text"
                                value={formData.location}
                                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                placeholder="장소 (선택사항)"
                                className="w-full pl-9 pr-3 py-2 bg-hud-bg-primary border border-hud-border-primary rounded-lg text-hud-text-primary placeholder:text-hud-text-muted focus:outline-none focus:border-hud-accent-primary"
                            />
                        </div>
                    </div>

                    {/* 설명 */}
                    <div>
                        <label className="block text-sm font-medium text-hud-text-secondary mb-1">설명</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="일정 설명 (선택사항)"
                            rows={3}
                            className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-primary rounded-lg text-hud-text-primary placeholder:text-hud-text-muted focus:outline-none focus:border-hud-accent-primary resize-none"
                        />
                    </div>
                </div>

                <div className="flex gap-3 p-4 border-t border-hud-border-secondary sticky bottom-0 bg-hud-bg-secondary">
                    <Button variant="ghost" onClick={onClose} className="flex-1">
                        취소
                    </Button>
                    <Button
                        variant="primary"
                        onClick={() => onSave(formData)}
                        disabled={!formData.title || !formData.startTime}
                        className="flex-1"
                        glow
                    >
                        {schedule ? '수정' : '저장'}
                    </Button>
                </div>
            </motion.div>
        </div>
    )
}

// ============================================
// 메인 컴포넌트
// ============================================

const Calendar = () => {
    const authFetch = useAuthStore((state) => state.authFetch)
    const [currentDate, setCurrentDate] = useState(new Date())
    const [viewType, setViewType] = useState<ViewType>('month')
    const [schedules, setSchedules] = useState<Schedule[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    const [typeFilter, setTypeFilter] = useState('all')
    const [isLoading, setIsLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null)
    const [selectedDate, setSelectedDate] = useState<Date | null>(null)
    const [focusedDate, setFocusedDate] = useState(new Date())
    const [draggedSchedule, setDraggedSchedule] = useState<Schedule | null>(null)
    const [conflicts, setConflicts] = useState<Schedule[]>([])
    const [quickAddForm, setQuickAddForm] = useState({
        title: '',
        startTime: toDateTimeLocalValue(new Date()),
        type: 'default',
    })

    // 현재 달의 공휴일
    const holidaysInMonth = useMemo(() => {
        const year = currentDate.getFullYear()
        const month = currentDate.getMonth() + 1
        return getHolidaysInMonth(year, month)
    }, [currentDate])

    // 현재 주의 공휴일
    const holidaysInWeek = useMemo(() => {
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 })
        const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 })
        const holidays: Holiday[] = []
        let current = weekStart
        while (current <= weekEnd) {
            const holiday = isHoliday(current)
            if (holiday) holidays.push({ ...holiday, date: format(current, 'yyyy-MM-dd') })
            current = addDays(current, 1)
        }
        return holidays
    }, [currentDate])

    // 일정 불러오기
    const fetchSchedules = async () => {
        setIsLoading(true)
        try {
            const startDate = startOfWeek(currentDate, { weekStartsOn: 0 })
            const endDate = addDays(endOfWeek(currentDate, { weekStartsOn: 0 }), 30)

            const res = await authFetch(`${API_BASE}/api/schedules?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`)

            if (res.ok) {
                const data = await res.json()
                setSchedules(data.schedules || [])
            }
        } catch (error) {
            console.error('Failed to fetch schedules:', error)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchSchedules()
    }, [currentDate])

    useEffect(() => {
        setQuickAddForm(prev => ({
            ...prev,
            startTime: toDateTimeLocalValue(focusedDate),
        }))
    }, [focusedDate])

    const filteredSchedules = useMemo(() => {
        const query = searchQuery.trim().toLowerCase()
        return schedules.filter(schedule => {
            const matchesType = typeFilter === 'all' || schedule.type === typeFilter
            if (!matchesType) return false
            if (!query) return true
            const bag = `${schedule.title} ${schedule.description || ''} ${schedule.location || ''}`.toLowerCase()
            return bag.includes(query)
        })
    }, [schedules, searchQuery, typeFilter])

    const focusDateSchedules = useMemo(() => {
        return filteredSchedules
            .filter(schedule => isSameDay(new Date(schedule.startTime), focusedDate))
            .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    }, [filteredSchedules, focusedDate])

    const nextSchedules = useMemo(() => {
        const now = new Date()
        return filteredSchedules
            .filter(schedule => new Date(schedule.startTime) >= now)
            .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
            .slice(0, 5)
    }, [filteredSchedules])

    const busiestDay = useMemo(() => {
        const counts = new Map<string, number>()
        filteredSchedules.forEach(schedule => {
            const key = format(new Date(schedule.startTime), 'yyyy-MM-dd')
            counts.set(key, (counts.get(key) || 0) + 1)
        })
        const entries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
        if (entries.length === 0) return null
        return {
            date: new Date(entries[0][0]),
            count: entries[0][1],
        }
    }, [filteredSchedules])

    const suggestedSlots = useMemo(() => getSuggestedSlots(focusedDate, schedules), [focusedDate, schedules])

    // 충돌 감지
    const checkConflicts = (startTime: string, endTime?: string | null, excludeId?: string) => {
        const filtered = schedules.filter(s => s.id !== excludeId)
        return detectConflicts({ startTime, endTime }, filtered)
    }

    // 일정 저장
    const handleSaveSchedule = async (formData: ScheduleFormData) => {
        try {
            const body = {
                ...formData,
                endTime: formData.endTime || null,
                recurrenceRule: formData.isRecurring ? formData.recurrenceRule : null,
                recurrenceEnd: formData.isRecurring && formData.recurrenceEnd ? new Date(formData.recurrenceEnd).toISOString() : null,
            }

            let res
            if (editingSchedule) {
                res = await authFetch(`${API_BASE}/api/schedules/${editingSchedule.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(body),
                })
            } else {
                res = await authFetch(`${API_BASE}/api/schedules`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(body),
                })
            }

            if (res.ok) {
                setIsModalOpen(false)
                setEditingSchedule(null)
                setConflicts([])
                fetchSchedules()
            }
        } catch (error) {
            console.error('Failed to save schedule:', error)
        }
    }

    const handleQuickAdd = async () => {
        if (!quickAddForm.title.trim()) return
        const ai = detectEventType(quickAddForm.title)
        await handleSaveSchedule({
            title: quickAddForm.title.trim(),
            description: '',
            startTime: quickAddForm.startTime,
            endTime: toDateTimeLocalValue(addHours(new Date(quickAddForm.startTime), 1)),
            type: quickAddForm.type === 'default' ? ai.type : quickAddForm.type,
            location: '',
            isAllDay: false,
            isRecurring: false,
            recurrenceRule: '',
            recurrenceEnd: '',
            color: '',
            priority: ai.priority,
            attendees: '',
        })
        setQuickAddForm({
            title: '',
            startTime: toDateTimeLocalValue(focusedDate),
            type: 'default',
        })
    }

    // 일정 삭제
    const handleDeleteSchedule = async (id: string) => {
        try {
            const res = await authFetch(`${API_BASE}/api/schedules/${id}`, {
                method: 'DELETE',
            })

            if (res.ok) {
                fetchSchedules()
                setIsModalOpen(false)
                setEditingSchedule(null)
            }
        } catch (error) {
            console.error('Failed to delete schedule:', error)
        }
    }

    // 날짜 클릭 (일정 생성)
    const handleDateClick = (date: Date) => {
        setCurrentDate(date)
        setSelectedDate(date)
        setFocusedDate(date)
        if (viewType !== 'day') {
            setViewType('day')
        }
    }

    // 일정 클릭 (수정)
    const handleEventClick = (schedule: Schedule) => {
        setEditingSchedule(schedule)
        setSelectedDate(new Date(schedule.startTime))
        setFocusedDate(new Date(schedule.startTime))
        setConflicts(checkConflicts(schedule.startTime, schedule.endTime, schedule.id))
        setIsModalOpen(true)
    }

    // 새 일정 추가
    const handleAddSchedule = () => {
        setEditingSchedule(null)
        setSelectedDate(focusedDate)
        setConflicts(checkConflicts(focusedDate.toISOString()))
        setIsModalOpen(true)
    }

    // 드래그 시작
    const handleDragStart = (schedule: Schedule, e: React.DragEvent) => {
        setDraggedSchedule(schedule)
        e.dataTransfer.effectAllowed = 'move'
    }

    const shiftCalendar = (direction: 'prev' | 'next') => {
        const multiplier = direction === 'prev' ? -1 : 1
        setCurrentDate(prev => {
            if (viewType === 'month' || viewType === 'list') {
                return multiplier < 0 ? subMonths(prev, 1) : addMonths(prev, 1)
            }
            if (viewType === 'week') {
                return addDays(prev, multiplier * 7)
            }
            return addDays(prev, multiplier)
        })
    }

    const periodLabel = useMemo(() => {
        if (viewType === 'month') return format(currentDate, 'yyyy년 MM월', { locale: ko })
        if (viewType === 'week') {
            return `${format(startOfWeek(currentDate, { weekStartsOn: 0 }), 'M월 d일', { locale: ko })} - ${format(endOfWeek(currentDate, { weekStartsOn: 0 }), 'M월 d일', { locale: ko })}`
        }
        if (viewType === 'day') return format(currentDate, 'yyyy년 MM월 dd일 EEEE', { locale: ko })
        return '검색/필터 기준 일정'
    }, [currentDate, viewType])

    // 키보드 단축키
    useHotkeys('n', () => handleAddSchedule(), { enableOnFormTags: false })
    useHotkeys('t', () => setCurrentDate(new Date()), { enableOnFormTags: false })
    useHotkeys('m', () => setViewType('month'), { enableOnFormTags: false })
    useHotkeys('w', () => setViewType('week'), { enableOnFormTags: false })
    useHotkeys('d', () => setViewType('day'), { enableOnFormTags: false })
    useHotkeys('l', () => setViewType('list'), { enableOnFormTags: false })
    useHotkeys('left', () => shiftCalendar('prev'), { enableOnFormTags: false })
    useHotkeys('right', () => shiftCalendar('next'), { enableOnFormTags: false })

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-hud-text-primary">스마트 캘린더</h1>
                    <p className="text-hud-text-muted mt-1">{periodLabel}</p>
                </div>
                <div className="flex items-center gap-3">
                    <ViewTabs currentView={viewType} onViewChange={setViewType} />
                    <Button variant="ghost" onClick={() => { setCurrentDate(new Date()); setFocusedDate(new Date()) }}>
                        오늘
                    </Button>
                    <Button variant="primary" glow leftIcon={<Plus size={18} />} onClick={handleAddSchedule}>
                        일정 추가
                    </Button>
                </div>
            </div>

            <HudCard className="overflow-hidden">
                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] gap-4">
                    <div className="rounded-2xl border border-hud-border-secondary bg-hud-bg-primary/70 p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex-1 relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-hud-text-muted" />
                                <input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="제목, 장소, 설명으로 일정 검색"
                                    className="w-full pl-9 pr-3 py-2.5 bg-hud-bg-secondary border border-hud-border-secondary rounded-xl text-sm text-hud-text-primary placeholder:text-hud-text-muted focus:outline-none focus:border-hud-accent-primary"
                                />
                            </div>
                            <Button variant="ghost" onClick={() => { setSearchQuery(''); setTypeFilter('all') }}>
                                초기화
                            </Button>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                            {[
                                { value: 'all', label: '전체' },
                                { value: 'meeting', label: '회의' },
                                { value: 'task', label: '업무' },
                                { value: 'presentation', label: '발표' },
                                { value: 'event', label: '이벤트' },
                                { value: 'break', label: '휴식' },
                            ].map((item) => (
                                <button
                                    key={item.value}
                                    type="button"
                                    onClick={() => setTypeFilter(item.value)}
                                    className={`px-3 py-1.5 rounded-full border text-xs transition-hud ${
                                        typeFilter === item.value
                                            ? 'border-hud-accent-primary bg-hud-accent-primary/15 text-hud-accent-primary'
                                            : 'border-hud-border-secondary text-hud-text-secondary hover:bg-hud-bg-hover'
                                    }`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                            <div className="rounded-xl border border-hud-border-secondary bg-hud-bg-secondary/70 p-3">
                                <p className="text-xs text-hud-text-muted">현재 필터 결과</p>
                                <p className="text-xl font-bold text-hud-text-primary mt-1">{filteredSchedules.length}</p>
                            </div>
                            <div className="rounded-xl border border-hud-border-secondary bg-hud-bg-secondary/70 p-3">
                                <p className="text-xs text-hud-text-muted">오늘 일정</p>
                                <p className="text-xl font-bold text-hud-text-primary mt-1">{filteredSchedules.filter(s => isSameDay(new Date(s.startTime), new Date())).length}</p>
                            </div>
                            <div className="rounded-xl border border-hud-border-secondary bg-hud-bg-secondary/70 p-3">
                                <p className="text-xs text-hud-text-muted">선택 날짜</p>
                                <p className="text-xl font-bold text-hud-text-primary mt-1">{focusDateSchedules.length}</p>
                            </div>
                            <div className="rounded-xl border border-hud-border-secondary bg-hud-bg-secondary/70 p-3">
                                <p className="text-xs text-hud-text-muted">반복 일정</p>
                                <p className="text-xl font-bold text-hud-text-primary mt-1">{filteredSchedules.filter(s => s.isRecurring).length}</p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-hud-accent-primary/25 bg-gradient-to-br from-hud-accent-primary/12 via-hud-bg-primary/90 to-hud-bg-secondary p-4">
                        <div className="flex items-center gap-2 text-hud-accent-primary">
                            <Target size={16} />
                            <span className="text-sm font-semibold">오늘의 포커스</span>
                        </div>
                        <div className="mt-3">
                            <p className="text-xs text-hud-text-muted">다음 일정</p>
                            {nextSchedules[0] ? (
                                <div className="mt-2 rounded-xl border border-hud-border-secondary bg-hud-bg-primary/70 p-3">
                                    <p className="text-sm font-semibold text-hud-text-primary">{nextSchedules[0].title}</p>
                                    <p className="text-xs text-hud-text-muted mt-1">
                                        {format(new Date(nextSchedules[0].startTime), 'M월 d일 HH:mm', { locale: ko })}
                                        {nextSchedules[0].location && ` · ${nextSchedules[0].location}`}
                                    </p>
                                </div>
                            ) : (
                                <p className="text-sm text-hud-text-muted mt-2">다가오는 일정이 없습니다.</p>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-4">
                            <div className="rounded-xl border border-hud-border-secondary bg-hud-bg-primary/70 p-3">
                                <p className="text-xs text-hud-text-muted">가장 바쁜 날</p>
                                <p className="text-sm font-semibold text-hud-text-primary mt-1">
                                    {busiestDay ? format(busiestDay.date, 'M월 d일', { locale: ko }) : '-'}
                                </p>
                                <p className="text-xs text-hud-text-muted mt-1">
                                    {busiestDay ? `${busiestDay.count}건` : '일정 없음'}
                                </p>
                            </div>
                            <div className="rounded-xl border border-hud-border-secondary bg-hud-bg-primary/70 p-3">
                                <p className="text-xs text-hud-text-muted">추천 빈 시간</p>
                                <p className="text-sm font-semibold text-hud-text-primary mt-1">{suggestedSlots[0] || '없음'}</p>
                                <p className="text-xs text-hud-text-muted mt-1">{format(focusedDate, 'M월 d일 기준', { locale: ko })}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </HudCard>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
                <HudCard noPadding>
                    <div className="flex items-center justify-between p-4 border-b border-hud-border-secondary">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => shiftCalendar('prev')}
                                className="p-2 rounded-lg hover:bg-hud-bg-hover text-hud-text-secondary hover:text-hud-text-primary transition-hud"
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <button
                                onClick={() => setCurrentDate(new Date())}
                                className="px-3 py-1 rounded-lg hover:bg-hud-bg-hover text-hud-text-primary font-medium transition-hud"
                            >
                                {periodLabel}
                            </button>
                            <button
                                onClick={() => shiftCalendar('next')}
                                className="p-2 rounded-lg hover:bg-hud-bg-hover text-hud-text-secondary hover:text-hud-text-primary transition-hud"
                            >
                                <ChevronRight size={20} />
                            </button>
                        </div>

                        <div className="hidden md:flex items-center gap-4 text-xs text-hud-text-muted">
                            <span>날짜 클릭: 일간 보기로 확대</span>
                            <span>N: 새 일정</span>
                            <span>←→: 기간 이동</span>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="p-12 text-center text-hud-text-muted">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-hud-accent-primary"></div>
                            <p className="mt-4">일정을 불러오는 중...</p>
                        </div>
                    ) : (
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={viewType}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                            >
                                {viewType === 'month' && (
                                    <MonthView
                                        currentDate={currentDate}
                                        schedules={filteredSchedules}
                                        onDateClick={handleDateClick}
                                        onEventClick={handleEventClick}
                                        onDragStart={handleDragStart}
                                        holidays={holidaysInMonth}
                                    />
                                )}
                                {viewType === 'week' && (
                                    <WeekView
                                        currentDate={currentDate}
                                        schedules={filteredSchedules}
                                        onDateClick={handleDateClick}
                                        onEventClick={handleEventClick}
                                        onDragStart={handleDragStart}
                                        holidays={holidaysInWeek}
                                    />
                                )}
                                {viewType === 'day' && (
                                    <DayView
                                        currentDate={currentDate}
                                        schedules={filteredSchedules.filter(s => isSameDay(new Date(s.startTime), currentDate))}
                                        onEventClick={handleEventClick}
                                        onDragStart={handleDragStart}
                                        holidays={holidaysInWeek}
                                    />
                                )}
                                {viewType === 'list' && (
                                    <ListView
                                        schedules={filteredSchedules}
                                        onEventClick={handleEventClick}
                                    />
                                )}
                            </motion.div>
                        </AnimatePresence>
                    )}
                </HudCard>

                <div className="space-y-4">
                    <HudCard title="빠른 일정 추가" subtitle="복잡한 모달 없이 바로 입력">
                        <div className="space-y-3">
                            <input
                                value={quickAddForm.title}
                                onChange={(e) => setQuickAddForm(prev => ({ ...prev, title: e.target.value }))}
                                placeholder="예: 팀 주간회의, 매물 촬영, 계약 미팅"
                                className="w-full px-3 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-xl text-sm text-hud-text-primary placeholder:text-hud-text-muted focus:outline-none focus:border-hud-accent-primary"
                            />
                            <input
                                type="datetime-local"
                                value={quickAddForm.startTime}
                                onChange={(e) => setQuickAddForm(prev => ({ ...prev, startTime: e.target.value }))}
                                className="w-full px-3 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-xl text-sm text-hud-text-primary focus:outline-none focus:border-hud-accent-primary"
                            />
                            <select
                                value={quickAddForm.type}
                                onChange={(e) => setQuickAddForm(prev => ({ ...prev, type: e.target.value }))}
                                className="w-full px-3 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-xl text-sm text-hud-text-primary focus:outline-none focus:border-hud-accent-primary"
                            >
                                <option value="default">자동 추천</option>
                                <option value="meeting">회의</option>
                                <option value="task">업무</option>
                                <option value="presentation">발표</option>
                                <option value="event">이벤트</option>
                                <option value="break">휴식</option>
                            </select>
                            <div className="flex gap-2">
                                <Button variant="primary" className="flex-1" leftIcon={<Plus size={16} />} onClick={handleQuickAdd}>
                                    빠르게 저장
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={() => {
                                        setSelectedDate(focusedDate)
                                        setEditingSchedule(null)
                                        setConflicts(checkConflicts(focusedDate.toISOString()))
                                        setIsModalOpen(true)
                                    }}
                                >
                                    상세 입력
                                </Button>
                            </div>
                        </div>
                    </HudCard>

                    <HudCard
                        title="선택한 날짜 일정"
                        subtitle={format(focusedDate, 'M월 d일 EEEE', { locale: ko })}
                        action={
                            <button
                                onClick={() => handleDateClick(new Date())}
                                className="text-xs text-hud-accent-primary hover:underline"
                            >
                                오늘로 이동
                            </button>
                        }
                    >
                        <div className="space-y-2">
                            {focusDateSchedules.length > 0 ? (
                                focusDateSchedules.map(schedule => {
                                    const colors = getEventColor(schedule.type, schedule.priority)
                                    return (
                                        <button
                                            key={schedule.id}
                                            onClick={() => handleEventClick(schedule)}
                                            className={`w-full text-left rounded-xl border ${colors.border} ${colors.bg} px-3 py-3 transition-hud hover:opacity-90`}
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className={`font-medium truncate ${colors.text}`}>{schedule.title}</p>
                                                    <p className="text-xs text-hud-text-muted mt-1">
                                                        {schedule.isAllDay ? '하루 종일' : formatTime(schedule.startTime)}
                                                        {schedule.endTime && !schedule.isAllDay && ` ~ ${formatTime(schedule.endTime)}`}
                                                    </p>
                                                </div>
                                                <ArrowRight size={14} className="text-hud-text-muted flex-shrink-0" />
                                            </div>
                                        </button>
                                    )
                                })
                            ) : (
                                <div className="rounded-xl border border-dashed border-hud-border-secondary p-4 text-sm text-hud-text-muted">
                                    선택한 날짜에 일정이 없습니다.
                                </div>
                            )}
                        </div>
                    </HudCard>

                    <HudCard title="추천 빈 시간" subtitle="현재 선택 날짜 기준">
                        <div className="space-y-2">
                            {suggestedSlots.length > 0 ? (
                                suggestedSlots.map(slot => (
                                    <div key={slot} className="rounded-xl border border-hud-border-secondary bg-hud-bg-primary px-3 py-2 text-sm text-hud-text-primary">
                                        {slot}
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-hud-text-muted">빈 시간이 거의 없습니다. 시간을 나눠서 보세요.</p>
                            )}
                        </div>
                    </HudCard>

                    <HudCard title="곧 다가오는 일정" subtitle="다음 5개 일정">
                        <div className="space-y-2">
                            {nextSchedules.length > 0 ? (
                                nextSchedules.map(schedule => (
                                    <button
                                        key={schedule.id}
                                        onClick={() => handleEventClick(schedule)}
                                        className="w-full text-left rounded-xl border border-hud-border-secondary bg-hud-bg-primary px-3 py-3 hover:bg-hud-bg-hover transition-hud"
                                    >
                                        <p className="text-sm font-medium text-hud-text-primary">{schedule.title}</p>
                                        <p className="text-xs text-hud-text-muted mt-1">
                                            {format(new Date(schedule.startTime), 'M월 d일 HH:mm', { locale: ko })}
                                            {schedule.location && ` · ${schedule.location}`}
                                        </p>
                                        <p className="text-xs text-hud-text-muted mt-1">{getTypeLabel(schedule.type)}</p>
                                    </button>
                                ))
                            ) : (
                                <p className="text-sm text-hud-text-muted">예정된 일정이 없습니다.</p>
                            )}
                        </div>
                    </HudCard>
                </div>
            </div>

            {/* Schedule Modal */}
            <ScheduleModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false)
                    setEditingSchedule(null)
                    setConflicts([])
                }}
                onSave={handleSaveSchedule}
                onDelete={handleDeleteSchedule}
                schedule={editingSchedule}
                selectedDate={selectedDate || undefined}
                conflicts={conflicts}
            />
        </div>
    )
}

export default Calendar
