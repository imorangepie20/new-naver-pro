// ============================================
// 네이버 부동산 API 클라이언트
// 비공식 API 호출을 위한 HTTP 클라이언트
// ============================================

import axios, { AxiosInstance } from 'axios';
import tokenManager from './token-manager';
import type {
  ComplexListParams,
  ComplexListResponse,
  ArticleListParams,
  ArticleListResponse,
  RealEstateTypeCode,
  TradeTypeCode,
} from '../../types/naver-land';

const BASE_URL = 'https://new.land.naver.com/api';

export class NaverLandClient {
  private client: AxiosInstance;
  private tokenData: { token: string; cookies?: string } | null = null;
  private referrerMap: Map<string, string> = new Map();

  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 30000,
      headers: {
        'Accept': '*/*',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'Priority': 'u=0',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        // Client Hints - 뷰포트 크기 설정 (1920x1080 기준)
        'Sec-CH-UA': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        'Sec-CH-UA-Mobile': '?0',
        'Sec-CH-UA-Platform': '"macOS"',
        'Sec-CH-UA-Platform-Version': '"10_15_7"',
        'Sec-CH-UA-Width': '3840',
        'Sec-CH-UA-Height': '2160',
      },
    });

    // Referrer 설정 (API 호출 시 필요)
    this.referrerMap.set('/regions/list', 'https://new.land.naver.com/complexes?ms=37.3602697,127.1315452,15&a=APT:OPST:PRE&e=RETAIL');
    this.referrerMap.set('/complexes/single-markers/2.0', 'https://new.land.naver.com/complexes?ms=37.267617,127.005088,16&a=OPST&b=A1&e=RETAIL');
    this.referrerMap.set('/articles', 'https://new.land.naver.com/houses?ms=37.2718,127.0135,16&a=VL&e=RETAIL');
    // 단지별 매물 조회용 referrer (동적 생성됨)
  }

  /**
   * 단지별 매물 조회용 referrer 생성
   */
  private getComplexReferrer(complexNo: string, realEstateType: string): string {
    return `https://new.land.naver.com/complexes/${complexNo}?ms=37.4800134,127.0475872,16&a=${realEstateType}&e=RETAIL`;
  }

  /**
   * 요청 헤더에 referrer 설정
   */
  private getReferrer(endpoint: string): string {
    return this.referrerMap.get(endpoint) || 'https://new.land.naver.com/';
  }

  /**
   * 유효한 토큰으로 헤더 설정
   */
  private async setAuthHeader(): Promise<void> {
    if (!this.tokenData) {
      this.tokenData = await tokenManager.getToken();
    }
    this.client.defaults.headers.common['authorization'] = `Bearer ${this.tokenData.token}`;
    if (this.tokenData.cookies) {
      this.client.defaults.headers.common['Cookie'] = this.tokenData.cookies;
    }
  }

  /**
   * 지역 목록 조회
   * @param cortarNo 지역 코드 (0000000000: 최상위)
   */
  async getRegionList(cortarNo: string = '0000000000') {
    await this.setAuthHeader();

    const response = await this.client.get('/regions/list', {
      params: { cortarNo },
      headers: {
        'Referer': this.getReferrer('/regions/list'),
      },
    });

    return response.data;
  }

  /**
   * 단지 마커 목록 조회 (아파트/오피스텔)
   *
   * @param params 조회 파라미터
   */
  async getComplexMarkers(params: ComplexListParams): Promise<ComplexListResponse> {
    await this.setAuthHeader();

    // 빈 문자열 파라미터들도 모두 전달해야 429 방지
    const queryParams: Record<string, any> = {
      cortarNo: params.cortarNo,
      zoom: params.zoom ?? 16,
      priceType: params.priceType ?? 'RETAIL',
      realEstateType: params.realEstateType ?? 'APT',
      tradeType: params.tradeType ?? 'A1',
      tag: params.tag ?? '::'.repeat(4), // ::::::::
      rentPriceMin: params.rentPriceMin ?? 0,
      rentPriceMax: params.rentPriceMax ?? 900000000,
      priceMin: params.priceMin ?? 0,
      priceMax: params.priceMax ?? 900000000,
      areaMin: params.areaMin ?? 0,
      areaMax: params.areaMax ?? 900000000,
      oldBuildYears: params.oldBuildYears ?? '',
      recentlyBuildYears: params.recentlyBuildYears ?? '',
      minHouseHoldCount: params.minHouseHoldCount ?? '',
      maxHouseHoldCount: params.maxHouseHoldCount ?? '',
      showArticle: params.showArticle ?? false,
      sameAddressGroup: params.sameAddressGroup ?? false,
      minMaintenanceCost: params.minMaintenanceCost ?? '',
      maxMaintenanceCost: params.maxMaintenanceCost ?? '',
      directions: params.directions ?? '',
      isPresale: params.isPresale ?? false,
    };

    // 선택적 파라미터 추가
    if (params.markerId !== undefined) queryParams.markerId = params.markerId;
    if (params.markerType !== undefined) queryParams.markerType = params.markerType;
    if (params.selectedComplexNo !== undefined) queryParams.selectedComplexNo = params.selectedComplexNo;
    if (params.selectedComplexBuildingNo !== undefined) queryParams.selectedComplexBuildingNo = params.selectedComplexBuildingNo;
    if (params.fakeComplexMarker !== undefined) queryParams.fakeComplexMarker = params.fakeComplexMarker;
    if (params.leftLon !== undefined) queryParams.leftLon = params.leftLon;
    if (params.rightLon !== undefined) queryParams.rightLon = params.rightLon;
    if (params.topLat !== undefined) queryParams.topLat = params.topLat;
    if (params.bottomLat !== undefined) queryParams.bottomLat = params.bottomLat;

    const response = await this.client.get('/complexes/single-markers/2.0', {
      params: queryParams,
      headers: {
        'Referer': this.getReferrer('/complexes/single-markers/2.0'),
      },
    });

    return response.data;
  }

  /**
   * 단지별 매물 목록 조회
   * 네이버 부동산 단지 상세 페이지에서 호출하는 API
   *
   * @param complexNo 단지 번호
   * @param params 조회 파라미터
   */
  async getComplexArticles(
    complexNo: string,
    params: {
      realEstateType?: string;          // APT:PRE, APT:OPST 등
      tradeType?: string;               // A1, B1, B2 등
      page?: number;                    // 페이지 번호
      order?: string;                   // 정렬 (rank, prcDesc, prcAsc 등)
      priceType?: string;               // RETAIL
      tag?: string;                     // :::::::: (8개 쌍점)
      rentPriceMin?: number;
      rentPriceMax?: number;
      priceMin?: number;
      priceMax?: number;
      areaMin?: number;
      areaMax?: number;
      oldBuildYears?: string;
      recentlyBuildYears?: string;
      minHouseHoldCount?: string;
      maxHouseHoldCount?: string;
      showArticle?: boolean;
      sameAddressGroup?: boolean;
      minMaintenanceCost?: string;
      maxMaintenanceCost?: string;
      directions?: string;
      buildingNos?: string;             // 동 번호
      areaNos?: string;                 // 면적 번호
      type?: string;                    // list
    }
  ): Promise<ArticleListResponse> {
    await this.setAuthHeader();

    // 빈 문자열 파라미터들도 모두 전달해야 429 방지
    const queryParams: Record<string, any> = {
      realEstateType: params.realEstateType ?? 'APT:PRE',
      tradeType: params.tradeType ?? '',
      tag: params.tag ?? '::'.repeat(4), // ::::::::
      rentPriceMin: params.rentPriceMin ?? 0,
      rentPriceMax: params.rentPriceMax ?? 900000000,
      priceMin: params.priceMin ?? 0,
      priceMax: params.priceMax ?? 900000000,
      areaMin: params.areaMin ?? 0,
      areaMax: params.areaMax ?? 900000000,
      oldBuildYears: params.oldBuildYears ?? '',
      recentlyBuildYears: params.recentlyBuildYears ?? '',
      minHouseHoldCount: params.minHouseHoldCount ?? '',
      maxHouseHoldCount: params.maxHouseHoldCount ?? '',
      showArticle: params.showArticle ?? false,
      sameAddressGroup: params.sameAddressGroup ?? false,
      minMaintenanceCost: params.minMaintenanceCost ?? '',
      maxMaintenanceCost: params.maxMaintenanceCost ?? '',
      priceType: params.priceType ?? 'RETAIL',
      directions: params.directions ?? '',
      page: params.page ?? 1,
      complexNo: complexNo,
      buildingNos: params.buildingNos ?? '',
      areaNos: params.areaNos ?? '',
      type: params.type ?? 'list',
      order: params.order ?? 'rank',
    };

    const realEstateType = params.realEstateType ?? 'APT:PRE';

    const response = await this.client.get(`/articles/complex/${complexNo}`, {
      params: queryParams,
      headers: {
        'Referer': this.getComplexReferrer(complexNo, realEstateType),
      },
    });

    return response.data;
  }

  /**
   * 매물 목록 조회 (빌라/원룸/상가 등)
   *
   * @param params 조회 파라미터
   */
  async getArticles(params: ArticleListParams & { markerId?: string }): Promise<ArticleListResponse> {
    await this.setAuthHeader();

    // 빈 문자열 파라미터들도 모두 전달해야 429 방지
    const queryParams: Record<string, any> = {
      cortarNo: params.cortarNo,
      order: params.order ?? 'rank',
      realEstateType: params.realEstateType ?? '',
      tradeType: params.tradeType ?? '',
      tag: params.tag ?? '::'.repeat(4), // ::::::::
      rentPriceMin: params.rentPriceMin ?? 0,
      rentPriceMax: params.rentPriceMax ?? 900000000,
      priceMin: params.priceMin ?? 0,
      priceMax: params.priceMax ?? 900000000,
      areaMin: params.areaMin ?? 0,
      areaMax: params.areaMax ?? 900000000,
      oldBuildYears: params.oldBuildYears ?? '',
      recentlyBuildYears: params.recentlyBuildYears ?? '',
      minHouseHoldCount: params.minHouseHoldCount ?? '',
      maxHouseHoldCount: params.maxHouseHoldCount ?? '',
      showArticle: params.showArticle ?? false,
      sameAddressGroup: params.sameAddressGroup ?? false,
      minMaintenanceCost: params.minMaintenanceCost ?? '',
      maxMaintenanceCost: params.maxMaintenanceCost ?? '',
      priceType: params.priceType ?? 'RETAIL',
      directions: params.directions ?? '',
      page: params.page ?? 1,
      articleState: params.articleState ?? '',
    };

    // markerId가 있으면 특정 단지의 매물만 가져오기
    if (params.markerId) {
      queryParams.markerId = params.markerId;
    }

    // 매물타입에 따른 Referer 설정
    let referrer = this.getReferrer('/articles');
    if (params.realEstateType) {
      if (params.realEstateType.includes('TJ') || params.realEstateType.includes('SMS')) {
        referrer = 'https://new.land.naver.com/offices?ms=37.2718,127.0135,16&a=TJ:SMS&e=RETAIL';
      } else if (params.realEstateType.includes('ONEROOM')) {
        referrer = 'https://new.land.naver.com/rooms?ms=37.2718,127.0135,16&a=APT:OPST:ABYG:OBYG:GM:OR:DDDGG:JWJT:SGJT:VL&e=RETAIL&aa=SMALLSPCRENT';
      } else if (params.realEstateType.includes('VL')) {
        referrer = 'https://new.land.naver.com/houses?ms=37.2718,127.0135,16&a=VL&e=RETAIL';
      }
    }

    const response = await this.client.get('/articles', {
      params: queryParams,
      headers: {
        'Referer': referrer,
      },
    });

    return response.data;
  }

  /**
   * 단지 상세 정보 조회 (cortarAddress, roadAddress, detailAddress 포함)
   * 두 가지 API를 병렬 호출:
   *  1. initial=Y → complex 객체에 cortarAddress 포함
   *  2. sameAddressGroup=false → complexDetail 객체에 roadAddress, detailAddress 포함
   * @param complexNo 단지 번호
   */
  async getComplexDetail(complexNo: string): Promise<any> {
    await this.setAuthHeader();

    const referer = `https://new.land.naver.com/complexes/${complexNo}`;

    // 두 API를 병렬로 호출
    const [initialResponse, detailResponse] = await Promise.all([
      this.client.get(`/complexes/${complexNo}`, {
        params: { complexNo, initial: 'Y' },
        headers: { 'Referer': referer },
      }).catch(() => null),
      this.client.get(`/complexes/${complexNo}`, {
        params: { sameAddressGroup: false },
        headers: { 'Referer': referer },
      }).catch(() => null),
    ]);

    // 두 응답을 합침
    const result: any = {};

    // initial=Y 응답에서 complex 객체 (cortarAddress 포함)
    if (initialResponse?.data?.complex) {
      result.complex = initialResponse.data.complex;
    } else if (initialResponse?.data) {
      // 응답 자체가 complex 객체일 수 있음
      result.complex = initialResponse.data;
    }

    // sameAddressGroup=false 응답에서 complexDetail 객체 (roadAddress, detailAddress 포함)
    if (detailResponse?.data?.complexDetail) {
      result.complexDetail = detailResponse.data.complexDetail;
    } else if (detailResponse?.data) {
      result.complexDetail = detailResponse.data;
    }

    console.log(`[getComplexDetail] ${complexNo}: cortarAddress=${result.complex?.cortarAddress}, roadAddress=${result.complexDetail?.roadAddress}`);

    return result;
  }

  /**
   * 매물타입 코드들을 콜론 구분 문자열로 변환 (URL 인코딩용)
   * @param types 매물타입 코드 배열
   */
  static encodeRealEstateTypes(types: RealEstateTypeCode[]): string {
    return types.join(':');
  }

  /**
   * 거래방식 코드들을 콜론 구분 문자열로 변환
   * @param types 거래방식 코드 배열
   */
  static encodeTradeTypes(types: TradeTypeCode[]): string {
    return types.join(':');
  }

  /**
   * 가격 문자열을 숫자로 변환 (만원 단위)
   * "7,500" → 7500000 (원)
   * @param priceStr 가격 문자열
   */
  static parsePrice(priceStr: string): number {
    const parsed = parseInt(priceStr.replace(/,/g, ''), 10);
    return isNaN(parsed) ? 0 : parsed * 10000;
  }

  /**
   * 가격을 포맷팅
   * 7500000 → "7억 5,000만"
   * @param price 가격 (원)
   */
  static formatPrice(price: number): string {
    const ok = Math.floor(price / 100000000);
    const man = Math.floor((price % 100000000) / 10000);

    const parts: string[] = [];
    if (ok > 0) parts.push(`${ok}억`);
    if (man > 0) parts.push(`${man.toLocaleString()}만`);

    return parts.join(' ') || '0';
  }
}

// 싱글톤 인스턴스
const naverLandClient = new NaverLandClient();

export default naverLandClient;
