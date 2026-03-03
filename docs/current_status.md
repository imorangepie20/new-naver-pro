# 프로젝트 현황 기록

> 최종 업데이트: 2026-03-04 (관리매물 UI 개선 완료)

---

## 최근 활동

### 2026-03-04: 관리매물 리스트 UI 개선 완료 ✅
- 숫자 입력 스피너 제거 (계약금/중도금/잔금 필드)
- 커서 포커스 이슈 해결 (useMemo 제거, 인라인 입력 사용)
- "재계약 알림 필터" → "계약사항알림" 텍스트로 변경
- 반응형 UI 구현 (데스크톱: 테이블, 모바일: 카드)
- 건물명 필드 삭제
- 메모 필드 삭제 (화면 표시에서만)
- 상태 필터 삭제 (전체/활성/만료/갱신)

### 2026-03-03: 업로드한 매물 목록 수정 기능 완료
- 관리 컬럼에 수정 버튼 (연필 아이콘) 추가
- 매물 수정 모달 UI 구현 (기본정보, 가격정보, 상세정보, 담당자정보, 매물특징)
- PUT /api/properties/:id API 연동
- 관리 컬럼 너비 확장 (60px → 100px, 4개 버튼 수용)

### 2026-03-03: 매물목록 → 관심매물/관리매물 등록 로직 시뮬레이션

#### 목적
- 업로드한 매물 목록(UploadedPropertyList)에서 개별 매물을 관심매물 또는 관리매물로 등록하는 기능 설계
- 네이버 데이터와 독립적인 매물 관리 로직

#### 대상 페이지
- **파일**: `src/pages/real-estate/UploadedPropertyList.tsx`
- **경로**: `/real-estate/uploaded` (매물목록)
- **데이터 소스**: `dataSource=UPLOAD` (파일 업로드/수동 입력)

#### 시뮬레이션 내용

**1. 관심매물 등록 (❤️ 버튼)**
- 데이터 변환: `UploadedArticle` → `FavoriteProperty`
- API: `POST /api/favorite-properties`
- 즉시 등록 (모달 없음)
- 담당자 정보를 메모에 자동 포함

**2. 관리매물 등록 (📋 버튼)**
- 데이터 변환: `UploadedArticle` → `ManagedProperty`
- API: `POST /api/managed-properties`
- 모달 표시 후 추가 정보 입력 (세입자, 납부일정 등)
- 계약 만료일 자동 계산 (매매: 3개월, 전세/월세: 2년)

#### UI 변경 사항
```tsx
// 관리 컬럼에 버튼 추가
<td className="px-3 py-2 text-center">
  <div className="flex items-center justify-center gap-1">
    <Button onClick={() => deleteItem(article.id)}><Trash2 /></Button>
    <button onClick={() => addToFavorite(article)}><Heart /></button>
    <button onClick={() => addToManaged(article)}><ClipboardList /></button>
  </div>
</td>
```

#### 데이터 매핑
| UploadedArticle | → | FavoriteProperty | ManagedProperty |
|-----------------|---|------------------|----------------|
| articleName | → | articleName | articleName |
| buildingName | → | buildingName | buildingName |
| detailAddress | → | address | address |
| realEstateTypeName | → | propertyType | - |
| tradeTypeName | → | tradeType | contractType |
| dealOrWarrantPrc | → | price | totalPrice/ depositAmount |
| area1 | → | area | - |
| managerName | → | notes | managerName |
| managerPhone | → | notes | managerPhone |

---

## 진행 중인 작업

- 없음 (모든 작업 완료)

---

## 구현된 기능

### 매물 관리
- 매물 등록 (파일 업로드: TXT, CSV, Excel)
- 업로드한 매물 목록 조회
- 정규 매물 목록 조회
- 매물 삭제 (개별/선택/전체)
- 엑셀 내보내기 (필드 선택 가능)

### 관심매물 (FavoriteProperty)
- CRUD 완료
- 독립 테이블 (네이버 데이터 무관)
- 파일: `src/pages/real-estate/FavoritePropertyList.tsx`

### 관리매물 (ManagedProperty)
- CRUD 완료
- 계약 관리 (계약금/중도금/잔금)
- 재계약 알림 (D-day 카운트다운)
- 독립 테이블 (네이버 데이터 무관)
- 파일: `src/pages/real-estate/ManagedPropertyList.tsx`

---

## API 엔드포인트

### 관심매물
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/favorite-properties | 목록 조회 |
| POST | /api/favorite-properties | 등록 |
| PUT | /api/favorite-properties/:id | 수정 |
| DELETE | /api/favorite-properties/:id | 삭제 |

### 관리매물
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/managed-properties | 목록 조회 |
| POST | /api/managed-properties | 등록 |
| PUT | /api/managed-properties/:id | 수정 |
| DELETE | /api/managed-properties/:id | 삭제 |

### 매물 (중앙 DB)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/properties?dataSource=UPLOAD | 업로드 매물 조회 |
| POST | /api/properties/bulk | 일괄 등록 |
| DELETE | /api/properties/:id | 삭제 |

-----------------------------------------
** 전체 매물 필드 **
매물명 거래타입 매물유형 매매가/보증금(만원) 월세(만원)
공급면적(㎡) 전용면적(㎡) 층수 방향 확정일 건물명 주소 매물설명
태그 중개업소 중개사
책임자명 책임자전화번호
-----------------------------------------


## 다음 작업 예정

1. UploadedPropertyList에 관심매물/관리매물 등록 버튼 추가
2. 관심매물 등록 함수 구현
3. 관리매물 등록 모달 구현
4. 기능 테스트
