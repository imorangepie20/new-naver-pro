import { useState, useEffect, useMemo } from 'react'
import {
    ClipboardList, Plus, Pencil, Trash2, X,
    DollarSign, User, FileText, Eye, Home, Calendar, Building2, MessageSquareText, RotateCcw, CornerDownLeft, Undo2, Redo2, Send, Save, Users, UserPlus, UserCheck, Search
} from 'lucide-react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/common/Button'
import { useAuthStore } from '../../stores/authStore'
import { API_BASE } from '../../lib/api'

interface ManagedProperty {
    id: string
    articleName: string
    buildingName?: string | null
    address?: string | null
    contractType: string
    propertyType?: string | null
    downPayment?: number | null
    downPaymentDate?: string | null
    interimPayment?: number | null
    interimPaymentDate?: string | null
    finalPayment?: number | null
    finalPaymentDate?: string | null
    contractDate: string
    contractEndDate: string
    totalPrice?: number | null
    depositAmount?: number | null
    monthlyRent?: number | null
    tenantName?: string | null
    tenantPhone?: string | null
    managerName?: string | null
    managerPhone?: string | null
    lastNotificationSentAt?: string | null
    notificationHistory?: Record<string, string> | null
    notes?: string | null
    status: string
    createdAt: string
}

const RENEWAL_FILTERS = [
    { label: '전체', days: undefined, notificationType: null },
    { label: '3개월', days: 90, notificationType: 'renewal_90' },
    { label: '1개월', days: 30, notificationType: 'renewal_30' },
    { label: '15일', days: 15, notificationType: 'renewal_15' },
    { label: '7일', days: 7, notificationType: 'renewal_7' },
    { label: '3일', days: 3, notificationType: 'renewal_3' },
    { label: '1일', days: 1, notificationType: 'renewal_1' },
]

const CONTRACT_TYPES = ['매매', '전세', '월세']
const KAKAO_TEMPLATE_STORAGE_KEY = 'managed-property-kakao-template'
const DEFAULT_KAKAO_TEMPLATE = [
    '[계약 만료 알림]',
    '담당자: {managerName}',
    '매물: {articleName}',
    '거래유형: {contractType}',
    '만료일: {contractEndDate}',
    '남은 기간: {daysLeft}일',
    '연락처: {managerPhone}',
].join('\n')
const TEMPLATE_VARIABLES = [
    '{managerName}',
    '{articleName}',
    '{contractType}',
    '{contractEndDate}',
    '{daysLeft}',
    '{managerPhone}',
    '{address}',
]
const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
    renewal_90: '3개월',
    renewal_30: '1개월',
    renewal_15: '15일',
    renewal_7: '7일',
    renewal_3: '3일',
    renewal_1: '1일',
}
const NOTIFICATION_BADGE_STYLES: Record<string, string> = {
    renewal_90: 'border-sky-200 bg-sky-500 text-white shadow-[0_0_22px_rgba(14,165,233,0.42)]',
    renewal_30: 'border-emerald-200 bg-emerald-500 text-white shadow-[0_0_22px_rgba(16,185,129,0.42)]',
    renewal_15: 'border-fuchsia-200 bg-fuchsia-500 text-white shadow-[0_0_22px_rgba(217,70,239,0.42)]',
    renewal_7: 'border-amber-100 bg-amber-500 text-slate-950 shadow-[0_0_22px_rgba(245,158,11,0.42)]',
    renewal_3: 'border-orange-100 bg-orange-500 text-white shadow-[0_0_22px_rgba(249,115,22,0.44)]',
    renewal_1: 'border-rose-100 bg-rose-500 text-white shadow-[0_0_24px_rgba(244,63,94,0.48)]',
}
const ITEMS_PER_PAGE = 10

function formatPrice(price?: number | null) {
    if (!price) return '-'
    if (price >= 10000) return `${Math.floor(price / 10000)}억${price % 10000 > 0 ? ` ${(price % 10000).toLocaleString()}` : ''}`
    return `${price.toLocaleString()}만`
}

function formatDate(dateStr?: string | null) {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function formatDateTime(dateStr?: string | null) {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    })
}

function normalizeNotificationHistory(value: ManagedProperty['notificationHistory']) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.entries(value).reduce<Record<string, string>>((acc, [key, raw]) => {
        if (typeof raw === 'string' && raw.trim()) {
            acc[key] = raw
        }
        return acc
    }, {})
}

function getNotificationBadges(property: ManagedProperty) {
    const history = normalizeNotificationHistory(property.notificationHistory)
    return Object.entries(history)
        .filter(([key]) => key in NOTIFICATION_TYPE_LABELS)
        .sort((a, b) => {
            const order = ['renewal_90', 'renewal_30', 'renewal_15', 'renewal_7', 'renewal_3', 'renewal_1']
            return order.indexOf(a[0]) - order.indexOf(b[0])
        })
}

function getNotificationBadgeClass(key: string) {
    return NOTIFICATION_BADGE_STYLES[key] || 'border-hud-border-secondary bg-hud-bg-secondary text-hud-text-primary'
}

function normalizeSearchText(value?: string | null) {
    return (value || '').trim().toLowerCase()
}

function normalizeDigits(value?: string | null) {
    return (value || '').replace(/\D/g, '')
}

function matchesManagedPropertySearch(property: ManagedProperty, searchTerm: string) {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return true

    const searchableTexts = [
        property.articleName,
        property.buildingName,
        property.address,
        property.contractType,
        property.propertyType,
        property.tenantName,
        property.managerName,
        property.notes,
    ]

    if (searchableTexts.some((value) => normalizeSearchText(value).includes(term))) {
        return true
    }

    const digitTerm = normalizeDigits(searchTerm)
    if (!digitTerm) return false

    return [property.tenantPhone, property.managerPhone]
        .some((value) => normalizeDigits(value).includes(digitTerm))
}

function renderKakaoTemplate(template: string, property: ManagedProperty | null, daysLeft: number | null) {
    if (!property) return template

    const replacements: Record<string, string> = {
        '{managerName}': property.managerName || '책임자',
        '{articleName}': property.articleName || '-',
        '{contractType}': property.contractType || '-',
        '{contractEndDate}': formatDate(property.contractEndDate),
        '{daysLeft}': daysLeft !== null ? String(daysLeft) : '-',
        '{managerPhone}': property.managerPhone || '-',
        '{address}': property.address || '-',
    }

    return Object.entries(replacements).reduce(
        (message, [token, value]) => message.split(token).join(value),
        template,
    )
}

function escapeHtml(value: string) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
}

function templateToHtml(template: string) {
    const normalized = template.replace(/\r\n/g, '\n')
    if (!normalized.trim()) return '<p></p>'

    return normalized
        .split('\n')
        .map((line) => `<p>${escapeHtml(line) || '<br>'}</p>`)
        .join('')
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

interface KakaoTemplateEditorProps {
    value: string
    onChange: (value: string) => void
}

function KakaoTemplateEditor({ value, onChange }: KakaoTemplateEditorProps) {
    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                bold: false,
                italic: false,
                strike: false,
                code: false,
                codeBlock: false,
                blockquote: false,
                bulletList: false,
                orderedList: false,
                heading: false,
                horizontalRule: false,
            }),
            Placeholder.configure({
                placeholder: '카카오톡 알림 문구를 입력하세요',
            }),
        ],
        content: templateToHtml(value),
        editorProps: {
            attributes: {
                class: 'min-h-[220px] px-4 py-3 text-sm leading-6 text-hud-text-primary focus:outline-none',
            },
        },
        onUpdate: ({ editor: currentEditor }) => {
            onChange(currentEditor.getText({ blockSeparator: '\n' }))
        },
    })

    useEffect(() => {
        if (!editor) return
        const currentText = editor.getText({ blockSeparator: '\n' })
        if (currentText === value) return
        editor.commands.setContent(templateToHtml(value), { emitUpdate: false })
    }, [editor, value])

    const insertVariable = (token: string) => {
        if (!editor) return
        editor.chain().focus().insertContent(token).run()
    }

    const insertLineBreak = () => {
        if (!editor) return
        editor.chain().focus().setHardBreak().run()
    }

    return (
        <div className="rounded-xl border border-hud-border-secondary bg-hud-bg-primary overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 px-3 py-3 border-b border-hud-border-secondary bg-white/[0.02]">
                <button
                    type="button"
                    onClick={() => editor?.chain().focus().undo().run()}
                    disabled={!editor?.can().chain().focus().undo().run()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-hud-border-secondary text-xs text-hud-text-secondary hover:text-hud-text-primary hover:bg-hud-bg-hover transition-hud disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <Undo2 className="w-3.5 h-3.5" />
                    실행 취소
                </button>
                <button
                    type="button"
                    onClick={() => editor?.chain().focus().redo().run()}
                    disabled={!editor?.can().chain().focus().redo().run()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-hud-border-secondary text-xs text-hud-text-secondary hover:text-hud-text-primary hover:bg-hud-bg-hover transition-hud disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <Redo2 className="w-3.5 h-3.5" />
                    다시 실행
                </button>
                <button
                    type="button"
                    onClick={insertLineBreak}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-hud-border-secondary text-xs text-hud-text-secondary hover:text-hud-text-primary hover:bg-hud-bg-hover transition-hud"
                >
                    <CornerDownLeft className="w-3.5 h-3.5" />
                    줄바꿈
                </button>
            </div>

            <EditorContent editor={editor} />

            <div className="flex flex-wrap gap-2 px-3 pb-3">
                {TEMPLATE_VARIABLES.map((token) => (
                    <button
                        key={token}
                        type="button"
                        onClick={() => insertVariable(token)}
                        className="px-2.5 py-1 rounded-full bg-hud-bg-secondary border border-hud-border-secondary text-[11px] text-hud-text-secondary hover:text-hud-text-primary hover:border-yellow-500/40 transition-hud"
                    >
                        {token}
                    </button>
                ))}
            </div>
        </div>
    )
}

const emptyForm = {
    articleName: '', buildingName: '', address: '', contractType: '전세', propertyType: '',
    downPayment: '', downPaymentDate: '', interimPayment: '', interimPaymentDate: '',
    finalPayment: '', finalPaymentDate: '', contractDate: '', contractEndDate: '',
    totalPrice: '', depositAmount: '', monthlyRent: '',
    tenantName: '', tenantPhone: '', managerName: '', managerPhone: '', notes: '',
}

interface ManagedPropertyListProps {
    contractTypeFilter?: string
    pageTitle?: string
}

export default function ManagedPropertyList({ contractTypeFilter, pageTitle }: ManagedPropertyListProps = {}) {
    const authFetch = useAuthStore((state) => state.authFetch)
    const navigate = useNavigate()
    const [properties, setProperties] = useState<ManagedProperty[]>([])
    const [loading, setLoading] = useState(true)
    const [renewalFilter, setRenewalFilter] = useState<number | undefined>(undefined)
    const [searchTerm, setSearchTerm] = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [form, setForm] = useState(emptyForm)

    // ========== 상세보기 모달 상태 ==========
    const [showDetailModal, setShowDetailModal] = useState(false)
    const [detailProperty, setDetailProperty] = useState<ManagedProperty | null>(null)
    const [messageTemplate, setMessageTemplate] = useState(DEFAULT_KAKAO_TEMPLATE)
    const [isSendingNotification, setIsSendingNotification] = useState(false)
    const [sendResult, setSendResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [isSyncingCustomerInfo, setIsSyncingCustomerInfo] = useState(false)
    const [customerSyncResult, setCustomerSyncResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [savingPropertyIds, setSavingPropertyIds] = useState<Record<string, boolean>>({})
    const [savedCustomerKeys, setSavedCustomerKeys] = useState<Set<string>>(new Set())

    const buildCustomerKey = (name?: string | null, phone?: string | null) => {
        const n = (name || '').trim().replace(/\s+/g, ' ').toLowerCase()
        const p = (phone || '').replace(/\D/g, '')
        return p ? `${n}:${p}` : n
    }

    const isCustomerSaved = (p: ManagedProperty) => {
        if (!p.managerName) return false
        return savedCustomerKeys.has(buildCustomerKey(p.managerName, p.managerPhone))
    }

    const trimmedSearchTerm = searchTerm.trim()
    const filteredByContractType = contractTypeFilter
        ? properties.filter((property) => property.contractType === contractTypeFilter)
        : properties
    const visibleProperties = trimmedSearchTerm
        ? filteredByContractType.filter((property) => matchesManagedPropertySearch(property, trimmedSearchTerm))
        : filteredByContractType
    const totalPages = Math.max(1, Math.ceil(visibleProperties.length / ITEMS_PER_PAGE))
    const pagedProperties = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
        return visibleProperties.slice(startIndex, startIndex + ITEMS_PER_PAGE)
    }, [currentPage, visibleProperties])
    const visiblePageNumbers = useMemo(
        () => getVisiblePageNumbers(currentPage, totalPages),
        [currentPage, totalPages],
    )
    const currentRangeStart = visibleProperties.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1
    const currentRangeEnd = visibleProperties.length === 0
        ? 0
        : Math.min(currentPage * ITEMS_PER_PAGE, visibleProperties.length)
    const currentRangeLabel = visibleProperties.length === 0
        ? '0건'
        : `${currentRangeStart}-${currentRangeEnd} / ${visibleProperties.length}건`

    const fetchProperties = async () => {
        try {
            setLoading(true)
            const params = new URLSearchParams()
            if (renewalFilter !== undefined) params.append('renewalDays', String(renewalFilter))
            const res = await authFetch(`${API_BASE}/api/managed-properties?${params}`)
            if (!res.ok) {
                setProperties([])
                return
            }
            const data = await res.json()
            if (data.success) setProperties(data.properties || [])
        } catch (err) {
            console.error('Failed to fetch:', err)
        } finally {
            setLoading(false)
        }
    }

    const fetchSavedCustomerKeys = async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/customer-info/saved-customer-keys`)
            if (!res.ok) return
            const data = await res.json()
            if (data.success && Array.isArray(data.customerKeys)) {
                setSavedCustomerKeys(new Set(data.customerKeys))
            }
        } catch (err) {
            console.error('Failed to fetch saved customer keys:', err)
        }
    }

    useEffect(() => { void fetchProperties(); void fetchSavedCustomerKeys() }, [renewalFilter])

    useEffect(() => {
        setCurrentPage(1)
    }, [trimmedSearchTerm, renewalFilter, contractTypeFilter])

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages)
        }
    }, [currentPage, totalPages])

    useEffect(() => {
        if (typeof window === 'undefined') return
        const savedTemplate = window.localStorage.getItem(KAKAO_TEMPLATE_STORAGE_KEY)
        if (savedTemplate) {
            setMessageTemplate(savedTemplate)
        }
    }, [])

    useEffect(() => {
        if (typeof window === 'undefined') return
        window.localStorage.setItem(KAKAO_TEMPLATE_STORAGE_KEY, messageTemplate)
    }, [messageTemplate])

    const handleSubmit = async () => {
        if (!form.articleName || !form.contractType) {
            alert('매물명과 거래 유형은 필수입니다.')
            return
        }
        const body: any = { ...form }
        const numFields = ['downPayment', 'interimPayment', 'finalPayment', 'totalPrice', 'depositAmount', 'monthlyRent']
        for (const f of numFields) {
            body[f] = body[f] ? parseInt(body[f]) : null
        }

        try {
            if (editingId) {
                await authFetch(`${API_BASE}/api/managed-properties/${editingId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                })
            } else {
                await authFetch(`${API_BASE}/api/managed-properties`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                })
            }
            setShowForm(false)
            setEditingId(null)
            setForm(emptyForm)
            void fetchProperties()
        } catch (err) {
            console.error('Failed to save:', err)
        }
    }

    const handleEdit = (p: ManagedProperty) => {
        setEditingId(p.id)
        setForm({
            articleName: p.articleName || '',
            buildingName: p.buildingName || '',
            address: p.address || '',
            contractType: p.contractType || '전세',
            propertyType: p.propertyType || '',
            downPayment: p.downPayment ? String(p.downPayment) : '',
            downPaymentDate: p.downPaymentDate ? p.downPaymentDate.split('T')[0] : '',
            interimPayment: p.interimPayment ? String(p.interimPayment) : '',
            interimPaymentDate: p.interimPaymentDate ? p.interimPaymentDate.split('T')[0] : '',
            finalPayment: p.finalPayment ? String(p.finalPayment) : '',
            finalPaymentDate: p.finalPaymentDate ? p.finalPaymentDate.split('T')[0] : '',
            contractDate: p.contractDate ? p.contractDate.split('T')[0] : '',
            contractEndDate: p.contractEndDate ? p.contractEndDate.split('T')[0] : '',
            totalPrice: p.totalPrice ? String(p.totalPrice) : '',
            depositAmount: p.depositAmount ? String(p.depositAmount) : '',
            monthlyRent: p.monthlyRent ? String(p.monthlyRent) : '',
            tenantName: p.tenantName || '',
            tenantPhone: p.tenantPhone || '',
            managerName: p.managerName || '',
            managerPhone: p.managerPhone || '',
            notes: p.notes || '',
        })
        setShowForm(true)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('삭제하시겠습니까?')) return
        try {
            await authFetch(`${API_BASE}/api/managed-properties/${id}`, { method: 'DELETE' })
            void fetchProperties()
        } catch (err) {
            console.error('Failed to delete:', err)
        }
    }

    // ========== 상세보기 ==========
    const viewDetail = (p: ManagedProperty) => {
        setDetailProperty(p)
        setShowDetailModal(true)
    }

    // 계약 만료까지 남은 일수 계산
    const getDaysUntilExpiry = (endDateStr: string) => {
        const endDate = new Date(endDateStr)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const diffTime = endDate.getTime() - today.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        return diffDays
    }

    const previewProperty = [...visibleProperties]
        .sort((a, b) => new Date(a.contractEndDate).getTime() - new Date(b.contractEndDate).getTime())[0] || null
    const previewDaysLeft = previewProperty ? getDaysUntilExpiry(previewProperty.contractEndDate) : null
    const previewMessage = renderKakaoTemplate(messageTemplate, previewProperty, previewDaysLeft)
    const notificationTargets = visibleProperties.filter((property) => property.managerPhone)
    const skippedNotificationTargets = visibleProperties.filter((property) => !property.managerPhone)
    const activeNotificationFilter = RENEWAL_FILTERS.find((filter) => filter.days === renewalFilter) || RENEWAL_FILTERS[0]

    const handleSendNotification = async () => {
        if (visibleProperties.length === 0) {
            setSendResult({ type: 'error', text: '알림을 보낼 관리매물이 없습니다.' })
            return
        }

        if (!messageTemplate.trim()) {
            setSendResult({ type: 'error', text: '전송 메시지를 먼저 입력하세요.' })
            return
        }

        if (notificationTargets.length === 0) {
            setSendResult({ type: 'error', text: '현재 목록에 책임자 연락처가 있는 관리매물이 없습니다.' })
            return
        }

        if (!activeNotificationFilter.notificationType) {
            setSendResult({ type: 'error', text: '발송 전 알림 종류를 먼저 선택하세요. 전체 상태에서는 보낼 수 없습니다.' })
            return
        }

        try {
            setIsSendingNotification(true)
            setSendResult(null)

            const res = await authFetch(`${API_BASE}/api/managed-properties/test-notifications`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    template: messageTemplate,
                    notificationType: activeNotificationFilter.notificationType,
                    propertyIds: visibleProperties.map((property) => property.id),
                }),
            })
            const data = await res.json().catch(() => ({}))

            if (!res.ok || !data.success) {
                setSendResult({ type: 'error', text: data.error || '테스트 알림 발송에 실패했습니다.' })
                return
            }

            setSendResult({
                type: 'success',
                text: `${activeNotificationFilter.label} 알림을 책임자 ${data.sentCount || 0}명에게 처리했고, ${data.skippedCount || 0}건은 연락처가 없어 제외했습니다. ${data.info || ''}`.trim(),
            })
            const sentTargets: unknown[] = Array.isArray(data.sentTargets) ? data.sentTargets : []
            const sentAtMap = new Map<string, string>(
                sentTargets
                    .filter((item: unknown): item is { propertyId: string; sentAt: string } =>
                        !!item &&
                        typeof item === 'object' &&
                        typeof (item as { propertyId?: unknown }).propertyId === 'string' &&
                        typeof (item as { sentAt?: unknown }).sentAt === 'string'
                    )
                    .map((item: { propertyId: string; sentAt: string }) => [item.propertyId, item.sentAt])
            )

            if (activeNotificationFilter.notificationType && sentAtMap.size > 0) {
                setProperties((prev) => prev.map((property) => {
                    const sentAt = sentAtMap.get(property.id)
                    if (!sentAt) return property

                    return {
                        ...property,
                        lastNotificationSentAt: sentAt,
                        notificationHistory: {
                            ...(property.notificationHistory || {}),
                            [activeNotificationFilter.notificationType!]: sentAt,
                        },
                    }
                }))

                setDetailProperty((prev) => {
                    if (!prev) return prev
                    const sentAt = sentAtMap.get(prev.id)
                    if (!sentAt) return prev

                    return {
                        ...prev,
                        lastNotificationSentAt: sentAt,
                        notificationHistory: {
                            ...(prev.notificationHistory || {}),
                            [activeNotificationFilter.notificationType!]: sentAt,
                        },
                    }
                })
            }
            void fetchProperties()
        } catch (error) {
            console.error('Failed to send notification:', error)
            setSendResult({ type: 'error', text: '테스트 알림 발송 중 오류가 발생했습니다.' })
        } finally {
            setIsSendingNotification(false)
        }
    }

    const handleSaveCustomerForProperty = async (p: ManagedProperty) => {
        try {
            setSavingPropertyIds((prev) => ({ ...prev, [p.id]: true }))
            setCustomerSyncResult(null)

            const response = await authFetch(`${API_BASE}/api/customer-info/save-property/${p.id}`, {
                method: 'POST',
            })
            const data = await response.json().catch(() => ({}))

            if (!response.ok || !data.success) {
                setCustomerSyncResult({
                    type: 'error',
                    text: data.error || '고객 등록에 실패했습니다.',
                })
                return
            }

            const key = buildCustomerKey(p.managerName, p.managerPhone)
            setSavedCustomerKeys((prev) => new Set(prev).add(key))
            setCustomerSyncResult({
                type: 'success',
                text: `${p.managerName} 고객이 등록되었습니다.`,
            })
        } catch (error) {
            console.error('Customer info save failed:', error)
            setCustomerSyncResult({
                type: 'error',
                text: error instanceof Error ? error.message : '고객 등록에 실패했습니다.',
            })
        } finally {
            setSavingPropertyIds((prev) => ({ ...prev, [p.id]: false }))
        }
    }

    return (
        <div className="p-4 sm:p-6">
            {/* 헤더 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <ClipboardList className="w-6 h-6 text-emerald-400" />
                    <h1 className="text-xl sm:text-2xl font-bold text-hud-text-primary">{pageTitle || '관리매물'}</h1>
                    <span className="text-xs sm:text-sm text-hud-text-muted bg-hud-bg-secondary px-2.5 py-1 rounded-full">
                        {visibleProperties.length}건
                    </span>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    <Button
                        variant="outline"
                        onClick={() => navigate('/customers/management')}
                        className="w-full justify-center border-hud-border-secondary bg-hud-bg-card/70 text-hud-text-primary sm:w-auto"
                    >
                        <span className="inline-flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            고객정보 보기
                        </span>
                    </Button>
                    <Button
                        onClick={() => {
                            setShowForm(true)
                            setEditingId(null)
                            setForm({
                                ...emptyForm,
                                contractType: contractTypeFilter || emptyForm.contractType,
                            })
                        }}
                        className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white w-full sm:w-auto justify-center"
                    >
                        <Plus className="w-4 h-4" /> 매물 추가
                    </Button>
                </div>
            </div>

            {customerSyncResult && (
                <div className={`mb-4 rounded-xl border px-4 py-3 text-sm leading-6 ${customerSyncResult.type === 'success'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-red-500/30 bg-red-500/10 text-red-300'
                    }`}>
                    {customerSyncResult.text}
                </div>
            )}

            {/* 필터 */}
            <div className="flex flex-col gap-3 mb-6">
                {/* 계약사항 필터 */}
                <div className="flex items-center gap-2 bg-hud-bg-secondary rounded-lg p-2 overflow-x-auto">
                    <span className="text-xs font-semibold text-amber-400 whitespace-nowrap">계약사항알림</span>
                    <div className="flex items-center gap-1">
                        {RENEWAL_FILTERS.map(f => (
                            <button
                                key={f.label}
                                onClick={() => setRenewalFilter(f.days)}
                                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap ${renewalFilter === f.days ? 'bg-amber-500 text-white' : 'text-hud-text-muted hover:text-hud-text-primary'
                                    }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="rounded-2xl border border-hud-border-primary bg-hud-bg-secondary overflow-hidden">
                    <div className="px-4 sm:px-5 py-4 border-b border-hud-border-secondary bg-gradient-to-r from-yellow-500/10 via-transparent to-orange-500/10">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <div className="flex items-center gap-2 text-hud-text-primary">
                                    <MessageSquareText className="w-4 h-4 text-yellow-400" />
                                    <h2 className="text-sm sm:text-base font-semibold">카카오 알림 메시지</h2>
                                </div>
                                <p className="text-xs text-hud-text-muted mt-1">
                                    키값 연결 후 만료 알림 발송 기본 문구로 바로 쓰는 템플릿입니다.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setMessageTemplate(DEFAULT_KAKAO_TEMPLATE)}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-hud-border-secondary text-xs text-hud-text-secondary hover:text-hud-text-primary hover:bg-hud-bg-hover transition-hud"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                기본 문구 복원
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-0">
                        <div className="p-4 sm:p-5 border-b xl:border-b-0 xl:border-r border-hud-border-secondary space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-medium text-hud-text-muted">전송 메시지 에디터</label>
                                <span className="text-[11px] text-hud-text-muted">{messageTemplate.length}자</span>
                            </div>
                            <KakaoTemplateEditor value={messageTemplate} onChange={setMessageTemplate} />
                            <p className="text-[11px] text-hud-text-muted">
                                변수는 커서 위치에 바로 들어가고, 미리보기는 가장 가까운 만료 계약 기준으로 갱신됩니다.
                            </p>
                        </div>

                        <div className="p-4 sm:p-5 space-y-3">
                            <div>
                                <label className="text-xs font-medium text-hud-text-muted">미리보기</label>
                                <p className="text-[11px] text-hud-text-muted mt-1">
                                    {previewProperty
                                        ? `${previewProperty.articleName} · ${previewProperty.contractType} · 만료 ${formatDate(previewProperty.contractEndDate)}`
                                        : '미리보기에 사용할 관리매물이 아직 없습니다.'}
                                </p>
                                <p className="text-xs font-semibold text-yellow-300 mt-2">
                                    현재 발송 종류: {activeNotificationFilter.label}
                                </p>
                                <p className="text-[11px] text-hud-text-muted mt-1">
                                    현재 필터 기준 책임자 발송 대상 {notificationTargets.length}건, 연락처 누락 {skippedNotificationTargets.length}건
                                </p>
                            </div>

                            <div className="rounded-xl bg-hud-bg-primary border border-hud-border-secondary p-4 min-h-[220px]">
                                <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-hud-text-primary font-sans">
                                    {previewMessage}
                                </pre>
                            </div>

                            <div className="flex flex-col gap-3">
                                <Button
                                    onClick={handleSendNotification}
                                    disabled={visibleProperties.length === 0 || isSendingNotification}
                                    className="w-full justify-center bg-yellow-500 hover:bg-yellow-600 text-slate-950 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <span className="inline-flex items-center gap-2">
                                        <Send className="w-4 h-4" />
                                        {isSendingNotification ? `${activeNotificationFilter.label} 알림 전송 중...` : `${activeNotificationFilter.label} 책임자 알림 보내기`}
                                    </span>
                                </Button>

                                {sendResult && (
                                    <div className={`rounded-xl border px-3 py-3 text-xs leading-5 ${sendResult.type === 'success'
                                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                        : 'border-red-500/30 bg-red-500/10 text-red-300'
                                        }`}>
                                        {sendResult.text}
                                    </div>
                                )}
                            </div>

                            {previewProperty && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="rounded-xl bg-hud-bg-primary border border-hud-border-secondary p-3">
                                        <p className="text-[11px] text-hud-text-muted">책임자</p>
                                        <p className="text-sm text-hud-text-primary mt-1">{previewProperty.managerName || '-'}</p>
                                    </div>
                                    <div className="rounded-xl bg-hud-bg-primary border border-hud-border-secondary p-3">
                                        <p className="text-[11px] text-hud-text-muted">책임자 연락처</p>
                                        <p className="text-sm text-hud-text-primary mt-1">{previewProperty.managerPhone || '-'}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* 등록/수정 폼 모달 */}
            {showForm && (
                <div className="hud-modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="hud-modal-backdrop" />
                    <div className="hud-modal-panel w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="hud-modal-header px-4 sm:px-6">
                            <h2 className="text-base sm:text-lg font-bold text-hud-text-primary">{editingId ? '관리매물 수정' : '관리매물 등록'}</h2>
                            <button onClick={() => setShowForm(false)} className="hud-modal-close">
                                <X className="w-5 h-5 text-hud-text-muted" />
                            </button>
                        </div>
                        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 flex-1 overflow-y-auto">
                            {/* 기본 정보 */}
                            <div>
                                <h3 className="text-sm font-semibold text-hud-text-primary mb-3 flex items-center gap-2"><FileText className="w-4 h-4" /> 기본 정보</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="col-span-1 sm:col-span-2">
                                        <label className="block text-xs font-medium text-hud-text-muted mb-1">매물명 *</label>
                                        <input
                                            type="text"
                                            value={form.articleName}
                                            onChange={e => setForm(prev => ({ ...prev, articleName: e.target.value }))}
                                            placeholder="예: 래미안 101동 301호"
                                            className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-hud-text-muted mb-1">건물명/단지명</label>
                                        <input
                                            type="text"
                                            value={form.buildingName}
                                            onChange={e => setForm(prev => ({ ...prev, buildingName: e.target.value }))}
                                            placeholder="예: 래미안아파트"
                                            className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30"
                                        />
                                    </div>
                                    <div className="col-span-1 sm:col-span-2">
                                        <label className="block text-xs font-medium text-hud-text-muted mb-1">주소</label>
                                        <input
                                            type="text"
                                            value={form.address}
                                            onChange={e => setForm(prev => ({ ...prev, address: e.target.value }))}
                                            placeholder="예: 서울특별시 송파구 올림픽로 300"
                                            className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-hud-text-muted mb-1">거래 유형 *</label>
                                        <select
                                            value={form.contractType}
                                            onChange={e => setForm(prev => ({ ...prev, contractType: e.target.value }))}
                                            className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30"
                                        >
                                            {CONTRACT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-hud-text-muted mb-1">매물 유형</label>
                                        <select
                                            value={form.propertyType}
                                            onChange={e => setForm(prev => ({ ...prev, propertyType: e.target.value }))}
                                            className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30"
                                        >
                                            <option value="">선택안함</option>
                                            <option value="아파트">아파트</option>
                                            <option value="오피스텔">오피스텔</option>
                                            <option value="빌라">빌라</option>
                                            <option value="원룸">원룸</option>
                                            <option value="투룸">투룸</option>
                                            <option value="상가">상가</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* 납부 일정 */}
                            <div>
                                <h3 className="text-sm font-semibold text-hud-text-primary mb-3 flex items-center gap-2"><DollarSign className="w-4 h-4" /> 납부 일정</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-hud-text-muted mb-1">계약금 (만원)</label>
                                        <input
                                            type="number"
                                            value={form.downPayment}
                                            onChange={e => setForm(prev => ({ ...prev, downPayment: e.target.value }))}
                                            placeholder="5000"
                                            className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-hud-text-muted mb-1">계약금 납부일</label>
                                        <input
                                            type="date"
                                            value={form.downPaymentDate}
                                            onChange={e => setForm(prev => ({ ...prev, downPaymentDate: e.target.value }))}
                                            className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-hud-text-muted mb-1">중도금 (만원)</label>
                                        <input
                                            type="number"
                                            value={form.interimPayment}
                                            onChange={e => setForm(prev => ({ ...prev, interimPayment: e.target.value }))}
                                            placeholder="10000"
                                            className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-hud-text-muted mb-1">중도금 납부일</label>
                                        <input
                                            type="date"
                                            value={form.interimPaymentDate}
                                            onChange={e => setForm(prev => ({ ...prev, interimPaymentDate: e.target.value }))}
                                            className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-hud-text-muted mb-1">잔금 (만원)</label>
                                        <input
                                            type="number"
                                            value={form.finalPayment}
                                            onChange={e => setForm(prev => ({ ...prev, finalPayment: e.target.value }))}
                                            placeholder="15000"
                                            className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-hud-text-muted mb-1">잔금 납부일</label>
                                        <input
                                            type="date"
                                            value={form.finalPaymentDate}
                                            onChange={e => setForm(prev => ({ ...prev, finalPaymentDate: e.target.value }))}
                                            className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* 금액 정보 */}
                            <div>
                                <h3 className="text-sm font-semibold text-hud-text-primary mb-3 flex items-center gap-2"><DollarSign className="w-4 h-4" /> 금액 정보</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-hud-text-muted mb-1">총거래금액 (만원)</label>
                                        <input
                                            type="number"
                                            value={form.totalPrice}
                                            onChange={e => setForm(prev => ({ ...prev, totalPrice: e.target.value }))}
                                            className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-hud-text-muted mb-1">보증금 (만원)</label>
                                        <input
                                            type="number"
                                            value={form.depositAmount}
                                            onChange={e => setForm(prev => ({ ...prev, depositAmount: e.target.value }))}
                                            className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-hud-text-muted mb-1">월세 (만원)</label>
                                        <input
                                            type="number"
                                            value={form.monthlyRent}
                                            onChange={e => setForm(prev => ({ ...prev, monthlyRent: e.target.value }))}
                                            className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* 담당 정보 */}
                            <div>
                                <h3 className="text-sm font-semibold text-hud-text-primary mb-3 flex items-center gap-2"><User className="w-4 h-4" /> 담당 정보</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-hud-text-muted mb-1">임차인/매수인명</label>
                                        <input
                                            type="text"
                                            value={form.tenantName}
                                            onChange={e => setForm(prev => ({ ...prev, tenantName: e.target.value }))}
                                            className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-hud-text-muted mb-1">임차인/매수인 연락처</label>
                                        <input
                                            type="text"
                                            value={form.tenantPhone}
                                            onChange={e => setForm(prev => ({ ...prev, tenantPhone: e.target.value }))}
                                            className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-hud-text-muted mb-1">책임자명</label>
                                        <input
                                            type="text"
                                            value={form.managerName}
                                            onChange={e => setForm(prev => ({ ...prev, managerName: e.target.value }))}
                                            className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-hud-text-muted mb-1">책임자 연락처</label>
                                        <input
                                            type="text"
                                            value={form.managerPhone}
                                            onChange={e => setForm(prev => ({ ...prev, managerPhone: e.target.value }))}
                                            className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* 메모 */}
                            <div>
                                <label className="block text-xs font-medium text-hud-text-muted mb-1">메모</label>
                                <textarea
                                    value={form.notes}
                                    onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                                    rows={2}
                                    className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30 resize-none"
                                />
                            </div>
                        </div>
                        <div className="hud-modal-footer px-4 sm:px-6">
                            <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1 sm:flex-none">취소</Button>
                            <Button onClick={handleSubmit} className="bg-emerald-500 hover:bg-emerald-600 text-white flex-1 sm:flex-none">
                                {editingId ? '수정' : '등록'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* 리스트 */}
            <div className="rounded-2xl border border-hud-border-primary bg-hud-bg-secondary/70 overflow-hidden">
                <div className="border-b border-hud-border-secondary bg-hud-bg-tertiary/40 p-3 sm:p-4">
                    <div className="relative rounded-xl border border-hud-border-secondary bg-hud-bg-primary/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-hud-text-muted" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="매물명, 건물명, 주소, 거래유형, 임차인/책임자, 연락처 검색..."
                            className="w-full rounded-xl border-0 bg-white/[0.03] py-2.5 pl-10 pr-11 text-sm text-hud-text-primary placeholder:text-hud-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                        />
                        {trimmedSearchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-hud-text-muted transition-hud hover:bg-hud-bg-hover hover:text-hud-text-primary"
                                aria-label="검색어 지우기"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                    <div className="mt-2 flex flex-col gap-1 text-[11px] text-hud-text-muted sm:flex-row sm:items-center sm:justify-between">
                        <p>전화번호는 하이픈 없이 입력해도 검색됩니다.</p>
                        <p>현재 {currentRangeLabel}{trimmedSearchTerm ? ` · 전체 ${properties.length}건` : ''}</p>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20 text-hud-text-muted">로딩 중...</div>
                ) : visibleProperties.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-hud-text-muted">
                        <ClipboardList className="mb-4 h-12 w-12 opacity-30" />
                        <p className="text-lg font-medium">{trimmedSearchTerm ? '검색 결과가 없습니다' : '관리매물이 없습니다'}</p>
                        <p className="mt-1 text-sm">
                            {trimmedSearchTerm
                                ? '다른 검색어로 다시 확인해보세요'
                                : renewalFilter !== undefined
                                    ? '선택한 계약사항 알림 조건에 맞는 관리매물이 없습니다'
                                    : '위의 "매물 추가" 버튼으로 관리 매물을 등록하세요'}
                        </p>
                    </div>
                ) : (
                    <>
                        {/* 데스크톱: 테이블 뷰 */}
                        <div className="hidden sm:block overflow-hidden">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b-2 border-hud-border-primary bg-hud-bg-tertiary">
                                        <th className="px-4 py-3 text-left text-xs font-bold text-hud-text-primary uppercase tracking-wider">매물명</th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-hud-text-primary uppercase tracking-wider">매물유형</th>
                                        <th className="px-4 py-3 text-center text-xs font-bold text-hud-text-primary uppercase tracking-wider">거래</th>
                                        <th className="px-4 py-3 text-right text-xs font-bold text-hud-text-primary uppercase tracking-wider">가격</th>
                                        <th className="px-4 py-3 text-right text-xs font-bold text-hud-text-primary uppercase tracking-wider">월세</th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-hud-text-primary uppercase tracking-wider">책임자명</th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-hud-text-primary uppercase tracking-wider">전화번호</th>
                                        <th className="px-4 py-3 text-right text-xs font-bold text-hud-text-primary uppercase tracking-wider w-24">관리</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-hud-bg-secondary">
                                    {pagedProperties.map((p) => {
                                        const price = p.contractType === '매매' ? p.totalPrice
                                            : p.contractType === '전세' ? p.depositAmount
                                                : p.monthlyRent;

                                        return (
                                            <tr key={p.id} className="border-b border-hud-border-primary/50 hover:bg-hud-bg-hover transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="space-y-1">
                                                        <span className="text-sm font-medium text-hud-text-primary">{p.articleName}</span>
                                                        {getNotificationBadges(p).length > 0 && (
                                                            <div className="flex flex-wrap gap-1">
                                                                {getNotificationBadges(p).map(([key]) => (
                                                                    <span
                                                                        key={key}
                                                                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ${getNotificationBadgeClass(key)}`}
                                                                    >
                                                                        {NOTIFICATION_TYPE_LABELS[key]}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="text-xs px-2 py-1 bg-hud-bg-primary rounded-md text-hud-text-secondary">{p.propertyType || '-'}</span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-lg ${p.contractType === '매매' ? 'bg-red-500/15 text-red-400'
                                                        : p.contractType === '전세' ? 'bg-emerald-500/15 text-emerald-400'
                                                            : 'bg-amber-500/15 text-amber-400'
                                                        }`}>{p.contractType}</span>
                                                </td>
                                                <td className="px-4 py-3 text-right text-sm font-semibold text-hud-text-primary">{formatPrice(price)}</td>
                                                <td className="px-4 py-3 text-right text-sm text-hud-text-secondary">{p.monthlyRent ? formatPrice(p.monthlyRent) : '-'}</td>
                                                <td className="px-4 py-3 text-sm text-hud-text-secondary">{p.managerName || '-'}</td>
                                                <td className="px-4 py-3 text-sm text-hud-text-secondary">{p.managerPhone || '-'}</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button
                                                            onClick={() => void handleSaveCustomerForProperty(p)}
                                                            disabled={!!savingPropertyIds[p.id] || !p.managerName}
                                                            className={`p-1.5 rounded-lg transition-all ${isCustomerSaved(p) ? 'text-emerald-400 bg-emerald-500/10' : 'text-hud-text-muted hover:text-emerald-400 hover:bg-emerald-500/10'} disabled:opacity-30 disabled:cursor-not-allowed`}
                                                            title={!p.managerName ? '책임자명 없음' : isCustomerSaved(p) ? '고객 등록됨' : '고객 등록'}
                                                        >
                                                            {isCustomerSaved(p) ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                                                        </button>
                                                        <button onClick={() => viewDetail(p)} className="p-1.5 text-hud-text-muted hover:text-hud-accent-info hover:bg-hud-accent-info/10 rounded-lg transition-all" title="상세보기">
                                                            <Eye className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => handleEdit(p)} className="p-1.5 text-hud-text-muted hover:text-hud-accent-primary hover:bg-hud-accent-primary/10 rounded-lg transition-all" title="수정">
                                                            <Pencil className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => handleDelete(p.id)} className="p-1.5 text-hud-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all" title="삭제">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* 모바일: 카드 뷰 */}
                        <div className="space-y-3 p-3 sm:hidden">
                            {pagedProperties.map((p) => {
                                const price = p.contractType === '매매' ? p.totalPrice
                                    : p.contractType === '전세' ? p.depositAmount
                                        : p.monthlyRent;

                                return (
                                    <div key={p.id} className="bg-hud-bg-secondary rounded-xl border border-hud-border-secondary overflow-hidden">
                                        {/* 헤더: 매물명 + 거래유형 + 버튼 */}
                                        <div className="flex items-center justify-between gap-3 p-4 border-b border-hud-border-secondary/50">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-sm font-semibold text-hud-text-primary truncate">{p.articleName}</h3>
                                                {getNotificationBadges(p).length > 0 && (
                                                    <div className="mt-2 flex flex-wrap gap-1">
                                                        {getNotificationBadges(p).map(([key]) => (
                                                            <span
                                                                key={key}
                                                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ${getNotificationBadgeClass(key)}`}
                                                            >
                                                                {NOTIFICATION_TYPE_LABELS[key]}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <span className={`shrink-0 inline-flex px-2 py-1 text-xs font-medium rounded-lg ${p.contractType === '매매' ? 'bg-red-500/15 text-red-400'
                                                : p.contractType === '전세' ? 'bg-emerald-500/15 text-emerald-400'
                                                    : 'bg-amber-500/15 text-amber-400'
                                                }`}>{p.contractType}</span>
                                        </div>

                                        {/* 본문 */}
                                        <div className="p-4 space-y-3">
                                            {/* 가격 정보 */}
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-hud-text-muted">가격</span>
                                                <span className="text-base font-bold text-hud-text-primary">{formatPrice(price)}</span>
                                            </div>

                                            {/* 납부 정보 */}
                                            {(p.downPayment || p.interimPayment || p.finalPayment) && (
                                                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-hud-border-secondary/30">
                                                    {p.downPayment && (
                                                        <div className="text-center">
                                                            <div className="text-xs text-hud-text-muted mb-1">계약금</div>
                                                            <div className="text-sm font-medium text-hud-text-primary">{formatPrice(p.downPayment)}</div>
                                                        </div>
                                                    )}
                                                    {p.interimPayment && (
                                                        <div className="text-center">
                                                            <div className="text-xs text-hud-text-muted mb-1">중도금</div>
                                                            <div className="text-sm font-medium text-hud-text-primary">{formatPrice(p.interimPayment)}</div>
                                                        </div>
                                                    )}
                                                    {p.finalPayment && (
                                                        <div className="text-center">
                                                            <div className="text-xs text-hud-text-muted mb-1">잔금</div>
                                                            <div className="text-sm font-medium text-hud-text-primary">{formatPrice(p.finalPayment)}</div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* 하단: 저장일 + 관리 버튼 */}
                                        <div className="flex items-center justify-between px-4 py-3 bg-hud-bg-primary/30">
                                            <span className="text-xs text-hud-text-muted">{formatDate(p.createdAt)}</span>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => void handleSaveCustomerForProperty(p)}
                                                    disabled={!!savingPropertyIds[p.id] || !p.managerName}
                                                    className={`p-1.5 rounded-lg transition-all ${isCustomerSaved(p) ? 'text-emerald-400 bg-emerald-500/10' : 'text-hud-text-muted hover:text-emerald-400 hover:bg-emerald-500/10'} disabled:opacity-30 disabled:cursor-not-allowed`}
                                                    title={!p.managerName ? '책임자명 없음' : isCustomerSaved(p) ? '고객 등록됨' : '고객 등록'}
                                                >
                                                    {isCustomerSaved(p) ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                                                </button>
                                                <button onClick={() => viewDetail(p)} className="p-1.5 text-hud-text-muted hover:text-hud-accent-info hover:bg-hud-accent-info/10 rounded-lg transition-all" title="상세보기">
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleEdit(p)} className="p-1.5 text-hud-text-muted hover:text-hud-accent-primary hover:bg-hud-accent-primary/10 rounded-lg transition-all" title="수정">
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDelete(p.id)} className="p-1.5 text-hud-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all" title="삭제">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        <div className="flex flex-col gap-3 border-t border-hud-border-secondary bg-hud-bg-secondary/25 px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                            <span className="text-hud-text-secondary">
                                {currentRangeLabel}
                            </span>
                            {totalPages > 1 && (
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
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* 상세보기 모달 */}
            {showDetailModal && detailProperty && (
                <div className="hud-modal-overlay" onClick={() => setShowDetailModal(false)}>
                    <div className="hud-modal-backdrop" />
                    <div className="hud-modal-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="hud-modal-header px-6 sticky top-0 z-10">
                            <h2 className="text-lg font-bold text-hud-text-primary">관리매물 상세정보</h2>
                            <button onClick={() => setShowDetailModal(false)} className="hud-modal-close">
                                <X className="w-5 h-5 text-hud-text-muted" />
                            </button>
                        </div>
                        <div className="p-6 space-y-5">
                            {/* 기본 정보 */}
                            <div>
                                <h3 className="text-sm font-semibold text-hud-text-primary mb-3 flex items-center gap-2">
                                    <Home className="w-4 h-4 text-hud-accent-primary" />
                                    기본 정보
                                </h3>
                                <div className="space-y-3">
                                    <div>
                                        <span className="text-xs text-hud-text-muted">매물명</span>
                                        <p className="text-base font-medium text-hud-text-primary mt-1">{detailProperty.articleName}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <span className="text-xs text-hud-text-muted">건물명</span>
                                            <p className="text-sm text-hud-text-secondary mt-1">{detailProperty.buildingName || '-'}</p>
                                        </div>
                                        <div>
                                            <span className="text-xs text-hud-text-muted">거래 유형</span>
                                            <p className="text-sm text-hud-text-secondary mt-1">{detailProperty.contractType}</p>
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-xs text-hud-text-muted">주소</span>
                                        <p className="text-sm text-hud-text-secondary mt-1">{detailProperty.address || '-'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* 계약 정보 */}
                            <div>
                                <h3 className="text-sm font-semibold text-hud-text-primary mb-3 flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-hud-accent-warning" />
                                    계약 정보
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <span className="text-xs text-hud-text-muted">계약 시작일</span>
                                        <p className="text-sm text-hud-text-secondary mt-1">{formatDate(detailProperty.contractDate)}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-hud-text-muted">계약 만료일</span>
                                        <p className="text-sm text-hud-text-secondary mt-1">{formatDate(detailProperty.contractEndDate)}</p>
                                    </div>
                                </div>
                                <div className="mt-3 p-3 bg-hud-bg-primary rounded-lg">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-hud-text-muted">계약 만료까지</span>
                                        <span className={`text-sm font-bold ${getDaysUntilExpiry(detailProperty.contractEndDate) <= 30 ? 'text-red-400' : 'text-hud-accent-primary'}`}>
                                            D-{getDaysUntilExpiry(detailProperty.contractEndDate)}
                                        </span>
                                    </div>
                                    {detailProperty.lastNotificationSentAt && (
                                        <div className="mt-3 flex items-center justify-between border-t border-hud-border-secondary/40 pt-3">
                                            <span className="text-xs text-hud-text-muted">최근 알림 발송</span>
                                            <span className="inline-flex items-center rounded-full bg-yellow-500/15 px-2.5 py-1 text-[11px] font-medium text-yellow-300 border border-yellow-500/25">
                                                {formatDateTime(detailProperty.lastNotificationSentAt)}
                                            </span>
                                        </div>
                                    )}
                                    <div className="mt-3 border-t border-hud-border-secondary/40 pt-3">
                                        <span className="text-xs text-hud-text-muted">알림 종류별 발송 여부</span>
                                        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {Object.entries(NOTIFICATION_TYPE_LABELS).map(([key, label]) => {
                                                const sentAt = normalizeNotificationHistory(detailProperty.notificationHistory)[key]
                                                return (
                                                    <div
                                                        key={key}
                                                        className={`rounded-lg border px-3 py-2 ${sentAt
                                                            ? getNotificationBadgeClass(key)
                                                            : 'border-hud-border-secondary bg-hud-bg-secondary'
                                                            }`}
                                                    >
                                                        <p className="text-[11px] text-hud-text-muted">{label}</p>
                                                        <p className={`mt-1 text-xs font-semibold ${sentAt ? 'text-white' : 'text-hud-text-secondary'}`}>
                                                            {sentAt ? `발송 ${formatDateTime(sentAt)}` : '미발송'}
                                                        </p>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 금액 정보 */}
                            <div>
                                <h3 className="text-sm font-semibold text-hud-text-primary mb-3 flex items-center gap-2">
                                    <DollarSign className="w-4 h-4 text-hud-accent-success" />
                                    금액 정보
                                </h3>
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <span className="text-xs text-hud-text-muted">총거래금액</span>
                                        <p className="text-sm font-semibold text-hud-text-primary mt-1">{formatPrice(detailProperty.totalPrice)}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-hud-text-muted">보증금</span>
                                        <p className="text-sm font-semibold text-hud-text-primary mt-1">{formatPrice(detailProperty.depositAmount)}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-hud-text-muted">월세</span>
                                        <p className="text-sm font-semibold text-hud-text-primary mt-1">{detailProperty.monthlyRent ? `${detailProperty.monthlyRent}만` : '-'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* 납부 일정 */}
                            {(detailProperty.downPayment || detailProperty.interimPayment || detailProperty.finalPayment) && (
                                <div>
                                    <h3 className="text-sm font-semibold text-hud-text-primary mb-3 flex items-center gap-2">
                                        <DollarSign className="w-4 h-4 text-hud-accent-info" />
                                        납부 일정
                                    </h3>
                                    <div className="space-y-2">
                                        {detailProperty.downPayment && (
                                            <div className="flex items-center justify-between p-2 bg-hud-bg-primary rounded-lg">
                                                <span className="text-xs text-hud-text-muted">계약금</span>
                                                <div className="text-right">
                                                    <span className="text-sm font-medium text-hud-text-primary">{formatPrice(detailProperty.downPayment)}</span>
                                                    {detailProperty.downPaymentDate && <span className="text-xs text-hud-text-muted ml-2">{formatDate(detailProperty.downPaymentDate)}</span>}
                                                </div>
                                            </div>
                                        )}
                                        {detailProperty.interimPayment && (
                                            <div className="flex items-center justify-between p-2 bg-hud-bg-primary rounded-lg">
                                                <span className="text-xs text-hud-text-muted">중도금</span>
                                                <div className="text-right">
                                                    <span className="text-sm font-medium text-hud-text-primary">{formatPrice(detailProperty.interimPayment)}</span>
                                                    {detailProperty.interimPaymentDate && <span className="text-xs text-hud-text-muted ml-2">{formatDate(detailProperty.interimPaymentDate)}</span>}
                                                </div>
                                            </div>
                                        )}
                                        {detailProperty.finalPayment && (
                                            <div className="flex items-center justify-between p-2 bg-hud-bg-primary rounded-lg">
                                                <span className="text-xs text-hud-text-muted">잔금</span>
                                                <div className="text-right">
                                                    <span className="text-sm font-medium text-hud-text-primary">{formatPrice(detailProperty.finalPayment)}</span>
                                                    {detailProperty.finalPaymentDate && <span className="text-xs text-hud-text-muted ml-2">{formatDate(detailProperty.finalPaymentDate)}</span>}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* 담당자 정보 */}
                            {(detailProperty.tenantName || detailProperty.tenantPhone || detailProperty.managerName || detailProperty.managerPhone) && (
                                <div>
                                    <h3 className="text-sm font-semibold text-hud-text-primary mb-3 flex items-center gap-2">
                                        <User className="w-4 h-4 text-hud-accent-danger" />
                                        담당자 정보
                                    </h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <span className="text-xs text-hud-text-muted">책임자명</span>
                                            <p className="text-sm text-hud-text-secondary mt-1">{detailProperty.tenantName || '-'}</p>
                                        </div>
                                        <div>
                                            <span className="text-xs text-hud-text-muted">책임자 연락처</span>
                                            <p className="text-sm text-hud-text-secondary mt-1">{detailProperty.tenantPhone || '-'}</p>
                                        </div>
                                        <div>
                                            <span className="text-xs text-hud-text-muted">책임자명</span>
                                            <p className="text-sm text-hud-text-secondary mt-1">{detailProperty.managerName || '-'}</p>
                                        </div>
                                        <div>
                                            <span className="text-xs text-hud-text-muted">책임자 연락처</span>
                                            <p className="text-sm text-hud-text-secondary mt-1">{detailProperty.managerPhone || '-'}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 메모 */}
                            {detailProperty.notes && (
                                <div>
                                    <h3 className="text-sm font-semibold text-hud-text-primary mb-3 flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-hud-accent-primary" />
                                        메모
                                    </h3>
                                    <p className="text-sm text-hud-text-secondary bg-hud-bg-primary p-3 rounded-lg">{detailProperty.notes}</p>
                                </div>
                            )}
                        </div>
                        <div className="hud-modal-footer px-6 sticky bottom-0">
                            <Button
                                variant="outline"
                                onClick={() => { setShowDetailModal(false); handleEdit(detailProperty); }}
                                className="flex items-center gap-2"
                            >
                                <Pencil className="w-4 h-4" />
                                수정
                            </Button>
                            <Button onClick={() => setShowDetailModal(false)}>닫기</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
