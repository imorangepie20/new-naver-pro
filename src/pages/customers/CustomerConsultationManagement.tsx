import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
    ClipboardList,
    MessageSquareText,
    Phone,
    RefreshCw,
    Save,
    Trash2,
    User,
    X,
} from 'lucide-react'
import Button from '../../components/common/Button'
import { API_BASE } from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'

interface CustomerSuggestion {
    id: string
    key: string
    customerName: string
    customerPhone: string | null
    contractCount: number
}

interface CustomerConsultation {
    id: string
    customerInfoId?: string | null
    customerName: string
    customerPhone?: string | null
    content: string
    consultedAt: string
    createdAt: string
    updatedAt: string
}

interface ConsultationGroup {
    key: string
    customerInfoId?: string | null
    customerName: string
    customerPhone?: string | null
    consultations: CustomerConsultation[]
}

const GROUPS_PER_PAGE = 6

const emptyForm = {
    customerInfoId: '',
    customerName: '',
    customerPhone: '',
    content: '',
}

function normalizeName(value?: string | null) {
    return (value || '').trim().replace(/\s+/g, ' ').toLowerCase()
}

function normalizePhone(value?: string | null) {
    return (value || '').replace(/\D/g, '')
}

function formatPhone(phone?: string | null) {
    const digits = normalizePhone(phone)
    if (!digits) return '연락처 없음'
    if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
    if (digits.length === 10) {
        if (digits.startsWith('02')) return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`
        return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
    }
    return phone || digits
}

function formatDateTime(dateStr?: string | null) {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    if (Number.isNaN(date.getTime())) return '-'
    return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    })
}

function getConsultationGroupKey(consultation: CustomerConsultation) {
    if (consultation.customerInfoId) return `customer:${consultation.customerInfoId}`
    return `manual:${normalizeName(consultation.customerName)}:${normalizePhone(consultation.customerPhone)}`
}

function getVisiblePageNumbers(currentPage: number, totalPages: number) {
    const maxVisiblePages = 5

    if (totalPages <= maxVisiblePages) {
        return Array.from({ length: totalPages }, (_, index) => index + 1)
    }

    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2))
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)

    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1)
    }

    return Array.from({ length: endPage - startPage + 1 }, (_, index) => startPage + index)
}

function resizeTextarea(element: HTMLTextAreaElement | null) {
    if (!element) return
    element.style.height = 'auto'
    element.style.overflowY = 'hidden'
    element.style.height = `${element.scrollHeight}px`
}

export default function CustomerConsultationManagement() {
    const authFetch = useAuthStore((state) => state.authFetch)
    const [searchParams] = useSearchParams()
    const [customers, setCustomers] = useState<CustomerSuggestion[]>([])
    const [consultations, setConsultations] = useState<CustomerConsultation[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [form, setForm] = useState(emptyForm)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [currentPage, setCurrentPage] = useState(1)
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [hasAppliedPreset, setHasAppliedPreset] = useState(false)
    const [editingConsultationId, setEditingConsultationId] = useState<string | null>(null)
    const [consultationDrafts, setConsultationDrafts] = useState<Record<string, string>>({})
    const [consultationErrors, setConsultationErrors] = useState<Record<string, string | null>>({})
    const [savingConsultationIds, setSavingConsultationIds] = useState<Record<string, boolean>>({})
    const [deletingConsultationIds, setDeletingConsultationIds] = useState<Record<string, boolean>>({})
    const customerNameFieldRef = useRef<HTMLInputElement | null>(null)
    const contentFieldRef = useRef<HTMLTextAreaElement | null>(null)
    const consultationFieldRefs = useRef<Record<string, HTMLTextAreaElement | null>>({})

    const fetchData = async () => {
        try {
            setLoading(true)
            setError(null)

            const [customerResponse, consultationResponse] = await Promise.all([
                authFetch(`${API_BASE}/api/customer-info`),
                authFetch(`${API_BASE}/api/customer-consultations`),
            ])

            if (!customerResponse.ok) {
                const data = await customerResponse.json().catch(() => ({}))
                throw new Error(data.error || '고객 정보를 불러오지 못했습니다.')
            }

            if (!consultationResponse.ok) {
                const data = await consultationResponse.json().catch(() => ({}))
                throw new Error(data.error || '고객 상담 기록을 불러오지 못했습니다.')
            }

            const customerData = await customerResponse.json()
            const consultationData = await consultationResponse.json()
            const nextCustomers: CustomerSuggestion[] = Array.isArray(customerData.customers) ? customerData.customers : []
            const nextConsultations: CustomerConsultation[] = Array.isArray(consultationData.consultations) ? consultationData.consultations : []

            setCustomers(nextCustomers)
            setConsultations(nextConsultations)
            setConsultationDrafts(
                nextConsultations.reduce<Record<string, string>>((acc, consultation) => {
                    acc[consultation.id] = consultation.content
                    return acc
                }, {}),
            )
            setConsultationErrors({})
            setEditingConsultationId(null)
        } catch (err) {
            console.error('Customer consultation fetch failed:', err)
            setError(err instanceof Error ? err.message : '고객 상담 데이터를 불러오지 못했습니다.')
            setCustomers([])
            setConsultations([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void fetchData()
    }, [])

    useEffect(() => {
        const presetCustomerId = searchParams.get('customerId')
        if (!presetCustomerId || hasAppliedPreset || customers.length === 0) return

        const presetCustomer = customers.find((customer) => customer.id === presetCustomerId)
        if (!presetCustomer) return

        setForm((prev) => ({
            ...prev,
            customerInfoId: presetCustomer.id,
            customerName: presetCustomer.customerName,
            customerPhone: presetCustomer.customerPhone || '',
        }))
        setShowSuggestions(false)
        setHasAppliedPreset(true)

        if (typeof window !== 'undefined') {
            window.requestAnimationFrame(() => {
                contentFieldRef.current?.focus()
            })
        }
    }, [customers, hasAppliedPreset, searchParams])

    useEffect(() => {
        resizeTextarea(contentFieldRef.current)
    }, [form.content])

    useEffect(() => {
        consultations.forEach((consultation) => {
            resizeTextarea(consultationFieldRefs.current[consultation.id])
        })
    }, [consultations, consultationDrafts, editingConsultationId])

    const filteredSuggestions = useMemo(() => {
        const term = form.customerName.trim().toLowerCase()
        if (!term) return []

        return customers
            .filter((customer) =>
                `${customer.customerName} ${customer.customerPhone || ''}`.toLowerCase().includes(term),
            )
            .slice(0, 8)
    }, [customers, form.customerName])

    const groupedConsultations = useMemo(() => {
        const groupMap = consultations.reduce<Map<string, ConsultationGroup>>((acc, consultation) => {
            const key = getConsultationGroupKey(consultation)
            const existing = acc.get(key)
            if (existing) {
                existing.consultations.push(consultation)
                return acc
            }

            acc.set(key, {
                key,
                customerInfoId: consultation.customerInfoId || null,
                customerName: consultation.customerName,
                customerPhone: consultation.customerPhone || null,
                consultations: [consultation],
            })
            return acc
        }, new Map())

        return Array.from(groupMap.values())
            .map((group) => ({
                ...group,
                consultations: [...group.consultations].sort(
                    (a, b) => new Date(b.consultedAt).getTime() - new Date(a.consultedAt).getTime(),
                ),
            }))
            .sort((a, b) => {
                const aTime = new Date(a.consultations[0]?.consultedAt || 0).getTime()
                const bTime = new Date(b.consultations[0]?.consultedAt || 0).getTime()
                return bTime - aTime
            })
    }, [consultations])

    const totalPages = Math.max(1, Math.ceil(groupedConsultations.length / GROUPS_PER_PAGE))
    const pagedConsultationGroups = useMemo(() => {
        const startIndex = (currentPage - 1) * GROUPS_PER_PAGE
        return groupedConsultations.slice(startIndex, startIndex + GROUPS_PER_PAGE)
    }, [currentPage, groupedConsultations])
    const visiblePageNumbers = useMemo(
        () => getVisiblePageNumbers(currentPage, totalPages),
        [currentPage, totalPages],
    )
    const currentRangeStart = groupedConsultations.length === 0 ? 0 : (currentPage - 1) * GROUPS_PER_PAGE + 1
    const currentRangeEnd = groupedConsultations.length === 0
        ? 0
        : Math.min(currentPage * GROUPS_PER_PAGE, groupedConsultations.length)

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages)
        }
    }, [currentPage, totalPages])

    const handleSelectCustomer = (customer: CustomerSuggestion) => {
        setForm((prev) => ({
            ...prev,
            customerInfoId: customer.id,
            customerName: customer.customerName,
            customerPhone: customer.customerPhone || '',
        }))
        setShowSuggestions(false)

        if (typeof window !== 'undefined') {
            window.requestAnimationFrame(() => {
                contentFieldRef.current?.focus()
            })
        }
    }

    const handleCustomerNameChange = (value: string) => {
        setForm((prev) => {
            const selectedCustomer = customers.find((customer) => customer.id === prev.customerInfoId)
            const shouldClearSelectedCustomer = !!selectedCustomer && selectedCustomer.customerName !== value

            return {
                ...prev,
                customerInfoId: shouldClearSelectedCustomer ? '' : prev.customerInfoId,
                customerPhone: shouldClearSelectedCustomer ? '' : prev.customerPhone,
                customerName: value,
            }
        })
        setShowSuggestions(true)
    }

    const handleCustomerPhoneChange = (value: string) => {
        setForm((prev) => {
            const selectedCustomer = customers.find((customer) => customer.id === prev.customerInfoId)
            const shouldClearSelectedCustomer = !!selectedCustomer && (selectedCustomer.customerPhone || '') !== value

            return {
                ...prev,
                customerInfoId: shouldClearSelectedCustomer ? '' : prev.customerInfoId,
                customerPhone: value,
            }
        })
    }

    const handleContentChange = (value: string, field?: HTMLTextAreaElement | null) => {
        resizeTextarea(field || null)
        setForm((prev) => ({
            ...prev,
            content: value,
        }))
    }

    const handleSubmit = async () => {
        if (!form.customerName.trim()) {
            setError('고객명을 입력해야 합니다.')
            return
        }

        if (!form.content.trim()) {
            setError('상담 내용을 입력해야 합니다.')
            return
        }

        try {
            setIsSubmitting(true)
            setError(null)

            const response = await authFetch(`${API_BASE}/api/customer-consultations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    customerInfoId: form.customerInfoId || null,
                    customerName: form.customerName,
                    customerPhone: form.customerPhone || null,
                    content: form.content,
                }),
            })

            if (!response.ok) {
                const data = await response.json().catch(() => ({}))
                throw new Error(data.error || '상담 기록을 저장하지 못했습니다.')
            }

            await fetchData()
            setForm({ ...emptyForm })
            setShowSuggestions(false)
            setCurrentPage(1)
            if (typeof window !== 'undefined') {
                window.requestAnimationFrame(() => {
                    customerNameFieldRef.current?.focus()
                })
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '상담 기록을 저장하지 못했습니다.')
        } finally {
            setIsSubmitting(false)
        }
    }

    const activateConsultationEditor = (consultationId: string) => {
        if (savingConsultationIds[consultationId] || deletingConsultationIds[consultationId]) return

        setEditingConsultationId(consultationId)
        setConsultationErrors((prev) => ({
            ...prev,
            [consultationId]: null,
        }))

        if (typeof window !== 'undefined') {
            window.requestAnimationFrame(() => {
                const field = consultationFieldRefs.current[consultationId]
                if (!field) return
                field.focus()
                const cursor = field.value.length
                field.setSelectionRange(cursor, cursor)
            })
        }
    }

    const handleConsultationChange = (
        consultationId: string,
        value: string,
        field?: HTMLTextAreaElement | null,
    ) => {
        resizeTextarea(field || null)
        setConsultationDrafts((prev) => ({
            ...prev,
            [consultationId]: value,
        }))
        setConsultationErrors((prev) => ({
            ...prev,
            [consultationId]: null,
        }))
    }

    const handleConsultationSave = async (consultation: CustomerConsultation, nextContentOverride?: string) => {
        const nextContent = (nextContentOverride ?? consultationDrafts[consultation.id] ?? '').trim()
        if (!nextContent || nextContent === consultation.content) {
            setConsultationErrors((prev) => ({
                ...prev,
                [consultation.id]: nextContent ? null : '상담 내용을 비워둘 수 없습니다.',
            }))
            return
        }

        try {
            setSavingConsultationIds((prev) => ({
                ...prev,
                [consultation.id]: true,
            }))
            setConsultationErrors((prev) => ({
                ...prev,
                [consultation.id]: null,
            }))

            const response = await authFetch(`${API_BASE}/api/customer-consultations/${consultation.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content: nextContent,
                }),
            })

            if (!response.ok) {
                const data = await response.json().catch(() => ({}))
                throw new Error(data.error || '상담 기록을 수정하지 못했습니다.')
            }

            const data = await response.json()
            const updatedConsultation = data.consultation as CustomerConsultation
            setConsultations((prev) =>
                prev.map((item) => (item.id === consultation.id ? updatedConsultation : item)),
            )
            setConsultationDrafts((prev) => ({
                ...prev,
                [consultation.id]: updatedConsultation.content,
            }))
        } catch (err) {
            setConsultationErrors((prev) => ({
                ...prev,
                [consultation.id]: err instanceof Error ? err.message : '상담 기록을 수정하지 못했습니다.',
            }))
        } finally {
            setSavingConsultationIds((prev) => ({
                ...prev,
                [consultation.id]: false,
            }))
        }
    }

    const handleConsultationBlur = (consultation: CustomerConsultation) => {
        if (editingConsultationId === consultation.id) {
            setEditingConsultationId(null)
        }

        const nextContent = consultationDrafts[consultation.id] ?? ''
        if (nextContent === consultation.content) return

        void handleConsultationSave(consultation, nextContent)
    }

    const handleDeleteConsultation = async (consultation: CustomerConsultation) => {
        const confirmed = confirm('이 상담 기록을 삭제하시겠습니까?')
        if (!confirmed) return

        try {
            setDeletingConsultationIds((prev) => ({
                ...prev,
                [consultation.id]: true,
            }))
            setConsultationErrors((prev) => ({
                ...prev,
                [consultation.id]: null,
            }))

            const response = await authFetch(`${API_BASE}/api/customer-consultations/${consultation.id}`, {
                method: 'DELETE',
            })

            if (!response.ok) {
                const data = await response.json().catch(() => ({}))
                throw new Error(data.error || '상담 기록을 삭제하지 못했습니다.')
            }

            setConsultations((prev) => prev.filter((item) => item.id !== consultation.id))
            setConsultationDrafts((prev) => {
                const next = { ...prev }
                delete next[consultation.id]
                return next
            })
        } catch (err) {
            setConsultationErrors((prev) => ({
                ...prev,
                [consultation.id]: err instanceof Error ? err.message : '상담 기록을 삭제하지 못했습니다.',
            }))
        } finally {
            setDeletingConsultationIds((prev) => ({
                ...prev,
                [consultation.id]: false,
            }))
        }
    }

    return (
        <div className="relative overflow-hidden p-4 sm:p-5">
            <div
                className="pointer-events-none absolute inset-x-0 top-0 h-[360px] opacity-90"
                style={{
                    background: 'radial-gradient(circle at 0% 0%, rgba(var(--hud-accent-primary-rgb, 0, 255, 204), 0.18), transparent 32%), radial-gradient(circle at 100% 12%, rgba(var(--hud-accent-primary-rgb, 0, 255, 204), 0.12), transparent 24%), linear-gradient(180deg, rgba(var(--hud-accent-primary-rgb, 0, 255, 204), 0.06) 0%, transparent 58%)',
                }}
            />

            <div className="relative space-y-4">
                <div className="hud-card hud-card-bottom overflow-hidden border-hud-border-primary/35 px-4 py-4 sm:px-5 sm:py-5">
                    <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="max-w-3xl space-y-3">
                            <div className="inline-flex items-center gap-2 rounded-full border border-hud-accent-primary/20 bg-hud-accent-primary/10 px-3 py-1 text-xs font-semibold tracking-[0.12em] text-hud-accent-primary">
                                <MessageSquareText className="h-3.5 w-3.5" />
                                CUSTOMER CONSULTATION
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-hud-text-primary sm:text-3xl">고객상담관리</h1>
                                <p className="mt-2 text-sm leading-6 text-hud-text-secondary sm:text-base">
                                    고객정보를 기반으로 상담 기록을 저장하고, 고객별로 최신 상담 이력을 관리합니다.
                                </p>
                            </div>
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void fetchData()}
                            className="border-hud-border-secondary bg-hud-bg-card/70 text-hud-text-secondary hover:text-hud-text-primary"
                            leftIcon={<RefreshCw className="h-4 w-4" />}
                        >
                            새로고침
                        </Button>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
                        <div className="rounded-[var(--hud-base-border-radius)] border border-hud-border-primary/30 bg-hud-bg-card p-4 shadow-hud">
                            <div className="flex items-center gap-2 border-b border-hud-border-secondary pb-3">
                                <ClipboardList className="h-4 w-4 text-hud-accent-primary" />
                                <h2 className="text-sm font-semibold text-hud-text-primary">상담 기록 등록</h2>
                            </div>

                            <div className="mt-4 space-y-4">
                                <div className="relative">
                                    <label className="mb-1 block text-[11px] font-semibold tracking-[0.08em] text-hud-text-secondary">고객명</label>
                                    <div className="relative rounded-xl border border-hud-border-primary/50 bg-hud-bg-secondary/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_24px_rgba(15,23,42,0.08)] transition-hud focus-within:border-hud-accent-primary/35 focus-within:bg-hud-bg-card/95">
                                        <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-hud-text-secondary" />
                                        <input
                                            ref={customerNameFieldRef}
                                            type="text"
                                            value={form.customerName}
                                            onChange={(e) => handleCustomerNameChange(e.target.value)}
                                            onFocus={() => setShowSuggestions(true)}
                                            onBlur={() => {
                                                if (typeof window !== 'undefined') {
                                                    window.setTimeout(() => setShowSuggestions(false), 120)
                                                }
                                            }}
                                            placeholder="고객명을 입력하세요"
                                            className="w-full rounded-xl border-0 bg-transparent py-2.5 pl-10 pr-10 text-sm text-hud-text-primary placeholder-hud-text-secondary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/20"
                                        />
                                        {form.customerName && (
                                            <button
                                                type="button"
                                                onClick={() => setForm((prev) => ({ ...prev, customerInfoId: '', customerName: '', customerPhone: '' }))}
                                                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-hud-text-secondary hover:bg-hud-bg-hover hover:text-hud-text-primary"
                                                aria-label="고객명 지우기"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>

                                    {showSuggestions && filteredSuggestions.length > 0 && (
                                        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-hud-border-secondary bg-hud-bg-card shadow-hud">
                                            {filteredSuggestions.map((customer) => (
                                                <button
                                                    key={customer.id}
                                                    type="button"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault()
                                                        handleSelectCustomer(customer)
                                                    }}
                                                    className="flex w-full items-center justify-between gap-3 border-b border-hud-border-secondary/70 px-3 py-2.5 text-left last:border-b-0 hover:bg-hud-bg-hover"
                                                >
                                                    <span className="min-w-0">
                                                        <span className="block truncate text-sm font-medium text-hud-text-primary">{customer.customerName}</span>
                                                        <span className="mt-0.5 block truncate text-xs text-hud-text-secondary">
                                                            {formatPhone(customer.customerPhone)}
                                                        </span>
                                                    </span>
                                                    <span className="shrink-0 rounded-full border border-hud-border-secondary bg-hud-bg-secondary/80 px-2 py-0.5 text-[11px] text-hud-text-secondary">
                                                        매물 {customer.contractCount}건
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="mb-1 block text-[11px] font-semibold tracking-[0.08em] text-hud-text-secondary">전화번호</label>
                                    <div className="relative rounded-xl border border-hud-border-primary/50 bg-hud-bg-secondary/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_24px_rgba(15,23,42,0.08)] transition-hud focus-within:border-hud-accent-primary/35 focus-within:bg-hud-bg-card/95">
                                        <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-hud-text-secondary" />
                                        <input
                                            type="text"
                                            value={form.customerPhone}
                                            onChange={(e) => handleCustomerPhoneChange(e.target.value)}
                                            placeholder="직접 입력하거나 자동 채움"
                                            className="w-full rounded-xl border-0 bg-transparent py-2.5 pl-10 pr-4 text-sm text-hud-text-primary placeholder-hud-text-secondary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/20"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-1 block text-[11px] font-semibold tracking-[0.08em] text-hud-text-secondary">상담 내용</label>
                                    <textarea
                                        ref={(element) => {
                                            contentFieldRef.current = element
                                            resizeTextarea(element)
                                        }}
                                        value={form.content}
                                        onChange={(e) => handleContentChange(e.target.value, e.currentTarget)}
                                        rows={4}
                                        placeholder="상담 내용을 입력하세요."
                                        className="min-h-[112px] w-full overflow-hidden resize-none rounded-xl border border-hud-border-primary/50 bg-hud-bg-secondary/90 px-3 py-3 text-sm leading-6 text-hud-text-primary placeholder-hud-text-secondary shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_24px_rgba(15,23,42,0.08)] transition-hud focus:border-hud-accent-primary/35 focus:bg-hud-bg-card/95 focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/20"
                                    />
                                </div>

                                <div className="rounded-xl border border-hud-border-secondary bg-hud-bg-secondary/55 px-3 py-3 text-xs leading-5 text-hud-text-secondary">
                                    고객명 입력을 시작하면 기존 고객정보에서 이름과 전화번호를 제안합니다. 직접 입력한 고객도 저장 시 고객정보에 함께 등록됩니다.
                                </div>

                                {error && (
                                    <div className="rounded-xl border border-hud-accent-danger/30 bg-hud-accent-danger/10 px-3 py-3 text-sm text-hud-accent-danger">
                                        {error}
                                    </div>
                                )}

                                <Button
                                    onClick={() => void handleSubmit()}
                                    disabled={isSubmitting}
                                    fullWidth
                                    leftIcon={<Save className="h-4 w-4" />}
                                >
                                    {isSubmitting ? '상담 기록 저장 중...' : '상담 기록 저장'}
                                </Button>
                            </div>
                        </div>

                        <div className="rounded-[var(--hud-base-border-radius)] border border-hud-border-primary/30 bg-hud-bg-card shadow-hud">
                            <div className="border-b border-hud-border-secondary px-4 py-3">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <p className="text-[11px] font-semibold tracking-[0.08em] text-hud-text-secondary">CONSULTATION HISTORY</p>
                                        <h2 className="mt-1 text-sm font-semibold text-hud-text-primary">고객별 상담 기록</h2>
                                    </div>
                                    <span className="rounded-full border border-hud-border-secondary bg-hud-bg-secondary/80 px-3 py-1 text-xs font-medium text-hud-text-primary">
                                        고객 {groupedConsultations.length}명
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-4 p-4">
                                {loading ? (
                                    <div className="flex items-center justify-center py-16 text-hud-text-secondary">불러오는 중...</div>
                                ) : groupedConsultations.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-hud-border-secondary bg-hud-bg-secondary/45 px-4 py-12 text-center">
                                        <MessageSquareText className="mx-auto h-8 w-8 text-hud-text-secondary" />
                                        <p className="mt-3 text-base font-semibold text-hud-text-primary">등록된 상담 기록이 없습니다.</p>
                                        <p className="mt-2 text-sm text-hud-text-secondary">왼쪽 입력폼에서 첫 상담 기록을 등록하세요.</p>
                                    </div>
                                ) : (
                                    pagedConsultationGroups.map((group) => (
                                        <div
                                            key={group.key}
                                            className="overflow-hidden rounded-[var(--hud-base-border-radius)] border border-hud-border-primary/25 bg-hud-bg-secondary/30"
                                        >
                                            <div className="border-b border-hud-border-secondary bg-hud-bg-secondary/35 px-4 py-3">
                                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                    <div>
                                                        <p className="text-base font-semibold text-hud-text-primary">{group.customerName}</p>
                                                        <p className="mt-1 text-sm text-hud-text-secondary">{formatPhone(group.customerPhone)}</p>
                                                    </div>
                                                    <span className="rounded-full border border-hud-border-secondary bg-hud-bg-card px-3 py-1 text-xs font-medium text-hud-text-primary">
                                                        상담 {group.consultations.length}건
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="space-y-3 p-4">
                                                {group.consultations.map((consultation) => {
                                                    const isEditing = editingConsultationId === consultation.id
                                                    const isSaving = Boolean(savingConsultationIds[consultation.id])
                                                    const isDeleting = Boolean(deletingConsultationIds[consultation.id])
                                                    const draft = consultationDrafts[consultation.id] ?? consultation.content

                                                    return (
                                                        <div
                                                            key={consultation.id}
                                                            className="rounded-xl border border-hud-border-secondary bg-hud-bg-card px-4 py-3"
                                                        >
                                                            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                                <div className="flex flex-wrap items-center gap-2 text-xs text-hud-text-secondary">
                                                                    <span className="rounded-full border border-hud-border-secondary bg-hud-bg-secondary/70 px-2.5 py-1">
                                                                        상담일시 {formatDateTime(consultation.consultedAt)}
                                                                    </span>
                                                                    <span className="rounded-full border border-hud-border-secondary bg-hud-bg-secondary/70 px-2.5 py-1">
                                                                        수정일 {formatDateTime(consultation.updatedAt)}
                                                                    </span>
                                                                </div>
                                                                <Button
                                                                    type="button"
                                                                    variant="danger"
                                                                    size="sm"
                                                                    onClick={() => void handleDeleteConsultation(consultation)}
                                                                    disabled={isDeleting}
                                                                >
                                                                    <span className="inline-flex items-center gap-1.5">
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                        {isDeleting ? '삭제 중...' : '삭제'}
                                                                    </span>
                                                                </Button>
                                                            </div>

                                                            <textarea
                                                                ref={(element) => {
                                                                    consultationFieldRefs.current[consultation.id] = element
                                                                    resizeTextarea(element)
                                                                }}
                                                                value={draft}
                                                                readOnly={!isEditing}
                                                                onDoubleClick={() => activateConsultationEditor(consultation.id)}
                                                                onChange={(e) => handleConsultationChange(consultation.id, e.target.value, e.currentTarget)}
                                                                onBlur={() => handleConsultationBlur(consultation)}
                                                                rows={1}
                                                                className={`w-full overflow-hidden resize-none rounded-xl border px-3 py-3 text-sm leading-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_24px_rgba(15,23,42,0.08)] transition-hud focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/20 ${isEditing
                                                                    ? 'border-hud-accent-primary/40 bg-hud-bg-card/95 text-hud-text-primary'
                                                                    : 'cursor-text border-hud-border-primary/50 bg-hud-bg-secondary/85 text-hud-text-primary'
                                                                    } ${isSaving || isDeleting ? 'opacity-70' : ''}`}
                                                            />
                                                            <p className="mt-2 text-[11px] text-hud-text-secondary">
                                                                {isSaving ? '상담 내용 저장 중...' : isEditing ? '포커스를 잃으면 저장됩니다.' : '더블클릭하면 상담 내용을 수정할 수 있습니다.'}
                                                            </p>
                                                            {consultationErrors[consultation.id] && (
                                                                <p className="mt-2 text-sm text-hud-accent-danger">{consultationErrors[consultation.id]}</p>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {groupedConsultations.length > 0 && (
                                <div className="flex flex-col gap-3 border-t border-hud-border-secondary bg-hud-bg-secondary/25 px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                                    <span className="text-hud-text-secondary">
                                        {`${currentRangeStart}-${currentRangeEnd} / ${groupedConsultations.length}명`}
                                    </span>
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                            disabled={currentPage === 1}
                                            className="rounded-md border border-hud-border-secondary px-3 py-1.5 text-hud-text-primary disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            이전
                                        </button>
                                        {visiblePageNumbers.map((pageNumber) => (
                                            <button
                                                key={pageNumber}
                                                type="button"
                                                onClick={() => setCurrentPage(pageNumber)}
                                                className={`min-w-[36px] rounded-md border px-3 py-1.5 ${pageNumber === currentPage
                                                    ? 'border-hud-accent-primary/40 bg-hud-accent-primary/10 text-hud-accent-primary'
                                                    : 'border-hud-border-secondary text-hud-text-primary'
                                                    }`}
                                                aria-current={pageNumber === currentPage ? 'page' : undefined}
                                            >
                                                {pageNumber}
                                            </button>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                                            disabled={currentPage === totalPages}
                                            className="rounded-md border border-hud-border-secondary px-3 py-1.5 text-hud-text-primary disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            다음
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
