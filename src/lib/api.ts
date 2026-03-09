/**
 * API Base URL 설정
 * - VITE_API_BASE 지정 시 우선 사용
 * - 기본값: same-origin(/api) 상대 경로 사용
 *   (개발/운영 모두 프록시 또는 리버스 프록시 경로를 통일)
 */
export const API_BASE = (() => {
  // 환경 변수가 있으면 사용 (Railway/커스텀 배포 등)
  if (import.meta.env.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE;
  }
  return '';
})();
