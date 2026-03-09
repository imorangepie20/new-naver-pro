import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '')
    // 프론트(5173) -> API(3001) 프록시는 내부망 주소를 우선 사용한다.
    // 외부 DDNS를 내부 프록시 타깃으로 사용하면 서버 DNS 상태에 따라 API 호출이 실패할 수 있다.
    const apiTarget =
        env.VITE_API_PROXY_TARGET ||
        env.API_PROXY_TARGET ||
        env.API_TARGET ||
        env.VITE_API_TARGET ||
        'http://127.0.0.1:3001'

    return {
        plugins: [react()],
        resolve: {
            alias: {
                '@': fileURLToPath(new URL('./src', import.meta.url)),
            },
        },
        server: {
            host: true, // 0.0.0.0으로 바인딩하여 외부 접근 허용
            port: 5173,
            allowedHosts: true, // 모든 호스트 허용
            proxy: {
                '/api': {
                    // 우선순위: VITE_API_PROXY_TARGET > API_PROXY_TARGET > API_TARGET > VITE_API_TARGET > 127.0.0.1
                    target: apiTarget,
                    changeOrigin: true,
                },
            },
        },
    }
})
