import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { API_BASE } from '../../lib/api';
import HudCard from '../common/HudCard';
import Button from '../common/Button';
import { Loader2, AlertCircle, Building2, MapPin, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Property {
    id: number;
    articleName: string;
    articleNo: string;
    realEstateTypeCode: string;
    realEstateTypeName: string;
    tradeTypeCode: string;
    tradeTypeName: string;
    dealOrWarrantPrc: number | null;
    rentPrc: number | null;
    latitude: number | null;
    longitude: number | null;
    cortarAddress: string | null;
    roadAddress: string | null;
    detailAddress: string | null;
    area2: number | null; // 전용면적
}

interface AddressMarketResult {
    summary: {
        totalCount: number;
        avgPrice: number;
        medianPrice: number;
        minPrice: number;
        maxPrice: number;
        avgPricePerArea: number;
    };
}

function formatPriceMan(price: number | null | undefined) {
    if (!price || price <= 0) return '-';
    const uk = Math.floor(price / 10000);
    const man = price % 10000;
    if (uk > 0) {
        return man > 0 ? `${uk}억 ${man.toLocaleString()}만` : `${uk}억`;
    }
    return `${price.toLocaleString()}만`;
}

export default function PropertyPublicComparison() {
    const authFetch = useAuthStore((state) => state.authFetch);
    const [properties, setProperties] = useState<Property[]>([]);
    const [isLoadingProps, setIsLoadingProps] = useState(false);
    const [propsError, setPropsError] = useState<string | null>(null);

    const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);

    const [marketStat, setMarketStat] = useState<AddressMarketResult | null>(null);
    const [isLoadingStat, setIsLoadingStat] = useState(false);
    const [statError, setStatError] = useState<string | null>(null);

    useEffect(() => {
        const fetchProperties = async () => {
            setIsLoadingProps(true);
            setPropsError(null);
            try {
                const res = await authFetch(`${API_BASE}/api/properties?limit=100`);
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || '매물 목록을 불러오지 못했습니다.');
                setProperties(data.properties || []);
            } catch (err) {
                setPropsError(err instanceof Error ? err.message : '로딩 실패');
            } finally {
                setIsLoadingProps(false);
            }
        };
        fetchProperties();
    }, [authFetch]);

    const selectedProperty = properties.find(p => p.id === selectedPropertyId);

    useEffect(() => {
        if (!selectedProperty) {
            setMarketStat(null);
            return;
        }

        const fetchMarketStat = async () => {
            if (!selectedProperty.latitude || !selectedProperty.longitude) {
                setStatError('매물에 위치 정보가 없어 주변 통계를 불러올 수 없습니다.');
                return;
            }
            setIsLoadingStat(true);
            setStatError(null);
            setMarketStat(null);

            try {
                const params = new URLSearchParams({
                    lat: String(selectedProperty.latitude),
                    lng: String(selectedProperty.longitude),
                    radiusMeters: '1000', // 반경 1km
                    realEstateType: selectedProperty.realEstateTypeCode,
                    tradeType: selectedProperty.tradeTypeCode,
                });

                const res = await authFetch(`${API_BASE}/api/statistics/address-market?${params.toString()}`);
                const data = await res.json();

                // Handle gracefully empty Data (the one we fixed recently)
                if (!res.ok) {
                    throw new Error(data.error || '통계 조회 실패');
                }

                setMarketStat(data);
            } catch (err) {
                setStatError(err instanceof Error ? err.message : '조회 실패');
            } finally {
                setIsLoadingStat(false);
            }
        };

        fetchMarketStat();
    }, [selectedProperty, authFetch]);

    // Compute price difference if possible
    let diffPercent: number | null = null;
    let diffBadge = null;

    if (selectedProperty && marketStat && selectedProperty.dealOrWarrantPrc) {
        const pPrice = selectedProperty.dealOrWarrantPrc;
        const mPrice = marketStat.summary.medianPrice;

        if (mPrice > 0) {
            const diff = pPrice - mPrice;
            diffPercent = (diff / mPrice) * 100;

            if (diffPercent < -5) {
                diffBadge = { text: '시세 대비 저렴 (기회/급매)', color: 'text-hud-accent-success', bg: 'bg-hud-accent-success/10', icon: <TrendingDown size={14} className="mr-1" /> };
            } else if (diffPercent > 5) {
                diffBadge = { text: '시세 대비 고평가', color: 'text-hud-accent-danger', bg: 'bg-hud-accent-danger/10', icon: <TrendingUp size={14} className="mr-1" /> };
            } else {
                diffBadge = { text: '적정 시세 수준', color: 'text-hud-text-primary', bg: 'bg-hud-bg-secondary', icon: <Minus size={14} className="mr-1" /> };
            }
        }
    }

    return (
        <div className="space-y-4">
            <HudCard title="비교할 내 매물 선택">
                {isLoadingProps ? (
                    <div className="flex items-center gap-2 text-sm text-hud-text-muted p-4">
                        <Loader2 className="w-4 h-4 animate-spin" /> 매물 정보를 불러오는 중...
                    </div>
                ) : propsError ? (
                    <div className="text-sm text-hud-accent-danger flex items-center gap-2 p-2">
                        <AlertCircle className="w-4 h-4" /> {propsError}
                    </div>
                ) : properties.length === 0 ? (
                    <div className="text-sm text-hud-text-muted p-4">등록된 매물이 없습니다.</div>
                ) : (
                    <select
                        className="w-full px-3 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary focus:outline-none focus:border-hud-accent-primary"
                        value={selectedPropertyId || ''}
                        onChange={(e) => setSelectedPropertyId(e.target.value ? Number(e.target.value) : null)}
                    >
                        <option value="">매물을 선택하세요...</option>
                        {properties.map(p => (
                            <option key={p.id} value={p.id}>
                                [{p.realEstateTypeName}/{p.tradeTypeName}] {p.articleName} ({formatPriceMan(p.dealOrWarrantPrc)}{p.rentPrc ? ` / ${p.rentPrc}만` : ''})
                            </option>
                        ))}
                    </select>
                )}
            </HudCard>

            {selectedProperty && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <HudCard className="p-5">
                        <h4 className="text-sm font-semibold text-hud-text-primary mb-4 flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-hud-accent-primary" />
                            내 매물 정보
                        </h4>

                        <div className="space-y-3">
                            <div className="flex justify-between items-center pb-2 border-b border-hud-border-secondary">
                                <span className="text-sm text-hud-text-muted">매물명</span>
                                <span className="text-sm font-medium text-hud-text-primary max-w-[200px] truncate" title={selectedProperty.articleName}>{selectedProperty.articleName}</span>
                            </div>
                            <div className="flex justify-between items-center pb-2 border-b border-hud-border-secondary">
                                <span className="text-sm text-hud-text-muted">유형/거래</span>
                                <span className="text-sm font-medium text-hud-text-primary">{selectedProperty.realEstateTypeName} / {selectedProperty.tradeTypeName}</span>
                            </div>
                            <div className="flex justify-between items-center pb-2 border-b border-hud-border-secondary">
                                <span className="text-sm text-hud-text-muted">면적</span>
                                <span className="text-sm font-medium text-hud-text-primary">{selectedProperty.area2 ? `${selectedProperty.area2}㎡` : '-'}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-hud-text-muted">매물 가격</span>
                                <span className="text-base font-bold text-hud-accent-primary">
                                    {formatPriceMan(selectedProperty.dealOrWarrantPrc)}
                                </span>
                            </div>
                        </div>
                    </HudCard>

                    <HudCard className="p-5">
                        <h4 className="text-sm font-semibold text-hud-text-primary mb-4 flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-hud-accent-info" />
                            주변 유사 조건 시세 (반경 1km)
                        </h4>

                        {isLoadingStat ? (
                            <div className="flex flex-col items-center justify-center p-6 text-sm text-hud-text-muted">
                                <Loader2 className="w-6 h-6 animate-spin mb-2" />
                                주변 시세를 분석 중입니다...
                            </div>
                        ) : statError ? (
                            <div className="text-sm text-hud-accent-danger flex items-center gap-2 p-2">
                                <AlertCircle className="w-4 h-4" /> {statError}
                            </div>
                        ) : marketStat ? (
                            <div className="space-y-3">
                                <div className="flex justify-between items-center pb-2 border-b border-hud-border-secondary">
                                    <span className="text-sm text-hud-text-muted">분석 표본(확정거래)</span>
                                    <span className="text-sm font-medium text-hud-text-primary">{marketStat.summary.totalCount.toLocaleString()}건</span>
                                </div>
                                <div className="flex justify-between items-center pb-2 border-b border-hud-border-secondary">
                                    <span className="text-sm text-hud-text-muted">지역 평균가</span>
                                    <span className="text-sm font-medium text-hud-text-primary">{formatPriceMan(marketStat.summary.avgPrice)}</span>
                                </div>
                                <div className="flex justify-between items-center pb-2 border-b border-hud-border-secondary">
                                    <span className="text-sm text-hud-text-muted">지역 최저가</span>
                                    <span className="text-sm font-medium text-hud-text-primary">{formatPriceMan(marketStat.summary.minPrice)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-hud-text-muted text-hud-accent-info font-medium">지역 중위가 (기준표준)</span>
                                    <span className="text-base font-bold text-hud-accent-info">
                                        {formatPriceMan(marketStat.summary.medianPrice)}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-sm text-hud-text-muted p-4 text-center">분석 데이터가 없습니다.</div>
                        )}
                    </HudCard>
                </div>
            )}

            {selectedProperty && marketStat && marketStat.summary.totalCount > 0 && selectedProperty.dealOrWarrantPrc && (
                <HudCard className="p-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div>
                            <h3 className="text-base font-bold text-hud-text-primary mb-1">내 매물 적정가 비교 결과</h3>
                            <p className="text-sm text-hud-text-muted">지역 내 유사한 매물의 중위가({formatPriceMan(marketStat.summary.medianPrice)})와 비교한 편차입니다.</p>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <p className="text-xs text-hud-text-muted mb-1">가격 편차</p>
                                <p className={`text-2xl font-bold ${diffPercent && diffPercent < 0 ? 'text-hud-accent-success' : 'text-hud-accent-danger'}`}>
                                    {diffPercent ? (diffPercent > 0 ? '+' : '') + diffPercent.toFixed(1) + '%' : '- %'}
                                </p>
                            </div>

                            {diffBadge && (
                                <div className={`flex items-center px-4 py-2 rounded-lg font-medium text-sm ${diffBadge.bg} ${diffBadge.color}`}>
                                    {diffBadge.icon}
                                    {diffBadge.text}
                                </div>
                            )}
                        </div>
                    </div>
                </HudCard>
            )}

            {selectedProperty && marketStat && marketStat.summary.totalCount === 0 && (
                <HudCard className="p-6">
                    <div className="flex items-center gap-2 text-sm text-hud-text-muted">
                        <AlertCircle className="w-5 h-5 text-hud-accent-warning" />
                        해당 조건(매물 유형: {selectedProperty.realEstateTypeName}, 거래: {selectedProperty.tradeTypeName})의 주변(1km) 확정거래 데이터가 존재하지 않아 시세 편차를 분석할 수 없습니다. 반경을 넓히거나 다른 매물을 선택해주세요.
                    </div>
                </HudCard>
            )}
        </div>
    );
}
