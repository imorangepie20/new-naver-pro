# 세션 컨텍스트 기록

> 최종 업데이트: 2026-03-05 (사용자별 데이터 분리 구현 완료)

---

## 프로젝트 개요
- **프로젝트명**: 네이버 부동산 매물 관리 시스템 (hud-admin-template 기반)
- **목적**: 아파트/오피스텔 매물 검색, 등록, 관리, 출력 통합 플랫폼
- **배포 URL**: https://web-production-e567c.up.railway.app

---

## 기술 스택
| 구분 | 기술 | 버전 |
|------|------|------|
| 프론트엔드 | React + TypeScript | 18.x |
| 빌드 도구 | Vite | 6.x |
| 스타일링 | Tailwind CSS | 3.x |
| 상태 관리 | Zustand | 5.x |
| 라우팅 | React Router | 6.x |
| 백엔드 | Hono (Bun 런타임) | 4.x |
| DB | PostgreSQL + Prisma | Prisma 7.x |
| 차트 | Recharts + Chart.js | - |
| 지도 | Leaflet (네이버/카카오) | 1.9.x |

---

## 데이터베이스 연결 정보
### 로컬 개발용
| 항목 | 값 |
|------|-----|
| Host | localhost |
| Port | 5432 |
| Database | imapplepie |
| User | woosungjo |
| Prisma Studio | npx prisma studio |

### Railway 배포용
| 항목 | 값 |
|------|-----|
| 내부 호스트 | postgres.railway.internal:5432 |
| Database | railway |
| Railway 프로젝트 | new-naver-pro | |

---

## DB 스키마 구조 (15개 모델)

### 사용자 관리 (개인 데이터)
- **User**: 사용자 정보, 테마 설정, 인증 정보
- **SavedProperty**: 저장한 매물 (찜) - isFavorite 필드로 관심매물 구분
- **SearchCondition**: 저장된 검색 조건
- **PriceAlert**: 가격 알림 설정
- **Note**: 매물 메모
- **WatchArea**: 관심 지역/단지 설정

### 부동산 데이터 (공용)
- **Region**: 지역 정보 (계층적 구조: 시도 > 시군구 > 읍면동)
- **Complex**: 단지 정보 (아파트/오피스텔)
- **Property**: 매물 상세 정보 (네이버 크롤링 + 수동 입력, userId로 사용자 분리)
- **PriceHistory**: 가격 이력 (시계열 데이터)

### 관리 기능 (개인 데이터)
- **ManagedProperty**: 관리 매물 (계약 관리, 재계약 알림)
- **FavoriteProperty**: 독립적 관심 매물 (네이버 데이터 무관)

### 시스템
- **NaverToken**: 네이버 API 토큰 관리
- **ScrapLog**: 크롤링 로그

---

## 실행 방법

### 개발 모드
```bash
# 방법 1: 전체 한 번에 실행
./restart.sh

# 방법 2: 개별 실행
npm run dev        # 프론트엔드 (http://localhost:5173)
npm run dev:api    # 백엔드 (http://localhost:3001)
```

### 외부 접속 (핸드폰 등)
```bash
# .env 파일 생성 (이미 생성됨)
echo "VITE_API_BASE=http://imapplepie20.tplinkdns.com:3001" > .env

# 백엔드 실행
npm run dev:api

# 프론트엔드 실행
npm run dev

# 핸드폰에서 http://imapplepie20.tplinkdns.com:5173 접속
```

### 프로덕션 모드
```bash
npm run build:all  # 빌드
npm start          # 단일 서버 실행 (http://localhost:3001)
```

---

## API 엔드포인트 (총 40개)

### 인증 & 토큰 (4개)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/token/status | 토큰 상태 |
| POST | /api/token/refresh | 토큰 갱신 |
| POST | /api/token/manual | 토큰 수동 입력 |
| POST | /api/auth/login | 로그인 |
| POST | /api/auth/register | 회원가입 |
| GET | /api/auth/me | 현재 유저 |

### 지역 관리 (2개)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/regions | 지역 목록 |
| GET | /api/regions/tree | 지역 트리 |

### 매물 API (6개)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/properties | 중앙 DB 매물 조회 |
| POST | /api/properties | 매물 직접 등록 |
| POST | /api/properties/bulk | 매물 일괄 등록 |
| DELETE | /api/properties/:articleNo | 매물 삭제 |
| GET | /api/articles | 매물 목록 (빌라/주택) |
| GET | /api/articles/:articleNo | 매물 상세 |
| GET | /api/articles/:articleNo/refresh | 매물 갱신 |
| GET | /api/articles/complex/:complexNo | 단지별 매물 |

### 단지 API (1개)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/complexes | 단지 목록 (가격 포함) |

### 통계 API (5개)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/statistics/overview | 전체 통계 |
| GET | /api/statistics/regions | 지역별 통계 |
| GET | /api/statistics/types | 타입별 통계 |
| GET | /api/statistics/complexes/:complexNo | 단지별 통계 |
| GET | /api/statistics/price-trend | 가격 추이 |

### 사용자 관련 (8개)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/user/saved-properties | 저장 매물 |
| POST | /api/user/saved-properties | 매물 저장 |
| POST | /api/user/saved-properties/bulk | 매물 일괄 저장 |
| DELETE | /api/user/saved-properties/:articleNo | 저장 취소 |
| DELETE | /api/user/saved-properties | 일괄 삭제 |
| GET | /api/user/search-conditions | 검색 조건 |
| POST | /api/user/search-conditions | 조건 저장 |
| POST | /api/user/price-alerts | 가격 알림 설정 |
| GET | /api/user/price-alerts | 가격 알림 목록 |
| GET | /api/user/summary | 사용자 요약 |

### 관리 매물 (4개)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/managed-properties | 관리 매물 목록 |
| POST | /api/managed-properties | 관리 매물 등록 |
| PUT | /api/managed-properties/:id | 관리 매물 수정 |
| DELETE | /api/managed-properties/:id | 관리 매물 삭제 |

### 관심 매물 (4개)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/favorite-properties | 관심 매물 목록 |
| POST | /api/favorite-properties | 관심 매물 등록 |
| PUT | /api/favorite-properties/:id | 관심 매물 수정 |
| DELETE | /api/favorite-properties/:id | 관심 매물 삭제 |

### 기타 (3개)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/global-theme | 글로벌 테마 조회 |
| PUT | /api/global-theme | 글로벌 테마 저장 |
| GET | /api/health | 헬스 체크 |

---

## 주요 페이지 구조

### 부동산 (real-estate)
| 페이지 | 경로 | 설명 |
|--------|------|------|
| RealEstate | /real-estate | 메인 페이지 |
| ComplexListPage | /real-estate/complexes | 단지 목록 + 지도 |
| ApartmentTempPropertyList | /real-estate/temp-apt | 임시 매물 목록 |
| ApartmentRegularPropertyList | /real-estate/regular-apt | 정규 매물 목록 |
| PropertyRegister | /real-estate/register | 매물 등록 |
| FavoritePropertyList | /real-estate/favorites | 관심 매물 |
| ManagedPropertyList | /real-estate/managed | 관리 매물 |
| **UploadedPropertyList** | **/real-estate/uploaded** | **업로드 매물 목록** |

---

## 구현 완료 내역

### 1. 사이드바 메뉴 구조
- "매물 관리" → "매물 데이터"
- 서브메뉴: 매물등록, 매물목록, 관심매물, 관리매물

### 2. 관심매물 (/real-estate/favorites)
- SavedProperty 테이블 isFavorite 목록
- 파일: `src/pages/real-estate/FavoritePropertyList.tsx`

### 3. 관리매물 (/real-estate/managed)
- ManagedProperty 모델 CRUD
- 계약사항 필터 (전체/3개월/1개월/15일/7일/3일/1일)
- 계약금/중도금/잔금 납부일 관리
- 반응형 UI (데스크톱: 테이블, 모바일: 카드)
- 숫자 입력 스피너 제거
- 파일: `src/pages/real-estate/ManagedPropertyList.tsx`

### 4. 매물 등록 (PropertyRegister)
- 드래그 앤 드롭 파일 업로드
- TXT, CSV, Excel 파일 파싱
- 중앙 DB 저장 (POST /api/properties/bulk)

### 5. 엑셀 내보내기
- ExcelExportModal 완료
- 필드 선택 가능

### 6. 테마 시스템
- 4가지 모드: smart, light, dark, system
- 10가지 강조 색상
- 글로벌 테마 동기화

### 7. ✅ 업로드 매물 목록 → 관심매물/관리매물 등록 (2026-03-03 완료)
- **파일**: `src/pages/real-estate/UploadedPropertyList.tsx`
- **기능**:
  - ❤️ 관심매물 등록 버튼 (즉시 등록)
  - 📋 관리매물 등록 버튼 (모달 오픈)
  - ✏️ 매물 수정 버튼 (원본 Property 수정)
  - 계약 만료일 자동 계산 (매매: 3개월, 전세/월세: 2년)
  - 담당자 정보 자동 포함
- **데이터 흐름**:
  ```
  업로드 매물 목록 → ❤️ 버튼 → FavoriteProperty 테이블
  업로드 매물 목록 → 📋 버튼 → 모달 → ManagedProperty 테이블
  업로드 매물 목록 → ✏️ 버튼 → 모달 → PUT /api/properties/:id
  ```

### 8. ✅ 매물목록/관심매물/관리매물 상세보기 기능 (2026-03-04 완료)
- **대상 페이지**:
  - `src/pages/real-estate/UploadedPropertyList.tsx`
  - `src/pages/real-estate/FavoritePropertyList.tsx`
  - `src/pages/real-estate/ManagedPropertyList.tsx`
- **기능**:
  - 🔍 Eye 아이콘 버튼으로 상세보기 모달 오픈
  - 기본 정보 전체 표시 (매물명, 건물명, 주소, 유형, 가격, 면적, 층)
  - 수정 버튼 클릭 시 수정 모달로 연결

### 9. ✅ 테이블 UI 통일 및 반응형 개선 (2026-03-04 완료)
- **대상 페이지**: 매물목록, 관심매물, 관리매물
- **반응형 UI 구조**:
  - 데스크톱 (≥640px): 테이블 뷰
  - 모바일 (<640px): 카드 뷰
- **통일된 UI 요소**:
  - 테이블 헤더 스타일 통일
  - 거래유형 배지 색상 통일 (매매: 빨강, 전세: 초록, 월세: 노랑)
  - 관리 버튼 순서: 상세보기(🔍) → 수정(✏️) → 삭제(🗑️)
- **파일**: `src/pages/real-estate/UploadedPropertyList.tsx`
- **기능**:
  - ❤️ 관심매물 등록 버튼 (즉시 등록)
  - 📋 관리매물 등록 버튼 (모달 오픈)
  - ✏️ 매물 수정 버튼 (원본 Property 수정)
  - 계약 만료일 자동 계산 (매매: 3개월, 전세/월세: 2년)
  - 담당자 정보 자동 포함
- **데이터 흐름**:
  ```
  업로드 매물 목록 → ❤️ 버튼 → FavoriteProperty 테이블
  업로드 매물 목록 → 📋 버튼 → 모달 → ManagedProperty 테이블
  업로드 매물 목록 → ✏️ 버튼 → 모달 → PUT /api/properties/:id
  ```

---

## 진행 중인 작업 (⏳)
- ✅ 매물 수정 기능 (2026-03-03 완료)
- PDF 출력
- 그래프 (가격/거래량 추이, 지역별 평균)
- LLM 출력

---

## Railway 배포 정보
| 항목 | 값 |
|------|-----|
| 프로젝트명 | new-naver-pro |
| GitHub | imapplepie20-collab/new-naver-pro |
| 런타임 | Bun (Dockerfile) |
| 배포 URL | https://web-production-e567c.up.railway.app |

---

## 주요 파일 위치
- 서버: `src/server/index.ts` (2,400+ 라인)
- 사이드바: `src/components/layout/Sidebar.tsx`
- DB 스키마: `prisma/schema.prisma` (14개 모델)
- API 설정: `src/lib/api.ts`
- 라우팅: `src/App.tsx`
- 토큰 관리: `src/lib/scraper/token-manager.ts`
- 네이버 클라이언트: `src/lib/scraper/naver-client.ts`
- **업로드 매물 목록**: `src/pages/real-estate/UploadedPropertyList.tsx`

---

## 최종 분석 일지
- **2026-03-03 (오전)**: 프로젝트 전체 구조 분석 완료
- **2026-03-03 (오후)**: 업로드 매물 목록에서 관심매물/관리매물 등록 기능 구현 완료
  - 관심매물 즉시 등록 (POST /api/favorite-properties)
  - 관리매물 모달 등록 (POST /api/managed-properties)
  - 계약 만료일 자동 계산 로직 추가
  - 담당자 정보 자동 포함
- **2026-03-03 (오후 2차)**: 업로드 매물 목록 수정 기능 구현 완료
  - ✏️ 수정 버튼 추가 (연필 아이콘)
  - 매물 수정 모달 UI 구현
  - PUT /api/properties/:id API 연동
  - 관리 컬럼 너비 확장 (60px → 100px)
- **2026-03-04**: 관리매물 UI 개선 완료
  - 숫자 입력 스피너 제거 (계약금/중도금/잔금 필드)
  - 커서 포커스 이슈 해결 (useMemo 제거, 인라인 입력)
  - "재계약 알림 필터" → "계약사항알림" 텍스트 변경
  - 반응형 UI 구현 (데스크톱: 테이블, 모바일: 카드)
  - 건물명, 메모 필드 삭제 (화면 표시)
  - 상태 필터 삭제 (전체/활성/만료/갱신)
- **2026-03-04**: 상세보기 기능 추가 완료
  - 매물목록/관심매물/관리매물에 🔍 상세보기 버튼 추가
  - 상세보기 모달 UI 구현
- **2026-03-04**: 테이블 UI 통일 및 반응형 개선 완료
  - 세 페이지 반응형 UI 통일 (데스크톱: 테이블, 모바일: 카드)
  - 거래유형 배지 색상 통일
- **2026-03-04**: 매물 목록 테이블 스타일 통일 완료
  - 업로드 매물 목록(UploadedPropertyList.tsx) 테이블 스타일 수정
  - CSS 변수 `--hud-border-table` 제거, `border-hud-border-secondary`로 통일
  - 헤더 배경: `bg-hud-bg-tertiary`로 통일
  - 바디 배경: `bg-hud-bg-secondary`로 통일
  - 행 보더: `border-hud-border-primary/50`로 통일
  - 관심매물/관리매물 목록과 동일한 스타일 적용
- **2026-03-04**: 매물 목록 컬럼 구조 통일 완료 (최종)
  - 관심매물(FavoritePropertyList.tsx) 컬럼 구조: 매물명, 매물유형, 거래, 가격, 월세, 면적, 층, 책임자명, 전화번호, 관리
  - 관리매물(ManagedPropertyList.tsx) 컬럼 구조: 매물명, 매물유형, 거래, 가격, 월세, 면적, 층, 책임자명, 전화번호, 관리
  - 업로드 매물목록과 동일한 컬럼 구조 적용 (데이터 없는 필드는 '-'로 표시)
- **2026-03-04**: 단지 다중 선택 후 임시 매물 페이지에서 보기 기능 구현 완료
  - RealEstate.tsx: 단지 카드에 체크박스 추가, 전체 선택 기능, 선택한 단지 매물 보기 버튼
  - ApartmentTempPropertyList.tsx: 여러 단지의 매물을 병렬로 조회하는 기능 추가
  - 다중 단지 모드일 때 테이블에 단지명 컬럼 추가
  - 선택한 단지들을 URL 파라미터로 전달 (complexNos, complexNames)
- **2026-03-04**: 스마트 파싱 기능 추가 완료
  - **문제**: CSV 파싱 시 매물명이 잘림 ("201동 광교더샵" → "201동")
  - **해결**: papaparse 라이브러리 도입으로 안정적 CSV 파싱 구현
  - **PDF 지원**: pdfjs-dist로 PDF 텍스트 추출 기능 추가
  - **로컬 AI**: Transformers.js 기반 로컬 LLM 파싱 (`src/lib/local-llm.ts`)
    - 오프라인 작동, API 키 불필요
    - CSV/Excel/PDF 다양한 형식 지원
  - **스마트 파싱 UI**: ON/OFF 토글, 로컬 AI/Claude API/OpenAI API 선택 옵션
  - **지원 형식**: TXT, CSV, Excel, PDF
  - **파일**:
    - `src/lib/local-llm.ts` - 로컬 LLM 파싱 라이브러리
    - `src/lib/llm.ts` - Claude API 파싱 라이브러리
    - `src/pages/real-estate/PropertyRegister.tsx` - 스마트 파싱 UI
- **2026-03-04**: 정규 매물 목록 전체 삭제 프로그래스 바 구현
  - **문제**: 전체 삭제 시 진행 상태를 알 수 없어 사용자 경험 불편
  - **해결**: 배치 처리(10개씩 병렬) + 실시간 진행률 모달
  - **파일**: `src/pages/real-estate/ApartmentRegularPropertyList.tsx`
    - 상태: `isDeletingAll`, `deleteProgress` 추가
    - UI: 백드롭 오버레이 + 프로그래스 바 + 퍼센트 표시
- **2026-03-04**: 설정 페이지 데이터 관리 섹션 추가
  - **기능**: 프로필 삭제, 캘린더 데이터 삭제
  - **파일**: `src/pages/Settings.tsx`
    - `DataManagementSection` 컴포넌트 추가
    - 프로필 삭제: 계정 정보 영구 삭제, 삭제 후 로그아웃
    - 캘린더 삭제: 모든 일정/이벤트 데이터 영구 삭제
    - 경고 안내, 확인 다이얼로그, 삭제 진행 상태 표시

---

## 새로 추가된 라이브러리
| 라이브러리 | 버전 | 용도 |
|----------|------|------|
| papaparse | 최신 | 안정적 CSV 파싱 (따옴표, 콤마 처리) |
| @xenova/transformers | 최신 | 브라우저 내장 LLM (로컬 AI) |
| pdfjs-dist | 최신 | PDF 텍스트 추출 |

---

## 스마트 파싱 사용법
1. 파일 업로드 (CSV/Excel/PDF/TXT)
2. "스마트 파싱 ON" 클릭
3. "로컬 AI (무료)" 선택
4. 파싱 버튼 클릭
5. 매물 정보 자동 추출 및 확인
6. 선택 후 저장

**특징**:
- 로컬 AI: 오프라인, 빠름, 무료
- Claude/OpenAI API: 더 정확한 추론 (API 키 필요)

---

## 최종 분석 일지 (계속)
- **2026-03-04**: 대시보드 재작성 완료
  - **요구사항**: 매물관리.md에 명시된 대시보드 기능 구현
  - **구현 내용**:
    - StatCard 3개: 총 매물수, 총 관심 매물수, 총 관리 매물수
    - 최근 10일 등록 매물 목록 표시
    - 최근 10일 등록 관심 매물 목록 표시
    - 최근 10일 등록 관리 매물 목록 표시
    - 최근 30일 계약 매물 목록 표시
    - 오늘의 일정 표시 (TodayScheduleCard 컴포넌트)
    - 빠른 링크 섹션 추가
  - **API 엔드포인트 추가**:
    - `GET /api/dashboard/summary` - 대시보드 요약
    - `GET /api/dashboard/recent-properties` - 최근 매물
    - `GET /api/dashboard/recent-favorites` - 최근 관심매물
    - `GET /api/dashboard/recent-managed` - 최근 관리매물
    - `GET /api/dashboard/recent-contracts` - 최근 계약매물
  - **파일**: `src/pages/dashboard/Dashboard.tsx`, `src/server/index.ts`

- **2026-03-04**: 일정(Schedule) 기능 추가 완료
  - **DB 모델**: Schedule 모델 추가 (prisma/schema.prisma)
    - id, userId, title, description, startTime, endTime, type, location, isAllDay, reminderMinutes
  - **API 엔드포인트 추가**:
    - `GET /api/schedules` - 일정 목록 조회 (startDate, endDate 필터)
    - `GET /api/schedules/today` - 오늘의 일정 조회
    - `POST /api/schedules` - 일정 생성
    - `PUT /api/schedules/:id` - 일정 수정
    - `DELETE /api/schedules/:id` - 일정 삭제
  - **캘린더 페이지 개선**:
    - date-fns 라이브러리 활용 동적 달력 생성
    - 날짜 클릭 시 해당 날짜 일정 표시
    - 일정 생성/수정/삭제 모달
    - 일정 유형별 색상 구분 (meeting, task, event, break, default)
  - **파일**: `src/pages/Calendar.tsx`, `prisma/schema.prisma`, `src/server/index.ts`

- **2026-03-04**: 스마트 고급 캘린더 구현 완료
  - **다중 뷰 전환**: 월간/주간/일간/리스트 뷰
  - **AI 스마트 일정 분류**: 제목/설명 자동 분석으로 유형과 우선순위 추천
  - **일정 충돌 감지**: 시간이 겹치는 일정 자동 감지 및 경고
  - **반복 일정**: 매일/매주/매월/매년 반복 설정 지원
  - **드래그 & 드롭**: 일정 드래그로 날짜 변경
  - **키보드 단축키**: N(새 일정), T(오늘), M/W/D/L(뷰 전환), ←→(이전/다음)
  - **DB 스키마 확장**:
    - isRecurring, recurrenceRule, recurrenceEnd (반복 일정)
    - color, priority, attendees, status (추가 정보)
  - **빠른 통계 카드**: 이번 달/오늘/반복/회의 일정 수 표시
  - **파일**: `src/pages/Calendar.tsx`, `prisma/schema.prisma`
  - **라이브러리 추가**: framer-motion, react-hotkeys-hook

- **2026-03-05**: 사용자별 데이터 분리 구현 완료
  - **요구사항**: Property 테이블에 userId가 없어 모든 매물이 공용으로 저장됨 → 사용자별 분리 필요
  - **DB 스키마**: Property 모델에 userId 필드 추가 (이미 존재, 인덱스 포함)
  - **JWT 인증 API 구현** (`src/server/auth.ts`):
    - `POST /api/auth/register` - 회원가입 (비밀번호 bcrypt 해시)
    - `POST /api/auth/login` - 로그인 (JWT 토큰 발급, 7일 유효)
    - `GET /api/auth/me` - 현재 사용자 정보
    - getUserIdFromRequest 함수 - Authorization 헤더에서 userId 추출
  - **매물 API 사용자 필터링**:
    - `GET /api/properties` - 로그인 시 본인 매물만, 비로그인 시 공용 매물(userId=null)만
    - `POST /api/properties` - userId 자동 저장
    - `POST /api/properties/bulk` - userId 자동 저장
    - `PUT /api/properties/:articleNo` - 소유자 확인 후 수정 (403 에러)
    - `DELETE /api/properties/:articleNo` - 소유자 확인 후 삭제 (403 에러)
  - **프론트엔드**: authStore에 authFetch 함수 추가 (Authorization 헤더 자동 추가)
  - **테스트 완료**: 회원가입 → 로그인 → 매물 등록(userId 저장 확인) → 매물 조회(필터링 확인)
  - **파일**: `src/server/auth.ts`, `src/stores/authStore.ts`, `src/server/index.ts`

- **2026-03-05**: 로그인 오류 해결 완료
  - **문제 1**: src/server/index.ts에 중복된 auth 엔드포인트 정의
    - Line 15: `app.route('/api/auth', authRouter)` - auth.ts 라우터 연결
    - Line 2247-2442: /api/auth/register, /api/auth/login, /api/auth/me 등 다시 정의
    - **해결**: 중복 코드 제거 (auth.ts만 사용)
  - **문제 2**: DATABASE_URL 환경 변수 누락
    - Railway PostgreSQL은 `postgres.railway.internal` (내부 네트워크 전용)
    - 로컬에서 접근 불가 → 서버 시작 실패
    - **해결**: 로컬 PostgreSQL 사용 (brew postgresql@16)
  - **문제 3**: Railway PostgreSQL 공개 도메인 없음
    - Railway PostgreSQL의 `serviceDomains: []` - 공개 접속 불가
    - Railway proxy나 터널링 필요하지만 사용자가 원하지 않음
    - **해결**: 로컬 개발용 DB와 Railway 배포용 DB 분리
  - **최종 해결책**:
    - 로컬: `postgresql://woosungjo@localhost:5432/imapplepie`
    - Railway 배포: Railway 내부 PostgreSQL 사용
    - .env.development에 로컬 DB 설정
    - brew services start postgresql@16로 로컬 DB 시작
    - `npx prisma db push`로 스키마 동기화
  - **테스트 완료**:
    - 회원가입: `POST /api/auth/register` → ✅ success
    - 로그인: `POST /api/auth/login` → ✅ success
  - **파일**: `src/server/index.ts`, `src/server/auth.ts`, `.env.development`
