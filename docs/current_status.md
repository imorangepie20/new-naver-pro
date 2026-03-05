# 현재 작업 상태

> 최종 업데이트: 2026-03-05 (사용자별 데이터 분리 구현 완료)

## 완료된 작업 ✅
- **스마트 고급 캘린더 완료** (2026-03-04)
  - 다중 뷰 전환 (월간/주간/일간/리스트)
  - AI 기반 스마트 일정 분류 (제목/설명 자동 분석)
  - 일정 충돌 감지 및 경고
  - 반복 일정 기능 (매일/매주/매월/매년)
  - 드래그 & 드롭 지원
  - 키보드 단축키 (N: 새 일정, T: 오늘, M/W/D/L: 뷰 전환, ←→: 이전/다음)
  - 빠른 통계 카드 (이번 달/오늘/반복/회의 일정 수)
  - 우선순위 설정 (낮음/보통/높음/긴급)
  - 공휴일 표시
  - DB 스키마 확장 (반복 일정, 우선순위, 색상, 참여자, 상태 필드 추가)
  - 파일: `src/pages/Calendar.tsx`, `prisma/schema.prisma`
- **대시보드 재작성 완료** (2026-03-04)
  - 총 매물수, 관심 매물수, 관리 매물수 StatCard
  - 최근 10일 등록 매물 목록
  - 최근 10일 등록 관심 매물 목록
  - 최근 10일 등록 관리 매물 목록
  - 최근 30일 계약 매물 목록
  - 오늘의 일정 표시
  - 최근 거래 금액 추이 차트
  - 빠른 링크 섹션
- **일정(Schedule) 기능 추가 완료** (2026-03-04)
  - Schedule DB 모델 추가 (prisma/schema.prisma)
  - 일정 CRUD API (/api/schedules)
  - 캘린더 페이지 API 연동
  - 일정 생성/수정/삭제 기능
  - 날짜별 일정 조회
  - date-fns 기반 동적 달력
- **테이블 UI 통일 및 반응형 개선 완료**
- **매물 목록 테이블 스타일 통일 완료** (2026-03-04)
- **매물 목록 컬럼 구조 통일 완료** (2026-03-04)
- **단지 다중 선택 후 임시 매물 페이지에서 보기 기능** (2026-03-04)
- **스마트 파싱 기능 추가** (2026-03-04)
  - papaparse 도입으로 안정적 CSV 파싱
  - PDF 지원 (pdfjs-dist)
  - 로컬 AI 파싱 (Transformers.js)
  - Claude/OpenAI API 옵션
- **정규 매물 목록 전체 삭제 프로그래스 바 구현** (2026-03-04)
  - 배치 처리 (10개씩 병렬 삭제)
  - 실시간 진행률 표시 모달
  - 삭제된 항목 실시간 반영
- **설정 페이지 데이터 관리 섹션 추가** (2026-03-04)
  - 프로필 삭제 기능
  - 캘린더 데이터 삭제 기능
  - 삭제 진행 상태 표시
  - 경고 안내 및 확인 다이얼로그
- **프로필 상세 주소 필드 추가** (2026-03-05)
  - User 모델에 detailAddress 필드 추가
  - Settings.tsx에 상세 주소 입력 필드 추가
  - API(GET/PUT)에서 detailAddress 처리 추가
  - 파일: `prisma/schema.prisma`, `src/pages/Settings.tsx`, `src/server/index.ts`
- **Railway 배포 완료** (2026-03-05)
  - 배포 URL: https://web-production-e567c.up.railway.app
  - Dockerfile 기반 배포 (Bun 런타임)
  - Puppeteer Chromium 포함
  - Healthcheck: /api/health
  - Vite 정적 파일 서빙 + API 서버
- **매물 테이블 주소 필드 추가** (2026-03-05)
  - Property 모델에 cortarAddress 필드 추가
  - Complex 모델에 cortarAddress 필드 추가
  - Article 타입에 cortarAddress 속성 추가
  - 정규 매물 목록 테이블에 주소 열 표시
  - API 단지 조회 시 cortarAddress 자동 업데이트
  - 파일: `prisma/schema.prisma`, `src/types/naver-land.ts`, `src/server/index.ts`, `src/pages/real-estate/ApartmentRegularPropertyList.tsx`
- **단지 테이블 도로명/상세 주소 필드 추가** (2026-03-05)
  - Complex 모델에 roadAddress, detailAddress 필드 추가
  - Article 타입에 roadAddress 속성 추가
  - naver-client.getComplexDetail()에 sameAddressGroup=false 파라미터 추가
  - API 단지 조회 시 cortarAddress, roadAddress, detailAddress 자동 업데이트
  - 파일: `prisma/schema.prisma`, `src/types/naver-land.ts`, `src/server/index.ts`, `src/lib/scraper/naver-client.ts`
- **모든 데이터 조회 limit 제한 제거** (2026-03-05)
  - ApartmentRegularPropertyList: limit=1000 제거
  - UploadedPropertyList: limit=1000 제거
  - /api/properties: 기본 limit 제거 (limit 파라미터만 유지)
  - /api/dashboard/*: 모든 take: 10 제거
  - /api/statistics/regions: 기본 limit=10 제거
  - 파일: `src/pages/real-estate/ApartmentRegularPropertyList.tsx`, `src/pages/real-estate/UploadedPropertyList.tsx`, `src/server/index.ts`
- **사용자별 데이터 분리 구현 완료** (2026-03-05)
  - Property 모델에 userId 필드 추가 (이미 존재)
  - JWT 기반 인증 API 구현 (`src/server/auth.ts`)
    - POST /api/auth/register - 회원가입 (비밀번호 bcrypt 해시)
    - POST /api/auth/login - 로그인 (JWT 토큰 발급, 7일 유효)
    - GET /api/auth/me - 현재 사용자 정보
  - 매물 API 사용자 필터링 추가
    - GET /api/properties - 로그인 시 본인 매물만, 비로그인 시 공용 매물만
    - POST /api/properties - userId 자동 저장
    - POST /api/properties/bulk - userId 자동 저장
    - PUT /api/properties/:articleNo - 소유자 확인 후 수정
    - DELETE /api/properties/:articleNo - 소유자 확인 후 삭제
  - 프론트엔드 authStore에 authFetch 함수 추가 (Authorization 헤더 자동 추가)
  - 파일: `src/server/auth.ts`, `src/stores/authStore.ts`, `src/server/index.ts`

## 진행 중인 작업
- 없음

## 해결된 문제 (2026-03-05)
- **로그인 오류 해결** (2026-03-05)
  - 문제: src/server/index.ts에 중복된 auth 엔드포인트 정의 (auth.ts와 충돌)
  - 해결: index.ts에서 중복된 /api/auth/register, /api/auth/login, /api/auth/me 제거
  - 문제: DATABASE_URL 환경 변수 누락으로 서버 시작 실패
  - 해결: 로컬 PostgreSQL 사용 설정 (postgresql://woosungjo@localhost:5432/imapplepie)
  - 문제: Railway PostgreSQL은 공개 도메인 없음 (내부 네트워크 전용)
  - 해결: 로컬 개발용 PostgreSQL@16 사용, Railway는 배포용으로 분리
  - 파일: `src/server/index.ts`, `src/server/auth.ts`, `.env.development`
  - 테스트: 회원가입, 로그인 정상 작동 확인

---

## 스마트 캘린더 기능 상세

### 추가된 라이브러리
```bash
npm install framer-motion react-hotkeys-hook
```

### 키보드 단축키
| 단축키 | 기능 |
|--------|------|
| N | 새 일정 추가 |
| T | 오늘로 이동 |
| M | 월간 뷰 |
| W | 주간 뷰 |
| D | 일간 뷰 |
| L | 리스트 뷰 |
| ← | 이전 달 |
| → | 다음 달 |

### AI 자동 분류 패턴
- **회의**: 회의, 미팅, 모임, 협의, 점검, review, meeting
- **발표**: 발표, 프레젠테이션, 설명회, 데모, presentation
- **업무**: 업무, 작업, 처리, 완료, 보고, task
- **이벤트**: 행사, 파티, 연회, 기념일, 축하, event
- **휴식**: 휴식, 식사, 점심, 저녁, 휴가, break
- **긴급**: 긴급, 즉시, 바로, 촉급, urgent, asap

### 우선순위별 색상
- 낮음: 회색
- 보통: 노란색
- 높음: 주황색
- 긴급: 빨간색

### 일정 유형별 색상
- 회의: 파란색
- 발표: 보라색
- �무: 노란색
- 이벤트: 청록색
- 휴식: 초록색
- 긴급: 빨간색
