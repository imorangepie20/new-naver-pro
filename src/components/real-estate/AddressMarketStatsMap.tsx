import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { loadKakaoMapsSdk } from '../../lib/map/loadKakaoMapsSdk';

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
  radiusMeters?: number;
  heightClassName?: string;
}

const isValidCoordinate = (latitude: number, longitude: number) =>
  Number.isFinite(latitude) && Number.isFinite(longitude);

const createMarkerOverlay = (
  kakao: any,
  marker: AddressMarketStatsMapMarker,
  isActive: boolean,
  onClick: () => void
) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.title = marker.title;
  button.style.display = 'flex';
  button.style.flexDirection = 'column';
  button.style.alignItems = 'center';
  button.style.gap = '2px';
  button.style.padding = marker.variant === 'complex' ? '9px 12px' : '8px 12px';
  button.style.borderRadius = marker.variant === 'complex' ? '18px' : '999px';
  button.style.border = `2px solid ${isActive ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.86)'}`;
  button.style.background =
    marker.variant === 'complex'
      ? (isActive ? 'linear-gradient(135deg, #f59e0b, #f97316)' : 'linear-gradient(135deg, #fbbf24, #f97316)')
      : (isActive ? 'linear-gradient(135deg, #06b6d4, #0284c7)' : 'linear-gradient(135deg, #0f172a, #1e293b)');
  button.style.color = '#ffffff';
  button.style.boxShadow = isActive
    ? '0 10px 22px rgba(15, 23, 42, 0.44)'
    : '0 8px 18px rgba(15, 23, 42, 0.28)';
  button.style.cursor = 'pointer';
  button.style.outline = 'none';
  button.style.whiteSpace = 'nowrap';
  button.style.maxWidth = marker.variant === 'complex' ? '140px' : '120px';

  const title = document.createElement('div');
  title.style.fontSize = marker.variant === 'complex' ? '11px' : '10px';
  title.style.fontWeight = marker.variant === 'complex' ? '700' : '600';
  title.style.maxWidth = '100%';
  title.style.overflow = 'hidden';
  title.style.textOverflow = 'ellipsis';
  title.style.whiteSpace = 'nowrap';
  title.textContent = marker.title;
  button.appendChild(title);

  const badge = document.createElement('div');
  badge.style.fontSize = marker.variant === 'complex' ? '13px' : '12px';
  badge.style.fontWeight = '800';
  badge.textContent = marker.badge;
  button.appendChild(badge);

  if (marker.subtitle) {
    const subtitle = document.createElement('div');
    subtitle.style.fontSize = '10px';
    subtitle.style.opacity = '0.92';
    subtitle.style.maxWidth = '100%';
    subtitle.style.overflow = 'hidden';
    subtitle.style.textOverflow = 'ellipsis';
    subtitle.style.whiteSpace = 'nowrap';
    subtitle.textContent = marker.subtitle;
    button.appendChild(subtitle);
  }

  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });

  return new kakao.maps.CustomOverlay({
    position: new kakao.maps.LatLng(marker.latitude, marker.longitude),
    content: button,
    yAnchor: 1,
    clickable: true,
    zIndex: isActive ? 9 : 5,
  });
};

const AddressMarketStatsMap = ({
  center,
  selectedPoint,
  markers,
  activeMarkerId = null,
  onSelectPoint,
  onMarkerClick,
  radiusMeters = 1000,
  heightClassName = 'h-[520px]',
}: AddressMarketStatsMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const centerMarkerRef = useRef<any>(null);
  const radiusCircleRef = useRef<any>(null);
  const markerOverlaysRef = useRef<any[]>([]);
  const clickHandlerRef = useRef<any>(null);
  const onSelectPointRef = useRef(onSelectPoint);
  const onMarkerClickRef = useRef(onMarkerClick);
  const [isMapReady, setIsMapReady] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  onSelectPointRef.current = onSelectPoint;
  onMarkerClickRef.current = onMarkerClick;

  const clearMarkerOverlays = () => {
    markerOverlaysRef.current.forEach((overlay) => overlay.setMap(null));
    markerOverlaysRef.current = [];
  };

  useEffect(() => {
    let mounted = true;

    const initMap = async () => {
      try {
        await loadKakaoMapsSdk();
        if (!mounted || !mapRef.current || mapInstanceRef.current) return;

        const kakao = window.kakao;
        const map = new kakao.maps.Map(mapRef.current, {
          center: new kakao.maps.LatLng(center.latitude, center.longitude),
          level: 5,
        });

        const clickHandler = (mouseEvent: any) => {
          const latLng = mouseEvent.latLng;
          onSelectPointRef.current({
            latitude: latLng.getLat(),
            longitude: latLng.getLng(),
          });
        };

        kakao.maps.event.addListener(map, 'click', clickHandler);

        mapInstanceRef.current = map;
        clickHandlerRef.current = clickHandler;
        setIsMapReady(true);
      } catch (error) {
        console.error('Failed to initialize address market stats map:', error);
        if (mounted) {
          setLoadingError('카카오 지도를 불러오지 못했습니다.');
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
      if (radiusCircleRef.current) {
        radiusCircleRef.current.setMap(null);
      }

      const map = mapInstanceRef.current;
      const clickHandler = clickHandlerRef.current;
      if (map && clickHandler && window.kakao?.maps?.event) {
        window.kakao.maps.event.removeListener(map, 'click', clickHandler);
      }

      centerMarkerRef.current = null;
      radiusCircleRef.current = null;
      mapInstanceRef.current = null;
      clickHandlerRef.current = null;
      setIsMapReady(false);
    };
  }, [center.latitude, center.longitude]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.kakao?.maps) return;
    map.setCenter(new window.kakao.maps.LatLng(center.latitude, center.longitude));
  }, [center.latitude, center.longitude]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const kakao = window.kakao;
    if (!map || !kakao?.maps || !selectedPoint || !isMapReady) return;

    const latLng = new kakao.maps.LatLng(selectedPoint.latitude, selectedPoint.longitude);

    if (!centerMarkerRef.current) {
      centerMarkerRef.current = new kakao.maps.Marker({
        map,
        position: latLng,
      });
    } else {
      centerMarkerRef.current.setPosition(latLng);
      centerMarkerRef.current.setMap(map);
    }

    if (!radiusCircleRef.current) {
      radiusCircleRef.current = new kakao.maps.Circle({
        map,
        center: latLng,
        radius: radiusMeters,
        strokeWeight: 2,
        strokeColor: '#06b6d4',
        strokeOpacity: 0.9,
        fillColor: '#06b6d4',
        fillOpacity: 0.08,
      });
    } else {
      radiusCircleRef.current.setPosition(latLng);
      radiusCircleRef.current.setRadius(radiusMeters);
      radiusCircleRef.current.setMap(map);
    }
  }, [isMapReady, radiusMeters, selectedPoint]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const kakao = window.kakao;
    if (!map || !kakao?.maps || !isMapReady) return;

    clearMarkerOverlays();

    const bounds = new kakao.maps.LatLngBounds();
    let pointCount = 0;

    if (selectedPoint && isValidCoordinate(selectedPoint.latitude, selectedPoint.longitude)) {
      bounds.extend(new kakao.maps.LatLng(selectedPoint.latitude, selectedPoint.longitude));
      pointCount += 1;
    }

    markers.forEach((marker) => {
      if (!isValidCoordinate(marker.latitude, marker.longitude)) return;

      const overlay = createMarkerOverlay(
        kakao,
        marker,
        marker.id === activeMarkerId,
        () => onMarkerClickRef.current(marker)
      );

      overlay.setMap(map);
      markerOverlaysRef.current.push(overlay);
      bounds.extend(new kakao.maps.LatLng(marker.latitude, marker.longitude));
      pointCount += 1;
    });

    if (pointCount > 1) {
      map.setBounds(bounds, 60, 60, 60, 60);
      return;
    }

    if (selectedPoint) {
      map.setCenter(new kakao.maps.LatLng(selectedPoint.latitude, selectedPoint.longitude));
      map.setLevel(5);
    }
  }, [activeMarkerId, isMapReady, markers, selectedPoint]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const kakao = window.kakao;
    if (!map || !kakao?.maps || !activeMarkerId) return;

    const activeMarker = markers.find((marker) => marker.id === activeMarkerId);
    if (!activeMarker) return;

    map.panTo(new kakao.maps.LatLng(activeMarker.latitude, activeMarker.longitude));
  }, [activeMarkerId, markers]);

  return (
    <div className={`relative w-full overflow-hidden rounded-xl border border-hud-border-secondary ${heightClassName}`}>
      <div ref={mapRef} className="h-full w-full bg-hud-bg-primary" />

      {!isMapReady && !loadingError && (
        <div className="absolute inset-0 flex items-center justify-center bg-hud-bg-primary/82 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm text-hud-text-secondary">
            <Loader2 className="h-4 w-4 animate-spin" />
            거래 지도를 불러오는 중...
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
