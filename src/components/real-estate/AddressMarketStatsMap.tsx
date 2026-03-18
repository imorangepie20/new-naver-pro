import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { loadNaverMapsSdk } from '../../lib/map/loadNaverMapsSdk';

export interface AddressMarketStatsMapPoint {
  latitude: number;
  longitude: number;
}

export interface AddressMarketStatsMapMarker {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  badge: string;
  subtitle?: string;
  variant: 'complex' | 'property';
}

interface AddressMarketStatsMapProps {
  center: AddressMarketStatsMapPoint;
  selectedPoint: AddressMarketStatsMapPoint | null;
  markers: AddressMarketStatsMapMarker[];
  activeMarkerId?: string | null;
  onSelectPoint: (point: AddressMarketStatsMapPoint) => void;
  onMarkerClick: (marker: AddressMarketStatsMapMarker) => void;
  heightClassName?: string;
}

const isValidCoordinate = (latitude: number, longitude: number) =>
  Number.isFinite(latitude) && Number.isFinite(longitude);

const FIXED_ZOOM_LEVEL = 15;

const createMarkerContent = (
  marker: AddressMarketStatsMapMarker,
  isActive: boolean,
): string => {
  const maxW = marker.variant === 'complex' ? '128px' : '108px';
  const pad = marker.variant === 'complex' ? '7px 10px' : '6px 10px';
  const radius = marker.variant === 'complex' ? '16px' : '999px';
  const bg =
    marker.variant === 'complex'
      ? isActive
        ? 'linear-gradient(135deg, rgba(251,191,36,0.52), rgba(253,186,116,0.52))'
        : 'linear-gradient(135deg, rgba(252,211,77,0.36), rgba(253,186,116,0.36))'
      : isActive
        ? 'linear-gradient(135deg, rgba(103,232,249,0.5), rgba(147,197,253,0.5))'
        : 'linear-gradient(135deg, rgba(226,232,240,0.42), rgba(148,163,184,0.32))';
  const border = `2px solid ${isActive ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.86)'}`;
  const shadow = isActive
    ? '0 10px 22px rgba(15,23,42,0.44)'
    : '0 8px 18px rgba(15,23,42,0.28)';
  const titleSize = marker.variant === 'complex' ? '11px' : '10px';
  const titleWeight = marker.variant === 'complex' ? '700' : '600';
  const badgeSize = marker.variant === 'complex' ? '13px' : '12px';

  const subtitleHtml = marker.subtitle
    ? `<div style="font-size:10px;opacity:0.92;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#1f2937">${marker.subtitle}</div>`
    : '';

  return `<div class="naver-marker-overlay" data-marker-id="${marker.id}" style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:${pad};border-radius:${radius};border:${border};background:${bg};color:#111827;box-shadow:${shadow};cursor:pointer;white-space:nowrap;max-width:${maxW};backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)">
    <div style="font-size:${titleSize};font-weight:${titleWeight};max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#111827">${marker.title}</div>
    <div style="font-size:${badgeSize};font-weight:800;color:#111827">${marker.badge}</div>
    ${subtitleHtml}
  </div>`;
};

const AddressMarketStatsMap = ({
  center,
  selectedPoint,
  markers,
  activeMarkerId = null,
  onSelectPoint,
  onMarkerClick,
  heightClassName = 'h-[520px]',
}: AddressMarketStatsMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const centerMarkerRef = useRef<any>(null);
  const markerOverlaysRef = useRef<any[]>([]);
  const onSelectPointRef = useRef(onSelectPoint);
  const onMarkerClickRef = useRef(onMarkerClick);
  const [isMapReady, setIsMapReady] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  onSelectPointRef.current = onSelectPoint;
  onMarkerClickRef.current = onMarkerClick;

  const initialCenterRef = useRef(center);

  const clearMarkerOverlays = () => {
    markerOverlaysRef.current.forEach((overlay) => {
      overlay.setMap(null);
    });
    markerOverlaysRef.current = [];
  };

  // 지도 초기화
  useEffect(() => {
    let mounted = true;

    const initMap = async () => {
      try {
        await loadNaverMapsSdk();
        if (!mounted || !mapRef.current || mapInstanceRef.current) return;

        const naver = window.naver;
        const map = new naver.maps.Map(mapRef.current, {
          center: new naver.maps.LatLng(
            initialCenterRef.current.latitude,
            initialCenterRef.current.longitude,
          ),
          zoom: FIXED_ZOOM_LEVEL,
          zoomControl: true,
          zoomControlOptions: {
            position: naver.maps.Position.TOP_RIGHT,
          },
        });

        naver.maps.Event.addListener(map, 'click', (e: any) => {
          const coord = e.coord || e.latlng;
          if (coord) {
            onSelectPointRef.current({
              latitude: coord.lat(),
              longitude: coord.lng(),
            });
          }
        });

        mapInstanceRef.current = map;
        setIsMapReady(true);
      } catch (error) {
        console.error('Failed to initialize Naver Maps:', error);
        if (mounted) {
          const detail = error instanceof Error ? error.message : 'unknown';
          setLoadingError(`네이버 지도 인증 또는 SDK 로드에 실패했습니다. ${detail}`);
        }
      }
    };

    void initMap();

    return () => {
      mounted = false;
      clearMarkerOverlays();

      if (centerMarkerRef.current) {
        centerMarkerRef.current.setMap(null);
      }

      centerMarkerRef.current = null;
      mapInstanceRef.current = null;
      setIsMapReady(false);
    };
  }, []);

  // 중심 이동
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.naver?.maps) return;
    map.setCenter(new window.naver.maps.LatLng(center.latitude, center.longitude));
  }, [center.latitude, center.longitude]);

  // 선택 포인트 마커
  useEffect(() => {
    const map = mapInstanceRef.current;
    const naver = window.naver;
    if (!map || !naver?.maps || !isMapReady) return;

    if (!selectedPoint) {
      if (centerMarkerRef.current) {
        centerMarkerRef.current.setMap(null);
      }
      return;
    }

    const position = new naver.maps.LatLng(selectedPoint.latitude, selectedPoint.longitude);
    map.setCenter(position);
    map.setZoom(FIXED_ZOOM_LEVEL);

    if (!centerMarkerRef.current) {
      centerMarkerRef.current = new naver.maps.Marker({
        map,
        position,
      });
    } else {
      centerMarkerRef.current.setPosition(position);
      centerMarkerRef.current.setMap(map);
    }
  }, [isMapReady, selectedPoint]);

  // 마커 오버레이 렌더
  useEffect(() => {
    const map = mapInstanceRef.current;
    const naver = window.naver;
    if (!map || !naver?.maps || !isMapReady) return;

    clearMarkerOverlays();

    markers.forEach((marker) => {
      if (!isValidCoordinate(marker.latitude, marker.longitude)) return;

      const position = new naver.maps.LatLng(marker.latitude, marker.longitude);
      const isActive = marker.id === activeMarkerId;

      const overlay = new naver.maps.Marker({
        map,
        position,
        icon: {
          content: createMarkerContent(marker, isActive),
          size: new naver.maps.Size(
            marker.variant === 'complex' ? 128 : 108,
            marker.variant === 'complex' ? 54 : 44,
          ),
          anchor: new naver.maps.Point(
            marker.variant === 'complex' ? 64 : 54,
            marker.variant === 'complex' ? 50 : 40
          ),
        },
        zIndex: isActive ? 9 : 5,
      });

      naver.maps.Event.addListener(overlay, 'click', () => {
        onMarkerClickRef.current(marker);
      });

      markerOverlaysRef.current.push(overlay);
    });
  }, [activeMarkerId, isMapReady, markers, selectedPoint]);

  return (
    <div className={`relative w-full overflow-hidden rounded-xl border border-hud-border-secondary ${heightClassName}`}>
      <div ref={mapRef} className="h-full w-full bg-hud-bg-primary" />

      {!isMapReady && !loadingError && (
        <div className="absolute inset-0 flex items-center justify-center bg-hud-bg-primary/82 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm text-hud-text-secondary">
            <Loader2 className="h-4 w-4 animate-spin" />
            지도를 불러오는 중...
          </div>
        </div>
      )}

      {loadingError && (
        <div className="absolute inset-0 flex items-center justify-center bg-hud-bg-primary/92 px-6 text-center">
          <p className="text-sm text-hud-accent-danger">{loadingError}</p>
        </div>
      )}
    </div>
  );
};

export default AddressMarketStatsMap;
