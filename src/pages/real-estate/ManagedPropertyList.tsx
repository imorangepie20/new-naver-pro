import { useState, useEffect } from 'react'
import {
    ClipboardList, Plus, Pencil, Trash2, X,
    DollarSign, User, FileText, Eye, Home, Calendar, Building2
} from 'lucide-react'
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
    notes?: string | null
    status: string
    createdAt: string
}

const RENEWAL_FILTERS = [
    { label: '전체', days: undefined },
    { label: '3개월', days: 90 },
    { label: '1개월', days: 30 },
    { label: '15일', days: 15 },
    { label: '7일', days: 7 },
    { label: '3일', days: 3 },
    { label: '1일', days: 1 },
]

const CONTRACT_TYPES = ['매매', '전세', '월세']

function formatPrice(price?: number | null) {
    if (!price) return '-'
    if (price >= 10000) return `${Math.floor(price / 10000)}억${price % 10000 > 0 ? ` ${(price % 10000).toLocaleString()}` : ''}`
    return `${price.toLocaleString()}만`
}

function formatDate(dateStr?: string | null) {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const emptyForm = {
    articleName: '', buildingName: '', address: '', contractType: '전세', propertyType: '',
    downPayment: '', downPaymentDate: '', interimPayment: '', interimPaymentDate: '',
    finalPayment: '', finalPaymentDate: '', contractDate: '', contractEndDate: '',
    totalPrice: '', depositAmount: '', monthlyRent: '',
    tenantName: '', tenantPhone: '', managerName: '', managerPhone: '', notes: '',
}

export default function ManagedPropertyList() {
    const authFetch = useAuthStore((state) => state.authFetch)
    const [properties, setProperties] = useState<ManagedProperty[]>([])
    const [loading, setLoading] = useState(true)
    const [renewalFilter, setRenewalFilter] = useState<number | undefined>(undefined)
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [form, setForm] = useState(emptyForm)

    // ========== 상세보기 모달 상태 ==========
    const [showDetailModal, setShowDetailModal] = useState(false)
    const [detailProperty, setDetailProperty] = useState<ManagedProperty | null>(null)

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

    useEffect(() => { void fetchProperties() }, [renewalFilter])

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

    return (
        <div className="p-4 sm:p-6">
            {/* 헤더 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <ClipboardList className="w-6 h-6 text-emerald-400" />
                    <h1 className="text-xl sm:text-2xl font-bold text-hud-text-primary">관리매물</h1>
                    <span className="text-xs sm:text-sm text-hud-text-muted bg-hud-bg-secondary px-2.5 py-1 rounded-full">
                        {properties.length}건
                    </span>
                </div>
                <Button
                    onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm) }}
                    className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white w-full sm:w-auto justify-center"
                >
                    <Plus className="w-4 h-4" /> 매물 추가
                </Button>
            </div>

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
                                        <label className="block text-xs font-medium text-hud-text-muted mb-1">세입자명</label>
                                        <input
                                            type="text"
                                            value={form.tenantName}
                                            onChange={e => setForm(prev => ({ ...prev, tenantName: e.target.value }))}
                                            className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-hud-text-muted mb-1">세입자 연락처</label>
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
            {loading ? (
                <div className="flex items-center justify-center py-20 text-hud-text-muted">로딩 중...</div>
            ) : properties.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-hud-text-muted">
                    <ClipboardList className="w-12 h-12 mb-4 opacity-30" />
                    <p className="text-lg font-medium">관리매물이 없습니다</p>
                    <p className="text-sm mt-1">위의 "매물 추가" 버튼으로 관리 매물을 등록하세요</p>
                </div>
            ) : (
                <>
                    {/* 데스크톱: 테이블 뷰 */}
                    <div className="hidden sm:block rounded-xl overflow-hidden border border-hud-border-primary">
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
                                {properties.map((p) => {
                                    const price = p.contractType === '매매' ? p.totalPrice
                                        : p.contractType === '전세' ? p.depositAmount
                                        : p.monthlyRent;

                                    return (
                                        <tr key={p.id} className="border-b border-hud-border-primary/50 hover:bg-hud-bg-hover transition-colors">
                                            <td className="px-4 py-3 text-sm font-medium text-hud-text-primary">{p.articleName}</td>
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
                                            <td className="px-4 py-3 text-right text-sm text-hud-text-secondary">{p.monthlyRent ? `${formatPrice(p.monthlyRent)}만` : '-'}</td>
                                            <td className="px-4 py-3 text-sm text-hud-text-secondary">{p.managerName || '-'}</td>
                                            <td className="px-4 py-3 text-sm text-hud-text-secondary">{p.managerPhone || '-'}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-1">
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
                    <div className="sm:hidden space-y-3">
                        {properties.map((p) => {
                            const price = p.contractType === '매매' ? p.totalPrice
                                : p.contractType === '전세' ? p.depositAmount
                                : p.monthlyRent;

                            return (
                                <div key={p.id} className="bg-hud-bg-secondary rounded-xl border border-hud-border-secondary overflow-hidden">
                                    {/* 헤더: 매물명 + 거래유형 + 버튼 */}
                                    <div className="flex items-center justify-between gap-3 p-4 border-b border-hud-border-secondary/50">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-sm font-semibold text-hud-text-primary truncate">{p.articleName}</h3>
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
                </>
            )}

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
                                            <span className="text-xs text-hud-text-muted">세입자명</span>
                                            <p className="text-sm text-hud-text-secondary mt-1">{detailProperty.tenantName || '-'}</p>
                                        </div>
                                        <div>
                                            <span className="text-xs text-hud-text-muted">세입자 연락처</span>
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
