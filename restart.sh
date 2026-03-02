#!/bin/bash

# ============================================
# 개발 서버 전체 재시작 스크립트
# ============================================

echo "🔄 개발 서버 재시작 중..."

# 0. 데이터베이스 시작
echo "🗄️  데이터베이스 시작..."
if ! lsof -Pi :5432 > /dev/null 2>&1; then
    brew services start postgresql@16
    sleep 2
fi
echo "✅ 데이터베이스 실행 중"

# 1. 실행 중인 서버들 종료
echo "📦 실행 중인 프로세스 종료..."

# 백엔드 서버 (포트 3001)
if lsof -Pi :3001 > /dev/null 2>&1; then
    echo "  - 백엔드 서버 종료 (3001)"
    lsof -ti :3001 | xargs kill -9 2>/dev/null || true
fi

# 프론트엔드 서버 (포트 5173)
if lsof -Pi :5173 > /dev/null 2>&1; then
    echo "  - 프론트엔드 서버 종료 (5173)"
    lsof -ti :5173 | xargs kill -9 2>/dev/null || true
fi

echo "✅ 기존 프로세스 종료 완료"
echo ""

# 2. 잠시 대기 (포트 해제)
sleep 1

# 3. 백엔드 서버 시작
echo "🚀 백엔드 서버 시작 (포트 3001)..."
npm run dev:api &
BACKEND_PID=$!

# 4. 백엔드 시작 대기
echo "⏳ 백엔드 서버 대기 중..."
sleep 3

# 5. 백엔드 헬스 체크
if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "✅ 백엔드 서버 시작 완료"
else
    echo "❌ 백엔드 서버 시작 실패 - 직접 확인 필요"
fi

# 6. 프론트엔드 서버 시작
echo ""
echo "🚀 프론트엔드 서버 시작 (포트 5173)..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "========================================="
echo "✨ 모든 서버 시작 완료!"
echo "========================================="
echo "📱 프론트엔드: http://localhost:5173"
echo "🔧 백엔드 API: http://localhost:3001"
echo "🗄️  Prisma Studio: npx prisma studio"
echo "🌐 외부 접속:"
echo "   - http://192.168.219.57:5173"
echo "   - http://imapplepie20.tplinkdns.com:5173"
echo ""
echo "종료하려면 Ctrl+C"
echo "========================================="

# 포그라운드로 프론트엔드 실행 (백엔드는 백그라운드)
wait $FRONTEND_PID
