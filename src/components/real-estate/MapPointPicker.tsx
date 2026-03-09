import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { loadKakaoMapsSdk } from '../../lib/map/loadKakaoMapsSdk';
import { useThemeStore } from '../../stores/themeStore';

interface MapPoint {
  latitude: number;
  longitude: number;
}

interface MapSamplePoint {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
}

interface MapPointPickerProps {
  center: MapPoint;
  selectedPoint: MapPoint | null;
  points?: MapSamplePoint[];
  activePointId?: string | null;
  onPointClick?: (point: MapSamplePoint) => void;
  radiusMeters?: number;
  onSelect: (point: MapPoint) => void;
  heightClassName?: string;
}

const MapPointPicker = ({
  center,
  selectedPoint,
  points = [],
  activePointId = null,
  onPointClick,
  radiusMeters = 1000,
  onSelect,
  heightClassName = 'h-[380px]',
}: MapPointPickerProps) => {
  const themeMode = useThemeStore((state) => state.mode);
  const accentColor = useThemeStore((state) => state.accentColor);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const radiusCircleRef = useRef<any>(null);
  const sampleMarkersRef = useRef<any[]>([]);
  const clickHandlerRef = useRef<any>(null);
  const onSelectRef = useRef(onSelect);
  const onPointClickRef = useRef(onPointClick);
  const [isMapReady, setIsMapReady] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  onSelectRef.current = onSelect;
  onPointClickRef.current = onPointClick;

  const resolveMapAccentColor = () => {
    if (typeof window === 'undefined') return '';
    return getComputedStyle(document.documentElement)
      .getPropertyValue('--hud-accent-primary')
      .trim();
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
          onSelectRef.current({
            latitude: latLng.getLat(),
            longitude: latLng.getLng(),
          });
        };

        kakao.maps.event.addListener(map, 'click', clickHandler);

        mapInstanceRef.current = map;
        clickHandlerRef.current = clickHandler;
        setIsMapReady(true);
      } catch (error) {
        console.error('Failed to initialize Kakao map picker:', error);
        if (mounted) {
          setLoadingError('카카오 지도를 불러오지 못했습니다.');
        }
      }
    };

    initMap();

    return () => {
      mounted = false;

      const map = mapInstanceRef.current;
      const clickHandler = clickHandlerRef.current;
      if (map && clickHandler && window.kakao?.maps?.event) {
        window.kakao.maps.event.removeListener(map, 'click', clickHandler);
      }
      if (markerRef.current) {
        markerRef.current.setMap(null);
      }
      if (radiusCircleRef.current) {
        radiusCircleRef.current.setMap(null);
      }
      sampleMarkersRef.current.forEach((marker) => marker.setMap(null));

      mapInstanceRef.current = null;
      markerRef.current = null;
      radiusCircleRef.current = null;
      sampleMarkersRef.current = [];
      clickHandlerRef.current = null;
      setIsMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.kakao?.maps) return;
    map.setCenter(new window.kakao.maps.LatLng(center.latitude, center.longitude));
  }, [center.latitude, center.longitude]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const kakao = window.kakao;
    if (!map || !kakao?.maps || !selectedPoint) return;

    const latLng = new kakao.maps.LatLng(selectedPoint.latitude, selectedPoint.longitude);

    if (!markerRef.current) {
      markerRef.current = new kakao.maps.Marker({
        map,
        position: latLng,
      });
    } else {
      markerRef.current.setPosition(latLng);
    }

    if (!radiusCircleRef.current) {
      const circleColor = resolveMapAccentColor();
      const circleOptions: any = {
        map,
        center: latLng,
        radius: radiusMeters,
        strokeWeight: 2,
        strokeOpacity: 0.9,
        fillOpacity: 0.12,
      };
      if (circleColor) {
        circleOptions.strokeColor = circleColor;
        circleOptions.fillColor = circleColor;
      }
      radiusCircleRef.current = new kakao.maps.Circle(circleOptions);
    } else {
      const circleColor = resolveMapAccentColor();
      radiusCircleRef.current.setPosition(latLng);
      radiusCircleRef.current.setRadius(radiusMeters);
      if (circleColor) {
        radiusCircleRef.current.setOptions({
          strokeColor: circleColor,
          fillColor: circleColor,
        });
      }
    }
  }, [selectedPoint, radiusMeters, isMapReady, themeMode, accentColor]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const kakao = window.kakao;
    if (!map || !kakao?.maps || !isMapReady) return;

    sampleMarkersRef.current.forEach((marker) => marker.setMap(null));
    sampleMarkersRef.current = [];

    points.forEach((point) => {
      const marker = new kakao.maps.Marker({
        map,
        position: new kakao.maps.LatLng(point.latitude, point.longitude),
        title: point.label,
        zIndex: point.id === activePointId ? 8 : 3,
      });
      kakao.maps.event.addListener(marker, 'click', () => {
        onPointClickRef.current?.(point);
      });
      sampleMarkersRef.current.push(marker);
    });
  }, [points, activePointId, isMapReady]);

  return (
    <div className={`relative w-full ${heightClassName} rounded-xl overflow-hidden border border-hud-border-secondary`}>
      <div ref={mapRef} className="w-full h-full bg-hud-bg-primary" />
      {!isMapReady && !loadingError && (
        <div className="absolute inset-0 flex items-center justify-center bg-hud-bg-primary/80 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm text-hud-text-secondary">
            <Loader2 className="w-4 h-4 animate-spin" />
            카카오 지도 로딩 중...
          </div>
        </div>
      )}
      {loadingError && (
        <div className="absolute inset-0 flex items-center justify-center bg-hud-bg-primary/90">
          <p className="text-sm text-hud-accent-danger">{loadingError}</p>
        </div>
      )}
    </div>
  );
};

export default MapPointPicker;
