/**
 * API Base URL 설정
 * - 프로덕션: 같은 서버에서 서빙되므로 빈 문자열 (상대 경로)
 * - 개발: 현재 호스트의 3001 포트 사용 (외부 접속 지원)
 */
export const API_BASE = (() => {
  // 환경 변수가 있으면 사용 (Railway 등)
  if (import.meta.env.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE;
  }

  // 개발 모드且 외부 접속 시: 현재 호스트의 3001 포트 사용
  const hostname = window.location.hostname;

  // localhost 개발은 프록시 사용 (빈 문자열)
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return '';
  }

  // 외부 접속: 현재 호스트의 3001 포트
  return `http://${hostname}:3001`;
})();
