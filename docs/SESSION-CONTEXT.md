# 세션 컨텍스트 기록

> 최종 업데이트: 2026-03-04 (관리매물 UI 개선 완료)

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
| 항목 | 값 |
|------|-----|
| Host | localhost |
| Port | 5432 |
| Database | naver_land |
| User | root |
| Password | password |
| Prisma Studio | http://localhost:5555 |

---

## DB 스키마 구조 (14개 모델)

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
- **Property**: 매물 상세 정보 (네이버 크롤링 + 수동 입력)
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
