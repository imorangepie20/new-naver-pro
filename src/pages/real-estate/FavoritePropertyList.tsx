import { useState, useEffect, useMemo } from 'react'
import { Heart, Search, Trash2, Plus, Pencil, X, Eye, Home, DollarSign, FileText } from 'lucide-react'
import Button from '../../components/common/Button'
import { useAuthStore } from '../../stores/authStore'
import { API_BASE } from '../../lib/api'

interface FavoriteProperty {
    id: string
    articleName: string
    buildingName?: string | null
    address?: string | null
    propertyType?: string | null
    tradeType?: string | null
    price?: number | null
    area?: number | null
    notes?: string | null
    createdAt: string
}

const PROPERTY_TYPES = ['아파트', '오피스텔', '빌라', '주택', '상가', '토지', '기타']
const TRADE_TYPES = ['매매', '전세', '월세']

const emptyForm = {
    articleName: '', buildingName: '', address: '',
    propertyType: '', tradeType: '', price: '', area: '', notes: '',
}

function formatPrice(price?: number | null) {
    if (!price) return '-'
    if (price >= 10000) return `${Math.floor(price / 10000)}억${price % 10000 > 0 ? ` ${(price % 10000).toLocaleString()}` : ''}`
    return `${price.toLocaleString()}만`
}

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export default function FavoritePropertyList() {
    const authFetch = useAuthStore((state) => state.authFetch)
    const [properties, setProperties] = useState<FavoriteProperty[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [form, setForm] = useState(emptyForm)

    // ========== 상세보기 모달 상태 ==========
    const [showDetailModal, setShowDetailModal] = useState(false)
    const [detailProperty, setDetailProperty] = useState<FavoriteProperty | null>(null)

    const fetchFavorites = async () => {
        try {
            setLoading(true)
            const res = await authFetch(`${API_BASE}/api/favorite-properties`)
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

    useEffect(() => { void fetchFavorites() }, [])

    const handleSubmit = async () => {
        const body: any = { ...form }
        body.price = body.price ? parseInt(body.price) : null
        body.area = body.area ? parseFloat(body.area) : null

        try {
            if (editingId) {
                await authFetch(`${API_BASE}/api/favorite-properties/${editingId}`, {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
                })
            } else {
                await authFetch(`${API_BASE}/api/favorite-properties`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
                })
            }
            setShowForm(false)
            setEditingId(null)
            setForm(emptyForm)
            void fetchFavorites()
        } catch (err) {
            console.error('Failed to save:', err)
        }
    }

    const handleEdit = (p: FavoriteProperty) => {
        setEditingId(p.id)
        setForm({
            articleName: p.articleName || '', buildingName: p.buildingName || '', address: p.address || '',
            propertyType: p.propertyType || '', tradeType: p.tradeType || '',
            price: p.price ? String(p.price) : '', area: p.area ? String(p.area) : '', notes: p.notes || '',
        })
        setShowForm(true)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('삭제하시겠습니까?')) return
        try {
            await authFetch(`${API_BASE}/api/favorite-properties/${id}`, { method: 'DELETE' })
            void fetchFavorites()
        } catch (err) {
            console.error('Failed to delete:', err)
        }
    }

    const viewDetail = (p: FavoriteProperty) => {
        setDetailProperty(p)
        setShowDetailModal(true)
    }

    const filtered = useMemo(() => {
        if (!searchTerm) return properties
        const term = searchTerm.toLowerCase()
        return properties.filter(p =>
            (p.articleName || '').toLowerCase().includes(term) ||
            (p.buildingName || '').toLowerCase().includes(term) ||
            (p.address || '').toLowerCase().includes(term)
        )
    }, [properties, searchTerm])

    return (
        <div className="p-4 sm:p-6">
            {/* 헤더 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <h1 className="text-xl sm:text-2xl font-bold text-hud-text-primary">관심매물</h1>
                    <span className="text-xs sm:text-sm text-hud-text-muted bg-hud-bg-secondary px-2.5 py-1 rounded-full">
                        {filtered.length}건
                    </span>
                </div>
                <Button
                    onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm) }}
                    className="flex items-center gap-2 bg-pink-500 hover:bg-pink-600 text-white w-full sm:w-auto justify-center"
                >
                    <Plus className="w-4 h-4" /> 매물 추가
                </Button>
            </div>

            {/* 검색 */}
            <div className="relative mb-4 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hud-text-muted" />
                <input
                    type="text"
                    placeholder="매물명, 건물명, 주소 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-hud-bg-secondary border border-hud-border-secondary rounded-xl text-sm text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30"
                />
            </div>

            {/* 등록/수정 폼 모달 */}
            {showForm && (
                <div className="hud-modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="hud-modal-backdrop" />
                    <div className="hud-modal-panel w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="hud-modal-header px-6">
                            <h2 className="text-lg font-bold text-hud-text-primary">{editingId ? '관심매물 수정' : '관심매물 등록'}</h2>
                            <button onClick={() => setShowForm(false)} className="hud-modal-close"><X className="w-5 h-5 text-hud-text-muted" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
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
                                <label className="block text-xs font-medium text-hud-text-muted mb-1">주소</label>
                                <input
                                    type="text"
                                    value={form.address}
                                    onChange={e => setForm(prev => ({ ...prev, address: e.target.value }))}
                                    placeholder="예: 서울시 강남구..."
                                    className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-hud-text-muted mb-1">매물 유형</label>
                                    <select value={form.propertyType} onChange={e => setForm(prev => ({ ...prev, propertyType: e.target.value }))}
                                        className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary">
                                        <option value="">선택</option>
                                        {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-hud-text-muted mb-1">거래 유형</label>
                                    <select value={form.tradeType} onChange={e => setForm(prev => ({ ...prev, tradeType: e.target.value }))}
                                        className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary">
                                        <option value="">선택</option>
                                        {TRADE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-hud-text-muted mb-1">가격 (만원)</label>
                                    <input
                                        type="number"
                                        value={form.price}
                                        onChange={e => setForm(prev => ({ ...prev, price: e.target.value }))}
                                        placeholder="예: 50000"
                                        className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-hud-text-muted mb-1">면적 (㎡)</label>
                                    <input
                                        type="number"
                                        value={form.area}
                                        onChange={e => setForm(prev => ({ ...prev, area: e.target.value }))}
                                        placeholder="예: 84.5"
                                        className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-hud-text-muted mb-1">메모</label>
                                <textarea
                                    value={form.notes}
                                    onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                                    rows={3}
                                    className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary resize-none"
                                />
                            </div>
                        </div>
                        <div className="hud-modal-footer px-6">
                            <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1 sm:flex-none">취소</Button>
                            <Button onClick={handleSubmit} className="bg-pink-500 hover:bg-pink-600 text-white flex-1 sm:flex-none">
                                {editingId ? '수정' : '등록'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* 리스트 */}
            {loading ? (
                <div className="flex items-center justify-center py-20 text-hud-text-muted">로딩 중...</div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-hud-text-muted">
                    <Heart className="w-12 h-12 mb-4 opacity-30" />
                    <p className="text-lg font-medium">관심매물이 없습니다</p>
                    <p className="text-sm mt-1">"매물 추가" 버튼으로 관심 매물을 등록하세요</p>
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
                                    <th className="px-4 py-3 text-right text-xs font-bold text-hud-text-primary uppercase tracking-wider">면적</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-hud-text-primary uppercase tracking-wider">층</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-hud-text-primary uppercase tracking-wider">책임자명</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-hud-text-primary uppercase tracking-wider">전화번호</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-hud-text-primary uppercase tracking-wider w-24">관리</th>
                                </tr>
                            </thead>
                            <tbody className="bg-hud-bg-secondary">
                                {filtered.map((p) => (
                                    <tr key={p.id} className="border-b border-hud-border-primary/50 hover:bg-hud-bg-hover transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="text-sm font-medium text-hud-text-primary">{p.articleName}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-xs px-2 py-1 bg-hud-bg-primary rounded-md text-hud-text-secondary">{p.propertyType || '-'}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {p.tradeType ? (
                                                <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-lg ${p.tradeType === '매매' ? 'bg-red-500/15 text-red-400'
                                                        : p.tradeType === '전세' ? 'bg-emerald-500/15 text-emerald-400'
                                                            : 'bg-amber-500/15 text-amber-400'
                                                    }`}>{p.tradeType}</span>
                                            ) : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm font-semibold text-hud-text-primary">{formatPrice(p.price)}</td>
                                        <td className="px-4 py-3 text-right text-sm text-hud-text-secondary">-</td>
                                        <td className="px-4 py-3 text-right text-sm text-hud-text-secondary">{p.area ? `${p.area}㎡` : '-'}</td>
                                        <td className="px-4 py-3 text-center text-sm text-hud-text-secondary">-</td>
                                        <td className="px-4 py-3 text-sm text-hud-text-secondary">-</td>
                                        <td className="px-4 py-3 text-sm text-hud-text-secondary">-</td>
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
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* 모바일: 카드 뷰 */}
                    <div className="sm:hidden space-y-3">
                        {filtered.map((p) => (
                            <div key={p.id} className="bg-hud-bg-secondary rounded-xl border border-hud-border-secondary overflow-hidden">
                                {/* 헤더: 매물명 + 거래유형 + 버튼 */}
                                <div className="flex items-center justify-between gap-3 p-4 border-b border-hud-border-secondary/50">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-semibold text-hud-text-primary truncate">{p.articleName}</h3>
                                        {p.buildingName && <p className="text-xs text-hud-text-muted mt-0.5 truncate">{p.buildingName}</p>}
                                    </div>
                                    {p.tradeType && (
                                        <span className={`shrink-0 inline-flex px-2 py-1 text-xs font-medium rounded-lg ${p.tradeType === '매매' ? 'bg-red-500/15 text-red-400'
                                                : p.tradeType === '전세' ? 'bg-emerald-500/15 text-emerald-400'
                                                    : 'bg-amber-500/15 text-amber-400'
                                            }`}>{p.tradeType}</span>
                                    )}
                                </div>

                                {/* 본문 */}
                                <div className="p-4 space-y-3">
                                    {/* 가격/면적 */}
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-hud-text-muted">가격</span>
                                        <span className="text-base font-bold text-hud-accent-primary">{formatPrice(p.price)}</span>
                                    </div>
                                    {p.area && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-hud-text-muted">면적</span>
                                            <span className="text-sm text-hud-text-secondary">{p.area}㎡</span>
                                        </div>
                                    )}
                                    {p.propertyType && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-hud-text-muted">유형</span>
                                            <span className="text-xs px-2 py-1 bg-hud-bg-primary rounded-md text-hud-text-secondary">{p.propertyType}</span>
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
                        ))}
                    </div>
                </>
            )}

            {/* 상세보기 모달 */}
            {showDetailModal && detailProperty && (
                <div className="hud-modal-overlay" onClick={() => setShowDetailModal(false)}>
                    <div className="hud-modal-backdrop" />
                    <div className="hud-modal-panel w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="hud-modal-header px-6 sticky top-0 z-10">
                            <h2 className="text-lg font-bold text-hud-text-primary">관심매물 상세정보</h2>
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
                                        <p className="text-base font-medium text-hud-text-primary mt-1">{detailProperty.articleName || '-'}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <span className="text-xs text-hud-text-muted">건물명</span>
                                            <p className="text-sm text-hud-text-secondary mt-1">{detailProperty.buildingName || '-'}</p>
                                        </div>
                                        <div>
                                            <span className="text-xs text-hud-text-muted">매물 유형</span>
                                            <p className="text-sm text-hud-text-secondary mt-1">{detailProperty.propertyType || '-'}</p>
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-xs text-hud-text-muted">주소</span>
                                        <p className="text-sm text-hud-text-secondary mt-1">{detailProperty.address || '-'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* 거래 정보 */}
                            <div>
                                <h3 className="text-sm font-semibold text-hud-text-primary mb-3 flex items-center gap-2">
                                    <DollarSign className="w-4 h-4 text-hud-accent-warning" />
                                    거래 정보
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <span className="text-xs text-hud-text-muted">거래 유형</span>
                                        <p className="text-sm text-hud-text-secondary mt-1">{detailProperty.tradeType || '-'}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-hud-text-muted">면적</span>
                                        <p className="text-sm text-hud-text-secondary mt-1">{detailProperty.area ? `${detailProperty.area}㎡` : '-'}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-xs text-hud-text-muted">가격</span>
                                        <p className="text-lg font-bold text-hud-accent-primary mt-1">{formatPrice(detailProperty.price)}</p>
                                    </div>
                                </div>
                            </div>

                            {/* 메모 */}
                            {detailProperty.notes && (
                                <div>
                                    <h3 className="text-sm font-semibold text-hud-text-primary mb-3 flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-hud-accent-info" />
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
