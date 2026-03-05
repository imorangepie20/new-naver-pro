import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
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
                // 로컬 개발: localhost, 외부 접속: tplinkdns.com
                target: process.env.API_TARGET || 'http://localhost:3001',
                changeOrigin: true,
            },
        },
    },
})
