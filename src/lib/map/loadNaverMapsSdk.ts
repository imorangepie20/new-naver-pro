import { API_BASE } from '../api';

declare global {
  interface Window {
    naver?: any;
  }
}

let sdkLoadPromise: Promise<any> | null = null;

function getCurrentOrigin() {
  if (typeof window === 'undefined') return 'unknown';
  return window.location.origin;
}

function hasNaverMapsConstructors() {
  const maps = window.naver?.maps;
  return (
    maps &&
    typeof maps.Map === 'function' &&
    typeof maps.LatLng === 'function'
  );
}

async function waitForNaverMaps(maxRetries = 120, intervalMs = 100) {
  for (let retry = 0; retry < maxRetries; retry += 1) {
    if (hasNaverMapsConstructors()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Naver Maps constructors are unavailable after SDK load. origin=${getCurrentOrigin()}`);
}

function removeExistingSdkScript() {
  const existing = document.getElementById('naver-maps-sdk');
  if (existing) existing.remove();

  const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>('script[src]'));
  for (const script of scripts) {
    const src = script.getAttribute('src') || '';
    if (
      src.includes('oapi.map.naver.com')
      || src.includes('openapi.map.naver.com')
      || src.includes('/api/proxy/naver-map')
    ) {
      script.remove();
    }
  }
}

function injectSdkScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    removeExistingSdkScript();

    const script = document.createElement('script');
    script.id = 'naver-maps-sdk';
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load Naver Maps SDK: ${src}`));
    document.head.appendChild(script);
  });
}

export function loadNaverMapsSdk() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Naver Maps SDK can only be loaded in browser.'));
  }

  if (hasNaverMapsConstructors()) {
    return Promise.resolve(window.naver);
  }

  if (sdkLoadPromise) {
    return sdkLoadPromise;
  }

  sdkLoadPromise = new Promise((resolve, reject) => {
    const clientId =
      (import.meta.env as any).VITE_NAVER_MAP_CLIENT_ID || '8e5c59zw88';
    const useProxyFallback = String((import.meta.env as any).VITE_NAVER_MAP_USE_PROXY || '').toLowerCase() === 'true';

    const directSdkUrl = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}`;
    const proxySdkUrl = `${API_BASE}/api/proxy/naver-map`;

    injectSdkScript(directSdkUrl)
      .then(() => waitForNaverMaps())
      .then(() => resolve(window.naver))
      .catch(async (directError) => {
        if (!useProxyFallback) {
          reject(directError);
          return;
        }

        console.warn('[NaverMap] Direct SDK load failed, trying proxy:', directError);
        try {
          await injectSdkScript(proxySdkUrl);
          await waitForNaverMaps();
          resolve(window.naver);
        } catch (proxyError) {
          reject(proxyError);
        }
      })
      .catch((error) => reject(error));
  }).catch((error) => {
    sdkLoadPromise = null;
    throw error;
  });

  return sdkLoadPromise;
}
