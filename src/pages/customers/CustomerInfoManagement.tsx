import { Fragment, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    AlertTriangle,
    ClipboardList,
    MessageSquareText,
    Phone,
    RefreshCw,
    Search,
    Sparkles,
    Trash2,
    X,
} from 'lucide-react'
import Button from '../../components/common/Button'
import { API_BASE } from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'

const ITEMS_PER_PAGE = 10

interface CustomerContract {
    id: string
    articleName: string
    buildingName?: string | null
    address?: string | null
    contractType: string
    propertyType?: string | null
    contractDate: string
    contractEndDate: string
    tenantName?: string | null
    tenantPhone?: string | null
    notes?: string | null
    updatedAt: string
}

interface CustomerInfoItem {
    id: string
    key: string
    customerName: string
    customerPhone: string | null
    memo: string | null
    createdAt: string | null
    updatedAt: string | null
    contractCount: number
    contracts: CustomerContract[]
}

function normalizePhone(phone?: string | null) {
    return (phone || '').replace(/\D/g, '')
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

function formatDate(dateStr?: string | null) {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    if (Number.isNaN(date.getTime())) return '-'
    return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    })
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

function formatArticleDisplay(contract: Pick<CustomerContract, 'articleName' | 'buildingName' | 'address' | 'propertyType'>) {
    const location = contract.buildingName || contract.address || null
    const propertyType = contract.propertyType || null
    const suffixParts = [location, propertyType].filter(Boolean)

    if (suffixParts.length === 0) return contract.articleName
    return `${contract.articleName} / ${suffixParts.join(' · ')}`
}

function getContractPreviewMeta(contracts: CustomerContract[], limit = 2) {
    const previewItems = contracts.slice(0, limit).map((contract) => ({
        id: contract.id,
        label: formatArticleDisplay(contract),
    }))

    return {
        previewItems,
        remainingCount: Math.max(0, contracts.length - previewItems.length),
    }
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

export default function CustomerInfoManagement() {
    const authFetch = useAuthStore((state) => state.authFetch)
    const navigate = useNavigate()
    const [customers, setCustomers] = useState<CustomerInfoItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const deferredSearchTerm = useDeferredValue(searchTerm)
    const [currentPage, setCurrentPage] = useState(1)
    const [memoDrafts, setMemoDrafts] = useState<Record<string, string>>({})
    const [memoErrors, setMemoErrors] = useState<Record<string, string | null>>({})
    const [savingMemoIds, setSavingMemoIds] = useState<Record<string, boolean>>({})
    const [deletingCustomerIds, setDeletingCustomerIds] = useState<Record<string, boolean>>({})
    const [editingMemoId, setEditingMemoId] = useState<string | null>(null)
    const memoFieldRefs = useRef<Record<string, HTMLTextAreaElement | null>>({})

    const fetchCustomerInfo = async () => {
        try {
            setLoading(true)
            setError(null)
            const response = await authFetch(`${API_BASE}/api/customer-info`)
            if (!response.ok) {
                const data = await response.json().catch(() => ({}))
                throw new Error(data.error || '고객 정보를 불러오지 못했습니다.')
            }

            const data = await response.json()
            const nextCustomers: CustomerInfoItem[] = Array.isArray(data.customers) ? data.customers : []

            setCustomers(nextCustomers)
            setMemoDrafts(
                nextCustomers.reduce<Record<string, string>>((acc, customer) => {
                    acc[customer.id] = customer.memo || ''
                    return acc
                }, {}),
            )
            setMemoErrors({})
            setEditingMemoId(null)
        } catch (err) {
            console.error('Failed to fetch customer info:', err)
            setError(err instanceof Error ? err.message : '고객 정보를 불러오지 못했습니다.')
            setCustomers([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void fetchCustomerInfo()
    }, [])

    const filteredCustomers = useMemo(() => {
        const term = deferredSearchTerm.trim().toLowerCase()
        if (!term) return customers

        return customers.filter((customer) => {
            const customerText = [
                customer.customerName,
                formatPhone(customer.customerPhone),
                customer.customerPhone || '',
                customer.memo || '',
            ]
                .join(' ')
                .toLowerCase()

            if (customerText.includes(term)) return true

            return customer.contracts.some((contract) =>
                [
                    contract.articleName,
                    contract.buildingName || '',
                    contract.address || '',
                    contract.contractType,
                    contract.tenantName || '',
                    contract.tenantPhone || '',
                    contract.notes || '',
                ]
                    .join(' ')
                    .toLowerCase()
                    .includes(term),
            )
        })
    }, [customers, deferredSearchTerm])

    const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE))
    const paginatedCustomers = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
        return filteredCustomers.slice(startIndex, startIndex + ITEMS_PER_PAGE)
    }, [currentPage, filteredCustomers])
    const visiblePageNumbers = useMemo(
        () => getVisiblePageNumbers(currentPage, totalPages),
        [currentPage, totalPages],
    )
    const currentRangeStart = filteredCustomers.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1
    const currentRangeEnd = filteredCustomers.length === 0
        ? 0
        : Math.min(currentPage * ITEMS_PER_PAGE, filteredCustomers.length)
    const totalContractCount = useMemo(
        () => filteredCustomers.reduce((sum, customer) => sum + customer.contractCount, 0),
        [filteredCustomers],
    )

    useEffect(() => {
        setCurrentPage(1)
    }, [searchTerm])

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages)
        }
    }, [currentPage, totalPages])

    const handleMemoChange = (customerId: string, value: string) => {
        setMemoDrafts((prev) => ({
            ...prev,
            [customerId]: value,
        }))
        setMemoErrors((prev) => ({
            ...prev,
            [customerId]: null,
        }))
    }

    const activateMemoField = (customerId: string) => {
        if (savingMemoIds[customerId] || deletingCustomerIds[customerId]) return

        setEditingMemoId(customerId)
        setMemoErrors((prev) => ({
            ...prev,
            [customerId]: null,
        }))

        if (typeof window !== 'undefined') {
            window.requestAnimationFrame(() => {
                const field = memoFieldRefs.current[customerId]
                if (!field) return
                field.focus()
                const cursor = field.value.length
                field.setSelectionRange(cursor, cursor)
            })
        }
    }

    const handleMemoSave = async (customer: CustomerInfoItem, nextMemoOverride?: string) => {
        const nextMemo = nextMemoOverride ?? memoDrafts[customer.id] ?? ''
        if (nextMemo === (customer.memo || '')) {
            setMemoErrors((prev) => ({
                ...prev,
                [customer.id]: null,
            }))
            return
        }

        try {
            setSavingMemoIds((prev) => ({
                ...prev,
                [customer.id]: true,
            }))
            setMemoErrors((prev) => ({
                ...prev,
                [customer.id]: null,
            }))

            const response = await authFetch(`${API_BASE}/api/customer-info/${customer.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    memo: nextMemo,
                }),
            })

            if (!response.ok) {
                const data = await response.json().catch(() => ({}))
                throw new Error(data.error || '고객 메모를 저장하지 못했습니다.')
            }

            const data = await response.json()
            const updatedCustomer = data.customerInfo

            setCustomers((prev) =>
                prev.map((item) =>
                    item.id === customer.id
                        ? {
                            ...item,
                            customerName: updatedCustomer.customerName,
                            customerPhone: updatedCustomer.customerPhone,
                            memo: updatedCustomer.memo || null,
                            createdAt: updatedCustomer.createdAt,
                            updatedAt: updatedCustomer.updatedAt,
                        }
                        : item,
                ),
            )
            setMemoDrafts((prev) => ({
                ...prev,
                [customer.id]: updatedCustomer.memo || '',
            }))
        } catch (err) {
            setMemoErrors((prev) => ({
                ...prev,
                [customer.id]: err instanceof Error ? err.message : '고객 메모를 저장하지 못했습니다.',
            }))
        } finally {
            setSavingMemoIds((prev) => ({
                ...prev,
                [customer.id]: false,
            }))
        }
    }

    const handleMemoBlur = (customer: CustomerInfoItem) => {
        if (editingMemoId === customer.id) {
            setEditingMemoId(null)
        }

        const nextMemo = memoDrafts[customer.id] ?? ''
        if (nextMemo === (customer.memo || '')) return

        void handleMemoSave(customer, nextMemo)
    }

    const handleDeleteCustomer = async (customer: CustomerInfoItem) => {
        const confirmed = confirm(`"${customer.customerName}" 고객정보를 삭제하시겠습니까?\n관리매물 자체는 삭제되지 않습니다.`)
        if (!confirmed) return

        try {
            setDeletingCustomerIds((prev) => ({
                ...prev,
                [customer.id]: true,
            }))
            setMemoErrors((prev) => ({
                ...prev,
                [customer.id]: null,
            }))

            const response = await authFetch(`${API_BASE}/api/customer-info/${customer.id}`, {
                method: 'DELETE',
            })

            if (!response.ok) {
                const data = await response.json().catch(() => ({}))
                throw new Error(data.error || '고객정보를 삭제하지 못했습니다.')
            }

            setCustomers((prev) => prev.filter((item) => item.id !== customer.id))
            setMemoDrafts((prev) => {
                const next = { ...prev }
                delete next[customer.id]
                return next
            })
            setMemoErrors((prev) => {
                const next = { ...prev }
                delete next[customer.id]
                return next
            })
            setSavingMemoIds((prev) => {
                const next = { ...prev }
                delete next[customer.id]
                return next
            })
        } catch (err) {
            setMemoErrors((prev) => ({
                ...prev,
                [customer.id]: err instanceof Error ? err.message : '고객정보를 삭제하지 못했습니다.',
            }))
        } finally {
            setDeletingCustomerIds((prev) => ({
                ...prev,
                [customer.id]: false,
            }))
        }
    }

    const goToCustomerConsultation = (customer: CustomerInfoItem) => {
        navigate(`/customers/consultations?customerId=${customer.id}`)
    }

    const renderInlineMemoField = (customer: CustomerInfoItem, compact = false) => {
        const memoDraft = memoDrafts[customer.id] ?? ''
        const currentMemo = customer.memo || ''
        const isEditingMemo = editingMemoId === customer.id
        const isSavingMemo = Boolean(savingMemoIds[customer.id])
        const isDeletingCustomer = Boolean(deletingCustomerIds[customer.id])
        const hasMemo = Boolean(currentMemo.trim())
        const helperLabel = isSavingMemo
            ? '메모 저장 중...'
            : isEditingMemo
                ? '바깥을 클릭하면 메모가 저장됩니다.'
                : '클릭해서 메모를 바로 수정하세요.'

        return (
            <div className={`space-y-2 ${compact ? '' : 'max-w-sm'}`}>
                <textarea
                    ref={(element) => { memoFieldRefs.current[customer.id] = element }}
                    value={memoDraft}
                    readOnly={!isEditingMemo}
                    onClick={() => {
                        if (!isEditingMemo) {
                            activateMemoField(customer.id)
                        }
                    }}
                    onChange={(e) => handleMemoChange(customer.id, e.target.value)}
                    onBlur={() => handleMemoBlur(customer)}
                    rows={compact ? 3 : 2}
                    placeholder="고객 메모를 입력하세요."
                    className={`w-full resize-none border-green-700 rounded-xl border px-3 py-2.5 text-sm transition-hud focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/20 ${isEditingMemo
                        ? 'border-hud-accent-primary/30 bg-hud-bg-card text-hud-text-primary'
                        : 'cursor-text border-hud-border-secondary bg-hud-bg-secondary/75 text-hud-text-secondary'
                        } ${isSavingMemo || isDeletingCustomer ? 'opacity-70' : ''}`}
                />
                <p className="text-[11px] text-hud-text-secondary">{helperLabel}</p>
                {memoErrors[customer.id] && (
                    <p className="text-sm text-hud-accent-danger">{memoErrors[customer.id]}</p>
                )}
            </div>
        )
    }

    const renderConsultationPanel = (customer: CustomerInfoItem, compact = false) => {
        const contractPreviewMeta = getContractPreviewMeta(customer.contracts, compact ? 2 : 3)

        return (
            <div
                className={`overflow-hidden rounded-[var(--hud-base-border-radius)] border border-hud-border-primary/30 bg-hud-bg-card shadow-hud backdrop-blur-sm ${compact ? 'p-3' : 'p-4'
                    }`}
                style={{
                    background: 'linear-gradient(135deg, rgba(var(--hud-accent-primary-rgb, 0, 255, 204), 0.10) 0%, rgba(var(--hud-accent-primary-rgb, 0, 255, 204), 0.03) 24%, var(--hud-bg-card) 60%)',
                }}
            >
                <div className="border-b border-hud-border-secondary pb-3">
                    <div className="space-y-2">
                        <h3 className="mt-1 text-sm font-semibold text-hud-text-primary">고객상담</h3>
                        <p className="text-xs leading-5 text-hud-text-secondary">최신 고객상담 컨텐츠 영역입니다.</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-hud-text-secondary">
                            <span className="rounded-full border border-hud-border-secondary bg-hud-bg-secondary/70 px-2 py-0.5">
                                등록일 {formatDate(customer.createdAt)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    const renderDesktopContractsTable = (customer: CustomerInfoItem) => (
        <div className="overflow-hidden rounded-[var(--hud-base-border-radius)] border border-hud-border-primary/30 bg-hud-bg-card shadow-hud backdrop-blur-sm">
            <div className="flex items-center justify-between border-b border-hud-border-secondary px-4 py-3">
                <h3 className="text-sm font-semibold text-hud-text-primary">매물 이력</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-[980px] w-full divide-y divide-hud-border-secondary">
                    <thead className="bg-hud-bg-secondary/85 backdrop-blur-sm">
                        <tr>
                            <th className="px-4 py-3 text-left text-[11px] font-semibold tracking-[0.08em] text-hud-text-secondary">매물명</th>
                            <th className="px-4 py-3 text-left text-[11px] font-semibold tracking-[0.08em] text-hud-text-secondary">주소</th>
                            <th className="px-4 py-3 text-left text-[11px] font-semibold tracking-[0.08em] text-hud-text-secondary">거래유형</th>
                            <th className="px-4 py-3 text-left text-[11px] font-semibold tracking-[0.08em] text-hud-text-secondary">임차/매수인</th>
                            <th className="px-4 py-3 text-left text-[11px] font-semibold tracking-[0.08em] text-hud-text-secondary">계약일</th>
                            <th className="px-4 py-3 text-left text-[11px] font-semibold tracking-[0.08em] text-hud-text-secondary">만기일</th>
                            <th className="px-4 py-3 text-left text-[11px] font-semibold tracking-[0.08em] text-hud-text-secondary">메모</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-hud-border-secondary">
                        {customer.contracts.map((contract, contractIndex) => (
                            <tr
                                key={contract.id}
                                className={`transition-colors hover:bg-hud-bg-hover/25 ${contractIndex % 2 === 0 ? 'bg-hud-bg-primary/80' : 'bg-hud-bg-secondary/10'
                                    }`}
                            >
                                <td className="px-4 py-3 align-top">
                                    <p className="text-sm font-semibold text-hud-text-primary">
                                        {formatArticleDisplay(contract)}
                                    </p>
                                </td>
                                <td className="px-4 py-3 text-sm text-hud-text-primary align-top">
                                    {contract.address || '-'}
                                </td>
                                <td className="px-4 py-3 align-top">
                                    <span className="inline-flex rounded-full border border-hud-accent-info/20 bg-hud-accent-info/10 px-2.5 py-1 text-xs font-medium text-hud-accent-info">
                                        {contract.contractType}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-hud-text-primary align-top">
                                    <div className="space-y-0.5">
                                        <p>{contract.tenantName || '-'}</p>
                                        <p className="text-xs text-hud-text-secondary">
                                            {contract.tenantPhone ? formatPhone(contract.tenantPhone) : '-'}
                                        </p>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-sm text-hud-text-primary align-top">{formatDate(contract.contractDate)}</td>
                                <td className="px-4 py-3 text-sm text-hud-text-primary align-top">{formatDate(contract.contractEndDate)}</td>
                                <td className="px-4 py-3 text-sm text-hud-text-primary align-top">
                                    <p className="max-w-xs truncate text-hud-text-secondary" title={contract.notes || '-'}>
                                        {contract.notes || '-'}
                                    </p>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )

    const renderMobileContracts = (customer: CustomerInfoItem) => (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold tracking-[0.08em] text-hud-text-secondary">등록 매물</p>
                <span className="rounded-full border border-hud-border-secondary bg-hud-bg-secondary px-2.5 py-1 text-xs font-medium text-hud-text-primary">
                    {customer.contractCount}건
                </span>
            </div>
            {customer.contracts.map((contract) => (
                <div
                    key={contract.id}
                    className="overflow-hidden rounded-[var(--hud-base-border-radius)] border border-hud-border-secondary bg-hud-bg-card p-3 shadow-hud"
                    style={{
                        background: 'linear-gradient(180deg, rgba(var(--hud-accent-primary-rgb, 0, 255, 204), 0.06) 0%, var(--hud-bg-card) 22%)',
                    }}
                >
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-hud-text-primary">
                                {formatArticleDisplay(contract)}
                            </p>
                            <p className="mt-1 text-xs text-hud-text-secondary">
                                {contract.address || '주소 없음'}
                            </p>
                        </div>
                        <span className="inline-flex shrink-0 rounded-full border border-hud-accent-info/20 bg-hud-accent-info/10 px-2.5 py-1 text-[11px] font-medium text-hud-accent-info">
                            {contract.contractType}
                        </span>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-xl bg-hud-bg-secondary/80 px-3 py-2">
                            <p className="text-[11px] font-semibold tracking-[0.08em] text-hud-text-secondary">임차/매수인</p>
                            <p className="mt-1 text-sm text-hud-text-primary">{contract.tenantName || '-'}</p>
                            <p className="mt-0.5 text-xs text-hud-text-secondary">
                                {contract.tenantPhone ? formatPhone(contract.tenantPhone) : '-'}
                            </p>
                        </div>
                        <div className="rounded-xl bg-hud-bg-secondary/80 px-3 py-2">
                            <p className="text-[11px] font-semibold tracking-[0.08em] text-hud-text-secondary">계약 일정</p>
                            <p className="mt-1 text-sm text-hud-text-primary">{formatDate(contract.contractDate)}</p>
                            <p className="mt-0.5 text-xs text-hud-text-secondary">만기일 {formatDate(contract.contractEndDate)}</p>
                        </div>
                    </div>
                    <div className="mt-2 rounded-xl bg-hud-bg-secondary/70 px-3 py-2">
                        <p className="text-[11px] font-semibold tracking-[0.08em] text-hud-text-secondary">매물 메모</p>
                        <p className="mt-1 text-sm text-hud-text-primary">{contract.notes || '-'}</p>
                    </div>
                </div>
            ))}
        </div>
    )

    return (
        <div className="relative overflow-hidden p-4 sm:p-5">
            <div
                className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-90"
                style={{
                    background: 'radial-gradient(circle at 0% 0%, rgba(var(--hud-accent-primary-rgb, 0, 255, 204), 0.18), transparent 32%), radial-gradient(circle at 100% 12%, rgba(var(--hud-accent-primary-rgb, 0, 255, 204), 0.12), transparent 24%), linear-gradient(180deg, rgba(var(--hud-accent-primary-rgb, 0, 255, 204), 0.06) 0%, transparent 58%)',
                }}
            />
            <div
                className="pointer-events-none absolute -left-10 top-10 h-48 w-48 rounded-full blur-3xl"
                style={{ background: 'rgba(var(--hud-accent-primary-rgb, 0, 255, 204), 0.10)' }}
            />
            <div
                className="pointer-events-none absolute right-0 top-24 h-56 w-56 rounded-full blur-3xl"
                style={{ background: 'rgba(var(--hud-accent-primary-rgb, 0, 255, 204), 0.08)' }}
            />

            <div className="relative space-y-4">
                <div className="hud-card hud-card-bottom overflow-hidden border-hud-border-primary/35 px-4 py-4 sm:px-5 sm:py-5">
                    <div
                        className="pointer-events-none absolute inset-0"
                        style={{
                            background: 'linear-gradient(135deg, rgba(var(--hud-accent-primary-rgb, 0, 255, 204), 0.16) 0%, rgba(var(--hud-accent-primary-rgb, 0, 255, 204), 0.04) 28%, transparent 60%)',
                        }}
                    />
                    <div className="relative">
                        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                            <div className="max-w-3xl space-y-3">
                                <div className="inline-flex items-center gap-2 rounded-full border border-hud-accent-primary/20 bg-hud-accent-primary/10 px-3 py-1 text-xs font-semibold tracking-[0.12em] text-hud-accent-primary">
                                    <Sparkles className="h-3.5 w-3.5" />
                                    CUSTOMER LEDGER
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold text-hud-text-primary sm:text-3xl">고객정보관리</h1>
                                    <p className="mt-2 text-sm leading-6 text-hud-text-secondary sm:text-base">
                                        관리매물에서 저장한 책임자 기준 고객과 연결 매물을 한 화면에서 보고, 고객 메모를 간단히 수정하며 상담 연동을 준비합니다.
                                    </p>
                                </div>
                            </div>

                            <div className="flex shrink-0 flex-wrap items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => void fetchCustomerInfo()}
                                    className="border-hud-border-secondary bg-hud-bg-card/70 text-hud-text-secondary backdrop-blur-sm hover:text-hud-text-primary"
                                    leftIcon={<RefreshCw className="h-4 w-4" />}
                                >
                                    새로고침
                                </Button>
                            </div>
                        </div>

                        <div className="rounded-[var(--hud-base-border-radius)] border border-hud-border-primary/25 bg-hud-bg-card/80 p-3 shadow-hud backdrop-blur-sm sm:p-4">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                                <div className="min-w-0 flex-1 space-y-1.5">
                                    <label className="block text-[11px] font-semibold tracking-[0.08em] text-hud-text-secondary">통합 검색</label>
                                    <div className="relative">
                                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-hud-text-secondary" />
                                        <input
                                            type="text"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            placeholder="고객명, 연락처, 고객메모, 매물명, 주소 검색..."
                                            className="w-full rounded-xl border border-hud-border-secondary bg-hud-bg-secondary/85 py-3 pl-10 pr-10 text-sm text-hud-text-primary placeholder-hud-text-secondary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/20"
                                        />
                                        {searchTerm && (
                                            <button
                                                type="button"
                                                onClick={() => setSearchTerm('')}
                                                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-hud-text-secondary hover:bg-hud-bg-hover hover:text-hud-text-primary"
                                                aria-label="검색어 지우기"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                    <span className="rounded-full border border-hud-border-secondary bg-hud-bg-secondary/80 px-3 py-1.5 font-medium text-hud-text-primary">
                                        검색 {filteredCustomers.length}명
                                    </span>
                                    <span className="rounded-full border border-hud-border-secondary bg-hud-bg-secondary/80 px-3 py-1.5 font-medium text-hud-text-primary">
                                        페이지 {currentPage}/{totalPages}
                                    </span>
                                    <span className="rounded-full border border-hud-border-secondary bg-hud-bg-secondary/80 px-3 py-1.5 font-medium text-hud-text-primary">
                                        범위 {currentRangeStart}-{currentRangeEnd}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="hud-card hud-card-bottom relative overflow-hidden px-6 py-16 text-center text-hud-text-secondary">
                    고객 정보를 불러오는 중입니다...
                </div>
            ) : error ? (
                <div className="hud-card hud-card-bottom relative overflow-hidden border-hud-accent-danger/25 bg-hud-accent-danger/10 px-6 py-10 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-hud-accent-danger/15 text-hud-accent-danger">
                        <AlertTriangle className="h-5 w-5" />
                    </div>
                    <p className="text-base font-semibold text-hud-text-primary">고객정보를 불러오지 못했습니다.</p>
                    <p className="mt-2 text-sm text-hud-text-secondary">{error}</p>
                    <div className="mt-4">
                        <Button onClick={() => void fetchCustomerInfo()} leftIcon={<RefreshCw className="h-4 w-4" />}>
                            다시 시도
                        </Button>
                    </div>
                </div>
            ) : filteredCustomers.length === 0 ? (
                <div className="hud-card hud-card-bottom relative overflow-hidden px-6 py-16 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-hud-bg-secondary text-hud-text-secondary">
                        <ClipboardList className="h-6 w-6" />
                    </div>
                    <p className="text-base font-semibold text-hud-text-primary">표시할 고객 정보가 없습니다.</p>
                    <p className="mt-2 text-sm text-hud-text-secondary">
                        관리매물에 책임자명을 입력한 뒤 관리매물 페이지에서 고객정보 저장을 실행하면 여기서 확인할 수 있습니다.
                    </p>
                </div>
            ) : (
                <div className="hud-card hud-card-bottom overflow-hidden border-hud-border-primary/35">
                    <div className="border-b border-hud-border-secondary bg-hud-bg-secondary/35 px-4 py-4 sm:px-5">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <p className="text-[11px] font-semibold tracking-[0.08em] text-hud-text-secondary">CUSTOMER VIEW</p>
                                <h2 className="mt-1 text-lg font-semibold text-hud-text-primary">고객 목록</h2>
                            </div>
                        </div>
                    </div>

                    <div className="hidden xl:block overflow-x-auto">
                        <table className="min-w-[1440px] w-full table-fixed divide-y divide-hud-border-secondary">
                            <colgroup>
                                <col className="w-[18%]" />
                                <col className="w-[16%]" />
                                <col className="w-[12%]" />
                                <col className="w-[20%]" />
                                <col className="w-[22%]" />
                                <col className="w-[12%]" />
                            </colgroup>
                            <thead className="bg-hud-bg-secondary/85 backdrop-blur-sm">
                                <tr>
                                    <th className="px-4 py-3 text-left text-[11px] font-semibold tracking-[0.08em] text-hud-text-secondary">책임자</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-semibold tracking-[0.08em] text-hud-text-secondary">연락처</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-semibold tracking-[0.08em] text-hud-text-secondary">수정일</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-semibold tracking-[0.08em] text-hud-text-secondary">고객메모</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-semibold tracking-[0.08em] text-hud-text-secondary">고객상담</th>
                                    <th className="px-4 py-3 text-right text-[11px] font-semibold tracking-[0.08em] text-hud-text-secondary">관리</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-hud-border-secondary">
                                {paginatedCustomers.map((customer, index) => {
                                    const customerRowClass = index % 2 === 0 ? 'bg-hud-bg-primary/92' : 'bg-hud-bg-secondary/12'
                                    const detailRowClass = index % 2 === 0 ? 'bg-hud-bg-secondary/16' : 'bg-hud-bg-secondary/26'

                                    return (
                                        <Fragment key={customer.id}>
                                            <tr className={`${customerRowClass} border-b border-hud-border-table transition-colors hover:bg-hud-bg-hover/25`}>
                                                <td className="px-4 py-3 align-middle">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-hud-accent-primary/20 bg-hud-accent-primary/10 text-sm font-semibold text-hud-accent-primary">
                                                            {customer.customerName.slice(0, 1)}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <p className="truncate font-semibold text-hud-text-primary">{customer.customerName}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 align-middle">
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-hud-bg-secondary text-hud-text-secondary">
                                                            <Phone className="h-4 w-4" />
                                                        </div>
                                                        <span className={`truncate ${!customer.customerPhone ? 'text-hud-accent-danger' : 'text-hud-text-primary'}`}>
                                                            {formatPhone(customer.customerPhone)}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 align-middle text-sm text-hud-text-primary">
                                                    {formatDate(customer.updatedAt)}
                                                </td>
                                                <td className="px-4 py-3 align-middle text-sm text-hud-text-primary">
                                                    {renderInlineMemoField(customer)}
                                                </td>
                                                <td className="px-4 py-3 align-middle text-sm text-hud-text-primary">
                                                    {renderConsultationPanel(customer, true)}
                                                </td>
                                                <td className="px-4 py-3 align-middle">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="secondary"
                                                            size="sm"
                                                            onClick={() => goToCustomerConsultation(customer)}
                                                        >
                                                            <span className="inline-flex items-center gap-1.5">
                                                                <MessageSquareText className="h-3.5 w-3.5" />
                                                                상담기록
                                                            </span>
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="danger"
                                                            size="sm"
                                                            onClick={() => void handleDeleteCustomer(customer)}
                                                            disabled={Boolean(deletingCustomerIds[customer.id])}
                                                        >
                                                            <span className="inline-flex items-center gap-1.5">
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                                {deletingCustomerIds[customer.id] ? '삭제 중...' : '고객 삭제'}
                                                            </span>
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                            <tr className={detailRowClass}>
                                                <td colSpan={6} className="p-0">
                                                    <div className="border-t border-hud-border-secondary px-4 pb-4 pt-2">
                                                        {renderDesktopContractsTable(customer)}
                                                    </div>
                                                </td>
                                            </tr>
                                        </Fragment>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="space-y-4 p-4 xl:hidden">
                        {paginatedCustomers.map((customer) => {
                            return (
                                <div
                                    key={customer.id}
                                    className="overflow-hidden rounded-[var(--hud-base-border-radius)] border border-hud-border-primary/30 bg-hud-bg-card shadow-hud"
                                    style={{
                                        background: 'linear-gradient(135deg, rgba(var(--hud-accent-primary-rgb, 0, 255, 204), 0.12) 0%, rgba(var(--hud-accent-primary-rgb, 0, 255, 204), 0.03) 22%, var(--hud-bg-card) 56%)',
                                    }}
                                >
                                    <div className="border-b border-hud-border-secondary bg-hud-bg-secondary/20 px-4 py-3">
                                        <div className="flex items-start gap-3">
                                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-hud-accent-primary/20 bg-hud-accent-primary/10 text-sm font-semibold text-hud-accent-primary">
                                                {customer.customerName.slice(0, 1)}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h3 className="text-base font-semibold text-hud-text-primary">{customer.customerName}</h3>
                                                </div>
                                                <div className="mt-2 flex items-center gap-2 text-sm">
                                                    <Phone className="h-4 w-4 text-hud-text-secondary" />
                                                    <span className={!customer.customerPhone ? 'text-hud-accent-danger' : 'text-hud-text-primary'}>
                                                        {formatPhone(customer.customerPhone)}
                                                    </span>
                                                </div>
                                                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                                    <div className="rounded-xl bg-hud-bg-secondary/75 px-3 py-2">
                                                        <p className="text-[11px] font-semibold tracking-[0.08em] text-hud-text-secondary">등록일</p>
                                                        <p className="mt-1 text-sm text-hud-text-primary">{formatDate(customer.createdAt)}</p>
                                                    </div>
                                                    <div className="rounded-xl bg-hud-bg-secondary/75 px-3 py-2">
                                                        <p className="text-[11px] font-semibold tracking-[0.08em] text-hud-text-secondary">수정일</p>
                                                        <p className="mt-1 text-sm text-hud-text-primary">{formatDate(customer.updatedAt)}</p>
                                                    </div>
                                                </div>
                                                <div className="mt-3">
                                                    {renderInlineMemoField(customer, true)}
                                                </div>
                                                <div className="mt-3">
                                                    {renderConsultationPanel(customer, true)}
                                                </div>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => goToCustomerConsultation(customer)}
                                                className="shrink-0"
                                            >
                                                <span className="inline-flex items-center gap-1.5">
                                                    <MessageSquareText className="h-3.5 w-3.5" />
                                                    상담기록
                                                </span>
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="danger"
                                                size="sm"
                                                onClick={() => void handleDeleteCustomer(customer)}
                                                disabled={Boolean(deletingCustomerIds[customer.id])}
                                                className="shrink-0"
                                            >
                                                <span className="inline-flex items-center gap-1.5">
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                    {deletingCustomerIds[customer.id] ? '삭제 중...' : '고객 삭제'}
                                                </span>
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="space-y-3 divide-y divide-hud-border-secondary p-4">
                                        <div className="pt-0">
                                            {renderMobileContracts(customer)}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    <div className="flex flex-col gap-3 border-t border-hud-border-secondary bg-hud-bg-secondary/25 px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-hud-text-secondary">
                            {filteredCustomers.length === 0
                                ? '0건'
                                : `${currentRangeStart}-${currentRangeEnd} / ${filteredCustomers.length}명`}
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
                </div>
            )}
        </div>
    )
}
