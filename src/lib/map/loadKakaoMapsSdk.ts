import { API_BASE } from '../api';

declare global {
  interface Window {
    kakao?: any;
    daum?: any;
  }
}

let sdkLoadPromise: Promise<any> | null = null;

function hasConstructors(maps: any) {
  return typeof maps?.Map === 'function' && typeof maps?.LatLng === 'function';
}

function hasServices(maps: any) {
  return typeof maps?.services?.Geocoder === 'function';
}

function getKakaoMapsNamespace() {
  const kakaoMaps = window.kakao?.maps;
  const daumMaps = window.daum?.maps;
  if (hasConstructors(kakaoMaps)) return kakaoMaps;
  if (hasConstructors(daumMaps)) return daumMaps;
  if (kakaoMaps) return kakaoMaps;
  if (daumMaps) return daumMaps;
  return null;
}

function ensureKakaoNamespace() {
  const namespace = getKakaoMapsNamespace();
  if (!namespace) return null;
  window.kakao = window.kakao || {};
  window.daum = window.daum || {};
  window.kakao.maps = namespace;
  window.daum.maps = namespace;
  return window.kakao.maps;
}

function hasKakaoMapConstructors() {
  return hasConstructors(ensureKakaoNamespace());
}

function hasKakaoServices() {
  return hasServices(ensureKakaoNamespace());
}

async function waitForKakaoConstructors(maxRetries = 100, intervalMs = 100) {
  for (let retry = 0; retry < maxRetries; retry += 1) {
    if (hasKakaoMapConstructors()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('Kakao Maps constructors are unavailable after SDK load.');
}

async function waitForKakaoServices(maxRetries = 100, intervalMs = 100) {
  for (let retry = 0; retry < maxRetries; retry += 1) {
    if (hasKakaoServices()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('Kakao Maps services library is unavailable after SDK load.');
}

function resolveKakaoSdk(resolve: (kakao: any) => void, reject: (error: Error) => void) {
  const kakao = window.kakao || {};
  if (hasKakaoMapConstructors() && hasKakaoServices()) {
    ensureKakaoNamespace();
    resolve(kakao);
    return;
  }

  const maps = ensureKakaoNamespace();
  if (!maps?.load) {
    reject(new Error('Kakao Maps SDK is not available on window.'));
    return;
  }

  maps.load(() => {
    waitForKakaoConstructors()
      .then(() => {
        waitForKakaoServices()
          .then(() => {
            ensureKakaoNamespace();
            resolve(window.kakao);
          })
          .catch((error) => reject(error instanceof Error ? error : new Error(String(error))));
      })
      .catch((error) => reject(error instanceof Error ? error : new Error(String(error))));
  });
}

function removeExistingSdkScript() {
  const existingScript = document.getElementById('kakao-maps-sdk');
  if (existingScript) existingScript.remove();

  const scriptNodes = Array.from(document.querySelectorAll<HTMLScriptElement>('script[src]'));
  for (const script of scriptNodes) {
    const src = script.getAttribute('src') || '';
    if (src.includes('dapi.kakao.com/v2/maps/sdk.js') || src.includes('/api/proxy/kakao-map/')) {
      script.remove();
    }
  }
}

function injectSdkScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    removeExistingSdkScript();

    const script = document.createElement('script');
    script.id = 'kakao-maps-sdk';
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load Kakao Maps SDK script: ${src}`));
    document.head.appendChild(script);
  });
}

export function loadKakaoMapsSdk() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Kakao Maps SDK can only be loaded in browser.'));
  }

  if (hasKakaoMapConstructors() && hasKakaoServices()) {
    return Promise.resolve(window.kakao);
  }

  if (sdkLoadPromise) {
    return sdkLoadPromise;
  }

  sdkLoadPromise = new Promise((resolve, reject) => {
    const appKey = import.meta.env.VITE_KAKAO_MAP_APP_KEY;
    if (!appKey) {
      reject(new Error('VITE_KAKAO_MAP_APP_KEY is missing.'));
      return;
    }
    const libraries = 'services,clusterer,drawing';
    const directSdkUrl = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&libraries=${libraries}&autoload=false`;
    const proxySdkUrl = `${API_BASE}/api/proxy/kakao-map/dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&libraries=${libraries}&autoload=false`;

    // Existing namespace might come from a script loaded without libraries=services.
    // In that case, force-reload SDK script with required libraries.
    if (window.kakao?.maps?.load && !hasKakaoServices()) {
      removeExistingSdkScript();
      delete window.kakao;
      delete window.daum;
    }

    if (window.kakao?.maps?.load) {
      resolveKakaoSdk(resolve, reject);
      return;
    }

    injectSdkScript(directSdkUrl)
      .then(() => resolveKakaoSdk(resolve, reject))
      .catch(async (directError) => {
        console.warn('[KakaoMap] Direct SDK load failed, trying proxy:', directError);
        await injectSdkScript(proxySdkUrl);
        resolveKakaoSdk(resolve, reject);
      })
      .catch((error) => reject(error));
  }).catch((error) => {
    sdkLoadPromise = null;
    throw error;
  });

  return sdkLoadPromise;
}
