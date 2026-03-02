# 개발 & 배포 가이드

> 마지막 업데이트: 2026-03-02

---

## 목차

1. [서비스 개요](#서비스-개요)
2. [빠른 시작](#빠른-시작)
3. [개발 서버](#개발-서버)
4. [데이터베이스](#데이터베이스)
5. [Prisma](#prisma)
6. [Railway 배포](#railway-배포)
7. [문제 해결](#문제-해결)

---

## 서비스 개요

| 서비스 | 포트 | 재시작 필요 | 설명 |
|--------|------|-------------|------|
| 프론트엔드 (Vite) | 5173 | 자동 HMR | 코드 수정 시 자동 리로드 |
| 백엔드 (API) | 3001 | **필수** | 서버 코드 수정 시 재시작 |
| PostgreSQL (DB) | 5432 | 보통 유지 | Docker 또는 DataGrip으로 시작 |

---

## 빠른 시작

### 1단계: 데이터베이스 시작
```bash
# Homebrew PostgreSQL
brew services start postgresql@16
```

### 2단계: 전체 서버 시작
```bash
# 스크립트 사용 (권장)
./restart.sh
```

또는 수동:
```bash
# 백엔드
npm run dev:api &

# 프론트엔드
npm run dev
```

### 접속 URL
| 환경 | URL |
|------|-----|
| 로컬 | http://localhost:5173 |
| 내부망 | http://192.168.219.57:5173 |
| 외부 | http://imapplepie20.tplinkdns.com:5173 |
| API | http://localhost:3001 |

---

## 개발 서버

### 프론트엔드 (Vite)

#### 자동 핫 리로드
- 코드 수정 시 브라우저에 자동 반영
- **재시작 불필요**

#### 수동 재시작이 필요한 경우
```bash
# 실행 중인 서버 중지: Ctrl+C
# 다시 실행
npm run dev
```

### 백엔드 (API)

#### 재시작이 필요한 경우
- `src/server/index.ts` 수정
- `prisma/schema.prisma` 수정 (마이그레이션 후)
- 환경 변수 변경

#### 재시작 방법
```bash
# 프로세스 종료
lsof -ti :3001 | xargs kill -9 2>/dev/null || true

# 다시 실행
npm run dev:api
```

#### 서버 상태 확인
```bash
# 포트 확인
lsof -i :3001

# 헬스 체크
curl http://localhost:3001/api/health
```

---

## 데이터베이스

### Homebrew PostgreSQL (로컬 개발)

```bash
# 시작
brew services start postgresql@16

# 중지
brew services stop postgresql@16

# 재시작
brew services restart postgresql@16

# 상태 확인
lsof -i :5432
```

### Docker (사용 안 함)
- Docker Desktop 불안정으로 Homebrew PostgreSQL 사용
- `docker-compose.yml`은 레거시 참고용

### DataGrip 사용
- DataGrip에서 데이터베이스 연결을 클릭하면 자동 시작

### 연결 정보
| 항목 | 값 |
|------|-----|
| Host | `localhost` |
| Port | `5432` |
| Database | `naver_land` |
| User | `root` |
| Password | `password` |
| JDBC URL | `jdbc:postgresql://localhost:5432/naver_land` |

---

## Prisma

### 스키마 변경 후
```bash
# 1. Prisma Client 생성
npx prisma generate

# 2. 데이터베이스 마이그레이션
npx prisma migrate dev

# 3. 백엔드 서버 재시작
npm run dev:api
```

### Prisma Studio (DB GUI)
```bash
# 실행
npx prisma studio

# 접속
http://localhost:5555
```

---

## Railway 배포

> **참고**: Railway는 자체 PostgreSQL을 사용합니다. 로컬 Homebrew PostgreSQL과 별개입니다.

### 프로젝트 정보
| 항목 | 값 |
|------|-----|
| Railway 프로젝트 | new-naver-pro |
| GitHub | `imapplepie20-collab/new-naver-pro` |
| 런타임 | Bun (Dockerfile) |
| 배포 URL | https://web-production-e567c.up.railway.app |

### Railway 명령어
```bash
# 설치
npm install -g @railway/cli

# 로그인
railway login --browserless

# 배포
railway up --detach

# 로그 확인
railway logs

# 환경변수
railway variables
```

### 재배포
```bash
git add .
git commit -m "변경사항"
git push origin main
railway up --detach
```

---

## 문제 해결

### "서버에 연결할 수 없습니다" 에러
```bash
# 1. PostgreSQL 확인
lsof -i :5432

# 2. 백엔드 확인
lsof -i :3001

# 3. DB 시작
brew services start postgresql@16
```

### 404 에러
1. 백엔드 서버 재시작
2. API 경로 확인

### 포트 이미 사용 중 에러
```bash
# 해당 포트 프로세스 종료
lsof -ti :<PORT> | xargs kill -9

# 예: 3001 포트
lsof -ti :3001 | xargs kill -9
```

### 타입 에러 (Prisma)
```bash
npx prisma generate
npm run dev:api
```
