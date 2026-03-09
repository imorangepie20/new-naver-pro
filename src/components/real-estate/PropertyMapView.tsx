// ============================================
// 매물 지도 뷰 컴포넌트
// Kakao Maps SDK 사용
// ============================================

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, MapPin, Loader2, Layers, Map as MapIcon } from 'lucide-react';
import { loadKakaoMapsSdk } from '../../lib/map/loadKakaoMapsSdk';

interface Property {
    articleNo: string;
    articleName: string;
    latitude: number;
    longitude: number;
    dealOrWarrantPrc: string | null;
    realEstateTypeName: string;
    tradeTypeName: string;
    tradeTypeCode?: string;
    area1?: string;
    buildingName?: string;
}

interface Complex {
    markerId: string;
    complexName: string;
    latitude: number;
    longitude: number;
    realEstateTypeName: string;
    realEstateTypeCode: string;
    dealCount?: number;
    leaseCount?: number;
    rentCount?: number;
    totalArticleCount?: number;
}

interface PropertyMapViewProps {
    properties: Property[];
    complexes?: Complex[];
    selectedProperty: Property | null;
    onPropertySelect: (property: Property | null) => void;
    onComplexClick?: (complex: Complex) => void;
    onClose: () => void;
}

const isValidCoordinate = (latitude: number, longitude: number) => Number.isFinite(latitude) && Number.isFinite(longitude);

const createPropertyOverlay = (kakao: any, property: Property, isSelected: boolean, onClick: () => void) => {
    const priceText = property.dealOrWarrantPrc || '가격문의';
    const bubble = document.createElement('button');
    bubble.type = 'button';
    bubble.style.background = isSelected ? '#00D9FF' : '#EF4444';
    bubble.style.color = 'white';
    bubble.style.padding = '10px 14px';
    bubble.style.borderRadius = '24px';
    bubble.style.fontSize = '14px';
    bubble.style.fontWeight = '700';
    bubble.style.whiteSpace = 'nowrap';
    bubble.style.boxShadow = '0 4px 12px rgba(0,0,0,0.45)';
    bubble.style.cursor = 'pointer';
    bubble.style.textShadow = '0 1px 2px rgba(0,0,0,0.3)';
    bubble.style.border = '3px solid white';
    bubble.style.minWidth = '72px';
    bubble.style.textAlign = 'center';
    bubble.style.outline = 'none';
    bubble.textContent = priceText;
    bubble.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
    });

    return new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(property.latitude, property.longitude),
        content: bubble,
        yAnchor: 1,
        clickable: true,
    });
};

const createComplexOverlay = (kakao: any, complex: Complex, onClick: () => void) => {
    const countText = complex.totalArticleCount ? `${complex.totalArticleCount}건` : '단지';
    const container = document.createElement('button');
    container.type = 'button';
    container.style.background = '#F59E0B';
    container.style.color = 'white';
    container.style.padding = '8px 12px';
    container.style.borderRadius = '20px';
    container.style.whiteSpace = 'nowrap';
    container.style.boxShadow = '0 4px 12px rgba(0,0,0,0.45)';
    container.style.cursor = 'pointer';
    container.style.border = '3px solid white';
    container.style.minWidth = '72px';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '1px';
    container.style.alignItems = 'center';
    container.style.outline = 'none';

    const title = document.createElement('div');
    title.style.maxWidth = '110px';
    title.style.overflow = 'hidden';
    title.style.textOverflow = 'ellipsis';
    title.style.whiteSpace = 'nowrap';
    title.style.fontSize = '10px';
    title.style.opacity = '0.95';
    title.textContent = complex.complexName || '단지';

    const count = document.createElement('div');
    count.style.fontSize = '13px';
    count.style.fontWeight = '700';
    count.textContent = countText;

    container.appendChild(title);
    container.appendChild(count);
    container.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
    });

    return new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(complex.latitude, complex.longitude),
        content: container,
        yAnchor: 1,
        clickable: true,
    });
};

const PropertyMapView: React.FC<PropertyMapViewProps> = ({
    properties,
    complexes = [],
    selectedProperty,
    onPropertySelect,
    onComplexClick,
    onClose,
}) => {
    const navigate = useNavigate();
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);
    const overlaysRef = useRef<any[]>([]);
    const [mapLoaded, setMapLoaded] = useState(false);
    const [loadingError, setLoadingError] = useState(false);
    const [mapType, setMapType] = useState<'street' | 'satellite'>('street');
    const [mapReady, setMapReady] = useState(false);

    const onPropertySelectRef = useRef(onPropertySelect);
    onPropertySelectRef.current = onPropertySelect;
    const onComplexClickRef = useRef(onComplexClick);
    onComplexClickRef.current = onComplexClick;

    const clearOverlays = () => {
        overlaysRef.current.forEach((overlay) => overlay.setMap(null));
        overlaysRef.current = [];
    };

    useEffect(() => {
        let mounted = true;

        const initMap = async () => {
            try {
                await loadKakaoMapsSdk();
                if (!mounted || !mapRef.current || mapInstanceRef.current) return;

                const kakao = window.kakao;
                const map = new kakao.maps.Map(mapRef.current, {
                    center: new kakao.maps.LatLng(37.5665, 126.9780),
                    level: 5,
                });

                mapInstanceRef.current = map;
                setMapLoaded(true);
                setMapReady(true);
            } catch (error) {
                console.error('Failed to initialize Kakao map:', error);
                if (mounted) {
                    setLoadingError(true);
                }
            }
        };

        initMap();

        return () => {
            mounted = false;
            clearOverlays();
            mapInstanceRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (!mapInstanceRef.current || !window.kakao?.maps) return;

        const map = mapInstanceRef.current;
        const kakao = window.kakao;
        clearOverlays();

        const bounds = new kakao.maps.LatLngBounds();
        let pointsCount = 0;
        let singlePoint: any = null;

        properties.forEach((property) => {
            if (!isValidCoordinate(property.latitude, property.longitude)) return;

            const isSelected = selectedProperty?.articleNo === property.articleNo;
            const overlay = createPropertyOverlay(kakao, property, isSelected, () => {
                onPropertySelectRef.current(property);
            });
            overlay.setMap(map);
            overlaysRef.current.push(overlay);

            const point = new kakao.maps.LatLng(property.latitude, property.longitude);
            bounds.extend(point);
            singlePoint = point;
            pointsCount += 1;
        });

        complexes.forEach((complex) => {
            if (!isValidCoordinate(complex.latitude, complex.longitude)) return;

            const overlay = createComplexOverlay(kakao, complex, () => {
                if (onComplexClickRef.current) {
                    onComplexClickRef.current(complex);
                } else {
                    const params = new URLSearchParams({
                        complexNo: complex.markerId,
                        complexName: complex.complexName,
                        realEstateType: complex.realEstateTypeCode || 'APT',
                    });
                    navigate(`/real-estate/temp-properties?${params.toString()}`);
                }
            });
            overlay.setMap(map);
            overlaysRef.current.push(overlay);

            const point = new kakao.maps.LatLng(complex.latitude, complex.longitude);
            bounds.extend(point);
            singlePoint = point;
            pointsCount += 1;
        });

        if (pointsCount > 1) {
            map.setBounds(bounds, 80, 80, 80, 80);
        } else if (pointsCount === 1 && singlePoint) {
            map.setCenter(singlePoint);
            map.setLevel(4);
        }
    }, [properties, complexes, selectedProperty, navigate, mapReady]);

    useEffect(() => {
        if (!mapInstanceRef.current || !selectedProperty || !window.kakao?.maps) return;
        if (!isValidCoordinate(selectedProperty.latitude, selectedProperty.longitude)) return;

        const map = mapInstanceRef.current;
        const point = new window.kakao.maps.LatLng(selectedProperty.latitude, selectedProperty.longitude);
        map.panTo(point);
        if (map.getLevel() > 4) {
            map.setLevel(4);
        }
    }, [selectedProperty]);

    useEffect(() => {
        if (!mapInstanceRef.current || !window.kakao?.maps) return;
        const map = mapInstanceRef.current;
        if (mapType === 'street') {
            map.setMapTypeId(window.kakao.maps.MapTypeId.ROADMAP);
        } else {
            map.setMapTypeId(window.kakao.maps.MapTypeId.HYBRID);
        }
    }, [mapType]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-[80vw] h-[80vh] flex flex-col bg-hud-bg-primary rounded-lg shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-hud-bg-secondary border-b border-hud-border-secondary">
                    <div className="flex items-center gap-2">
                        <MapIcon className="w-4 h-4 text-hud-accent-primary" />
                        <span className="text-sm font-medium text-hud-text-primary">
                            지도 보기 {complexes.length > 0 && `(${complexes.length}개 단지)`} {properties.length > 0 && `(${properties.length}개 매물)`}
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-hud-bg-hover rounded-lg transition-colors"
                    >
                        <X className="w-4 h-4 text-hud-text-secondary" />
                    </button>
                </div>

                <div className="flex-1 relative">
                    <div ref={mapRef} className="w-full h-full bg-gray-800" />

                    {!mapLoaded && !loadingError && (
                        <div className="absolute inset-0 flex items-center justify-center bg-hud-bg-primary z-10">
                            <div className="flex flex-col items-center gap-3">
                                <Loader2 className="w-10 h-10 text-hud-accent-primary animate-spin" />
                                <p className="text-sm text-hud-text-muted">카카오 지도를 불러오는 중...</p>
                            </div>
                        </div>
                    )}

                    {mapLoaded && properties.length === 0 && complexes.length === 0 && !loadingError && (
                        <div className="absolute inset-0 flex items-center justify-center bg-hud-bg-primary z-10">
                            <div className="text-center p-6">
                                <MapPin className="w-12 h-12 text-hud-text-muted mx-auto mb-3" />
                                <p className="text-hud-text-primary mb-2">지도에 표시할 매물이 없습니다</p>
                                <p className="text-sm text-hud-text-muted">선택하신 지역의 매물은 좌표 정보를 제공하지 않습니다.</p>
                            </div>
                        </div>
                    )}

                    {(properties.length > 0 || complexes.length > 0) && (
                        <div className="absolute bottom-4 left-4 z-[1000] px-4 py-2 bg-hud-bg-secondary/90 backdrop-blur border border-hud-border-secondary rounded-lg shadow-lg">
                            <span className="text-sm text-hud-text-primary">
                                {complexes.length > 0 && (
                                    <><span className="font-bold text-hud-accent-warning">{complexes.length}</span>개 단지 </>
                                )}
                                {properties.length > 0 && (
                                    <><span className="font-bold text-hud-accent-primary">{properties.length}</span>개 매물</>
                                )}
                            </span>
                        </div>
                    )}

                    {mapLoaded && (
                        <div className="absolute top-4 right-4 z-[1000] flex gap-2">
                            <button
                                onClick={() => setMapType('street')}
                                className={`px-3 py-2 backdrop-blur border rounded-lg text-sm transition-colors ${mapType === 'street'
                                        ? 'bg-hud-accent-primary/20 border-hud-accent-primary text-hud-accent-primary'
                                        : 'bg-hud-bg-secondary/90 border-hud-border-secondary text-hud-text-primary hover:bg-hud-bg-hover'
                                    }`}
                            >
                                <Layers size={16} className="inline mr-1" />
                                일반
                            </button>
                            <button
                                onClick={() => setMapType('satellite')}
                                className={`px-3 py-2 backdrop-blur border rounded-lg text-sm transition-colors ${mapType === 'satellite'
                                        ? 'bg-hud-accent-primary/20 border-hud-accent-primary text-hud-accent-primary'
                                        : 'bg-hud-bg-secondary/90 border-hud-border-secondary text-hud-text-primary hover:bg-hud-bg-hover'
                                    }`}
                            >
                                위성
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PropertyMapView;
