// ============================================
// 네이버 부동산 API 타입 정의
// ============================================

export type RealEstateTypeCode =
  | 'APT'        // 아파트
  | 'OPST'       // 오피스텔
  | 'VL'         // 빌라/연립
  | 'DDDGG'      // 단독/다가구
  | 'JWJT'       // 전원주택
  | 'SGJT'       // 상가주택
  | 'ONEROOM'    // 원룸
  | 'TWOROOM'    // 투룸
  | 'SG'         // 상가
  | 'SMS'        // 사무실
  | 'GJCG'       // 공장/창고
  | 'APTHGJ'     // 지식산업센터
  | 'GM'         // 건물
  | 'TJ'         // 토지
  | 'OR'         // 원룸 (용달)
  | 'ABYG'       // 도시형생활주택(아파트형)
  | 'OBYG'       // 도시형생활주택(오피스텔형)
  | 'PRE'        // 분양권
  | 'YR'         // 요양병원
  | 'DSD';       // 다세대

export type TradeTypeCode =
  | 'A1'         // 매매
  | 'B1'         // 전세
  | 'B2'         // 월세
  | 'B3';        // 단기임대

export type CortarType =
  | 'city'       // 시/도
  | 'dvsn'       // 시/군/구
  | 'dongs';     // 읍/면/동

// ============================================
// 지역 관련 타입
// ============================================

export interface Region {
  cortarNo: string;
  cortarName: string;
  cortarType: CortarType;
  centerLat: number;
  centerLon: number;
}

export interface RegionListResponse {
  regionList: Region[];
}

// ============================================
// 단지 관련 타입 (아파트/오피스텔)
// ============================================

export interface ComplexMarker {
  markerId: string;
  markerType: 'COMPLEX';
  latitude: number;
  longitude: number;
  complexName: string;
  realEstateTypeCode: 'APT' | 'OPST';
  realEstateTypeName: string;
  completionYearMonth: string;        // YYYYMM
  totalDongCount: number;
  totalHouseholdCount: number;
  floorAreaRatio: number;
  minArea: string;                    // "104.66"
  maxArea: string;
  priceCount: number;
  representativeArea: number;
  isPresales: boolean;
  photoCount: number;
  dealCount: number;
  leaseCount: number;
  rentCount: number;
  shortTermRentCount: number;
  totalArticleCount: number;
  existPriceTab: boolean;
  isComplexTourExist: boolean;
}

export interface ComplexListResponse {
  complexMarkerList?: ComplexMarker[];
  [key: string]: any;
}

// ============================================
// 매물 관련 타입
// ============================================

export interface Article {
  // 기본 정보
  articleNo: string;
  articleName: string;
  articleStatus: string;              // R0: 정상
  realEstateTypeCode: RealEstateTypeCode;
  realEstateTypeName: string;
  articleRealEstateTypeCode: string;  // C01, C02, C03, D01, D02...
  articleRealEstateTypeName: string;

  // 거래 정보
  tradeTypeCode: TradeTypeCode;
  tradeTypeName: string;
  verificationTypeCode: string;       // OWNER, DOC
  floorInfo: string;                  // "3/5", "B1/3"
  priceChangeState: string;           // SAME, UP, DOWN
  isPriceModification: boolean;

  // 가격 (만원 단위, 문자열 또는 숫자)
  dealOrWarrantPrc: string | number;   // 매매가/보증금 "7,500" 또는 750000000
  rentPrc?: string | number;         // 월세 "43" 또는 43

  // 면적 (㎡)
  area1: number;                      // 공급면적
  area2?: number;                     // 전용면적

  // 상세 정보
  direction?: string;                 // 방향
  articleConfirmYmd: string;          // 확정일 YYYYMMDD
  articleFeatureDesc?: string;        // 매물 설명
  buildingName?: string;              // 건물명
  tagList: string[];                  // ["역세권", "새아파트"]

  // 위치
  cortarNo?: string;                  // 지역 코드
  latitude: string | number;
  longitude: string | number;
  isLocationShow: boolean;
  detailAddress: string;
  detailAddressYn: string;            // Y, N
  virtualAddressYn: string;           // Y, N

  // 중개사 정보
  cpid?: string;                      // 중개업소 ID
  cpName?: string;                    // 중개업소명
  cpPcArticleUrl?: string;            // PC 매물 URL
  cpMobileArticleUrl?: string;        // 모바일 매물 URL
  cpPcArticleBridgeUrl?: string;
  cpPcArticleLinkUseAtArticleTitleYn: boolean;
  cpPcArticleLinkUseAtCpNameYn: boolean;
  realtorName?: string;               // 중개사명
  realtorId?: string;                 // 중개사 ID

  // 추가 정보
  siteImageCount: number;
  isPresale: boolean;
  isComplex: boolean;
  isVrExposed: boolean;
  isSafeLessorOfHug: boolean;
  tradeCheckedByOwner: boolean;
  isDirectTrade: boolean;
  isInterest: boolean;

  // 같은 주소 매물
  sameAddrCnt: number;
  sameAddrDirectCnt: number;
  sameAddrMaxPrc: string;
  sameAddrMinPrc: string;
}

export interface ArticleListResponse {
  articleList: Article[];
  isMoreData: boolean;
  [key: string]: any;
}

// ============================================
// API 요청 파라미터 타입
// ============================================

export interface ComplexListParams {
  cortarNo: string;
  zoom?: number;
  priceType?: string;                 // RETAIL
  realEstateType?: 'APT' | 'OPST';
  tradeType?: TradeTypeCode;
  tag?: string;                       // ":::" (태그 필터)
  rentPriceMin?: number;
  rentPriceMax?: number;
  priceMin?: number;
  priceMax?: number;
  areaMin?: number;
  areaMax?: number;
  oldBuildYears?: string;
  recentlyBuildYears?: string;
  minHouseHoldCount?: number;
  maxHouseHoldCount?: number;
  showArticle?: boolean;
  sameAddressGroup?: boolean;
  minMaintenanceCost?: number;
  maxMaintenanceCost?: number;
  directions?: string;
  leftLon?: number;
  rightLon?: number;
  topLat?: number;
  bottomLat?: number;
  isPresale?: boolean;
  // 추가 필드 (네이버 API 파라미터)
  markerId?: string;
  markerType?: string;
  selectedComplexNo?: string;
  selectedComplexBuildingNo?: string;
  fakeComplexMarker?: boolean;
}

export interface ArticleListParams {
  cortarNo: string;
  order?: string;                     // rank, prcDesc, prcAsc, areaDesc, areaAsc
  realEstateType?: string;            // 콜론 구분 (URL 인코딩 필요)
  tradeType?: string;                 // 콜론 구분 A1:B1:B2
  tag?: string;                       // ":::" + 추가 태그
  rentPriceMin?: number;
  rentPriceMax?: number;
  priceMin?: number;
  priceMax?: number;
  areaMin?: number;
  areaMax?: number;
  oldBuildYears?: string;
  recentlyBuildYears?: string;
  minHouseHoldCount?: number;
  maxHouseHoldCount?: number;
  showArticle?: boolean;
  sameAddressGroup?: boolean;
  minMaintenanceCost?: number;
  maxMaintenanceCost?: number;
  priceType?: string;                 // RETAIL
  directions?: string;
  page?: number;
  articleState?: string;
}

// ============================================
// 매물타입별 카테고리
// ============================================

export const PROPERTY_CATEGORIES = {
  APT_OPST: {
    code: ['APT', 'OPST'] as RealEstateTypeCode[],
    name: '아파트·오피스텔',
    subTypes: [
      { code: 'APT', name: '아파트' },
      { code: 'OPST', name: '오피스텔' },
    ],
  },
  Villa_House: {
    code: ['VL', 'DDDGG', 'JWJT', 'SGJT'] as RealEstateTypeCode[],
    name: '빌라·주택',
    subTypes: [
      { code: 'VL', name: '빌라/연립' },
      { code: 'DDDGG', name: '단독/다가구' },
      { code: 'JWJT', name: '전원주택' },
      { code: 'SGJT', name: '상가주택' },
    ],
  },
  ONETWO_ROOM: {
    code: ['ONEROOM', 'TWOROOM'] as RealEstateTypeCode[],
    name: '원룸·투룸',
    subTypes: [
      { code: 'ONEROOM', name: '원룸' },
      { code: 'TWOROOM', name: '투룸' },
    ],
  },
  COMMERCIAL: {
    code: ['SG', 'SMS', 'GJCG', 'APTHGJ', 'GM', 'TJ'] as RealEstateTypeCode[],
    name: '상가·업무·공장·토지',
    subTypes: [
      { code: 'SG', name: '상가' },
      { code: 'SMS', name: '사무실' },
      { code: 'GJCG', name: '공장/창고' },
      { code: 'APTHGJ', name: '지식산업센터' },
      { code: 'GM', name: '건물' },
      { code: 'TJ', name: '토지' },
    ],
  },
} as const;

export const TRADE_TYPES = [
  { code: 'A1' as TradeTypeCode, name: '매매' },
  { code: 'B1' as TradeTypeCode, name: '전세' },
  { code: 'B2' as TradeTypeCode, name: '월세' },
  { code: 'B3' as TradeTypeCode, name: '단기임대' },
] as const;

// ============================================
// 필터 타입
// ============================================

export interface PropertyFilter {
  cortarNo?: string;
  cortarName?: string;
  realEstateTypes: RealEstateTypeCode[];
  tradeTypes: TradeTypeCode[];
  priceMin?: number;
  priceMax?: number;
  rentPriceMin?: number;
  rentPriceMax?: number;
  areaMin?: number;
  areaMax?: number;
  page?: number;
}

export interface PropertySortOption {
  value: 'rank' | 'prcDesc' | 'prcAsc' | 'areaDesc' | 'areaAsc';
  label: string;
}

export const SORT_OPTIONS: PropertySortOption[] = [
  { value: 'rank', label: '정확도순' },
  { value: 'prcDesc', label: '높은 가격순' },
  { value: 'prcAsc', label: '낮은 가격순' },
  { value: 'areaDesc', label: '넓은 면적순' },
  { value: 'areaAsc', label: '좁은 면적순' },
];
