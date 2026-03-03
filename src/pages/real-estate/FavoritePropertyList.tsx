import { useState, useEffect, useMemo } from 'react'
import { Heart, Search, Trash2, Plus, Pencil, X } from 'lucide-react'
import Button from '../../components/common/Button'

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

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const PROPERTY_TYPES = ['아파트', '오피스텔', '빌라', '주택', '상가', '토지', '기타']
const TRADE_TYPES = ['매매', '전세', '월세']

const emptyForm = {
    articleName: '', buildingName: '', address: '',
    propertyType: '', tradeType: '', price: '', area: '', notes: '',
}

export default function FavoritePropertyList() {
    const [properties, setProperties] = useState<FavoriteProperty[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [form, setForm] = useState(emptyForm)

    const fetchFavorites = async () => {
        try {
            setLoading(true)
            const res = await fetch(`${API}/api/favorite-properties`)
            const data = await res.json()
            if (data.success) setProperties(data.properties || [])
        } catch (err) {
            console.error('Failed to fetch:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchFavorites() }, [])

    const handleSubmit = async () => {
        const body: any = { ...form }
        body.price = body.price ? parseInt(body.price) : null
        body.area = body.area ? parseFloat(body.area) : null

        try {
            if (editingId) {
                await fetch(`${API}/api/favorite-properties/${editingId}`, {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
                })
            } else {
                await fetch(`${API}/api/favorite-properties`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
                })
            }
            setShowForm(false)
            setEditingId(null)
            setForm(emptyForm)
            fetchFavorites()
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
            await fetch(`${API}/api/favorite-properties/${id}`, { method: 'DELETE' })
            fetchFavorites()
        } catch (err) {
            console.error('Failed to delete:', err)
        }
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

    const formatPrice = (price?: number | null) => {
        if (!price) return '-'
        if (price >= 10000) return `${Math.floor(price / 10000)}억${price % 10000 > 0 ? ` ${(price % 10000).toLocaleString()}` : ''}`
        return `${price.toLocaleString()}만`
    }

    const Input = ({ label, name, type = 'text', placeholder = '' }: { label: string; name: string; type?: string; placeholder?: string }) => (
        <div>
            <label className="block text-xs font-medium text-hud-text-muted mb-1">{label}</label>
            <input
                type={type}
                value={(form as any)[name]}
                onChange={(e) => setForm(prev => ({ ...prev, [name]: e.target.value }))}
                placeholder={placeholder}
                className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:ring-2 focus:ring-hud-accent-primary/30"
            />
        </div>
    )

    return (
        <div className="p-4 sm:p-6">
            {/* 헤더 */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Heart className="w-6 h-6 text-pink-500 fill-pink-500" />
                    <h1 className="text-2xl font-bold text-hud-text-primary">관심매물</h1>
                    <span className="text-sm text-hud-text-muted bg-hud-bg-secondary px-2.5 py-1 rounded-full">
                        {filtered.length}건
                    </span>
                </div>
                <Button
                    onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm) }}
                    className="flex items-center gap-2 bg-pink-500 hover:bg-pink-600 text-white"
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
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm" onClick={() => setShowForm(false)}>
                    <div className="bg-hud-bg-secondary rounded-2xl border border-hud-border-secondary shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-hud-border-secondary">
                            <h2 className="text-lg font-bold text-hud-text-primary">{editingId ? '관심매물 수정' : '관심매물 등록'}</h2>
                            <button onClick={() => setShowForm(false)} className="p-2 hover:bg-hud-bg-hover rounded-lg"><X className="w-5 h-5 text-hud-text-muted" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <Input label="매물명 *" name="articleName" placeholder="예: 래미안 101동 301호" />
                            <Input label="건물명/단지명" name="buildingName" placeholder="예: 래미안아파트" />
                            <Input label="주소" name="address" placeholder="예: 서울시 강남구..." />
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-hud-text-muted mb-1">매물 유형</label>
                                    <select value={form.propertyType} onChange={(e) => setForm(prev => ({ ...prev, propertyType: e.target.value }))}
                                        className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary">
                                        <option value="">선택</option>
                                        {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-hud-text-muted mb-1">거래 유형</label>
                                    <select value={form.tradeType} onChange={(e) => setForm(prev => ({ ...prev, tradeType: e.target.value }))}
                                        className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary">
                                        <option value="">선택</option>
                                        {TRADE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Input label="가격 (만원)" name="price" type="number" placeholder="예: 50000" />
                                <Input label="면적 (㎡)" name="area" type="number" placeholder="예: 84.5" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-hud-text-muted mb-1">메모</label>
                                <textarea value={form.notes} onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))} rows={3}
                                    className="w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary resize-none" />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 px-6 py-4 border-t border-hud-border-secondary">
                            <Button variant="outline" onClick={() => setShowForm(false)}>취소</Button>
                            <Button onClick={handleSubmit} className="bg-pink-500 hover:bg-pink-600 text-white">{editingId ? '수정' : '등록'}</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* 테이블 */}
            {loading ? (
                <div className="flex items-center justify-center py-20 text-hud-text-muted">로딩 중...</div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-hud-text-muted">
                    <Heart className="w-12 h-12 mb-4 opacity-30" />
                    <p className="text-lg font-medium">관심매물이 없습니다</p>
                    <p className="text-sm mt-1">"매물 추가" 버튼으로 관심 매물을 등록하세요</p>
                </div>
            ) : (
                <div className="rounded-xl overflow-hidden border border-hud-border-primary">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b-2 border-hud-border-primary bg-hud-bg-tertiary">
                                <th className="px-4 py-3 text-left text-xs font-bold text-hud-text-primary uppercase tracking-wider">매물명</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-hud-text-primary uppercase tracking-wider">건물명</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-hud-text-primary uppercase tracking-wider">유형</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-hud-text-primary uppercase tracking-wider">거래</th>
                                <th className="px-4 py-3 text-right text-xs font-bold text-hud-text-primary uppercase tracking-wider">가격</th>
                                <th className="px-4 py-3 text-right text-xs font-bold text-hud-text-primary uppercase tracking-wider">면적</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-hud-text-primary uppercase tracking-wider">메모</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-hud-text-primary uppercase tracking-wider">저장일</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-hud-text-primary uppercase tracking-wider w-20">관리</th>
                            </tr>
                        </thead>
                        <tbody className="bg-hud-bg-secondary">
                            {filtered.map((p) => (
                                <tr key={p.id} className="border-b border-hud-border-primary/50 hover:bg-hud-bg-hover transition-colors">
                                    <td className="px-4 py-2.5 text-sm font-medium text-hud-text-primary">{p.articleName}</td>
                                    <td className="px-4 py-2.5 text-sm text-hud-text-secondary">{p.buildingName || '-'}</td>
                                    <td className="px-4 py-2.5">
                                        <span className="text-xs px-2 py-1 bg-hud-bg-primary rounded-md text-hud-text-secondary">{p.propertyType || '-'}</span>
                                    </td>
                                    <td className="px-4 py-2.5 text-center">
                                        {p.tradeType ? (
                                            <span className={`text-xs px-2 py-1 rounded-md border ${p.tradeType === '매매' ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                                    : p.tradeType === '전세' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                                        : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                                }`}>{p.tradeType}</span>
                                        ) : '-'}
                                    </td>
                                    <td className="px-4 py-2.5 text-right text-sm font-semibold text-hud-accent-primary">{formatPrice(p.price)}</td>
                                    <td className="px-4 py-2.5 text-right text-sm text-hud-text-secondary">{p.area ? `${p.area}㎡` : '-'}</td>
                                    <td className="px-4 py-2.5 text-sm text-hud-text-muted max-w-[200px] truncate">{p.notes || '-'}</td>
                                    <td className="px-4 py-2.5 text-center text-xs text-hud-text-muted">{new Date(p.createdAt).toLocaleDateString('ko-KR')}</td>
                                    <td className="px-4 py-2.5 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <button onClick={() => handleEdit(p)} className="p-1.5 text-hud-text-muted hover:text-hud-accent-primary hover:bg-hud-accent-primary/10 rounded-lg transition-all">
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button onClick={() => handleDelete(p.id)} className="p-1.5 text-hud-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
