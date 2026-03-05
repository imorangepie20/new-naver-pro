// ============================================
// LLM API 호출 (Claude/OpenAI)
// ============================================

export interface LLMConfig {
  provider: 'claude' | 'openai';
  apiKey: string;
  model?: string;
}

export interface ParsedProperty {
  articleName: string;
  realEstateTypeCode: string;
  realEstateTypeName: string;
  tradeTypeCode: string;
  tradeTypeName: string;
  dealOrWarrantPrc: number | null;
  rentPrc: number | null;
  area1: number | null;
  area2: number | null;
  floorInfo: string | null;
  direction: string | null;
  buildingName: string | null;
  detailAddress: string | null;
  articleFeatureDesc: string | null;
  articleConfirmYmd: string | null;
  cpName: string | null;
  realtorName: string | null;
  managerName: string | null;
  managerPhone: string | null;
}

// Claude API 호출
export async function parsePropertiesWithClaude(
  fileContent: string,
  apiKey: string
): Promise<{ properties: ParsedProperty[]; error?: string }> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: `다음은 부동산 매물 정보가 담긴 파일 내용입니다. 이를 분석해서 매물 정보를 추출해주세요.

추출할 정보:
- 매물명 (articleName)
- 매물유형 (realEstateTypeName): 아파트, 오피스텔, 빌라, 원룸, 투룸, 상가 등
- 거래타입 (tradeTypeName): 매매, 전세, 월세
- 매매가/보증금 (dealOrWarrantPrc): 만원 단위 숫자
- 월세 (rentPrc): 만원 단위 숫자
- 공급면적 (area1): ㎡
- 전용면적 (area2): ㎡
- 층수 (floorInfo)
- 방향 (direction)
- 건물명 (buildingName)
- 주소 (detailAddress)
- 매물설명 (articleFeatureDesc)
- 확정일 (articleConfirmYmd): YYYYMMDD 형식
- 중개업소 (cpName)
- 담당자 (managerName)
- 전화번호 (managerPhone)

출력 형식 (JSON):
\`\`\`json
{
  "properties": [
    {
      "articleName": "201동 광교더샵",
      "realEstateTypeName": "오피스텔",
      "tradeTypeName": "월세",
      "dealOrWarrantPrc": 4000,
      "rentPrc": 150,
      "area1": 174,
      "area2": 83,
      "floorInfo": "28/48",
      "direction": null,
      "buildingName": "201동",
      "detailAddress": null,
      "articleFeatureDesc": "즉시입주가능, 사무용으로만 가능",
      "articleConfirmYmd": "20260223",
      "cpName": "알터",
      "managerName": null,
      "managerPhone": null
    }
  ]
}
\`\`\`

파일 내용:
${fileContent.slice(0, 10000)}`
        }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { properties: [], error: `API 오류: ${response.status} - ${error}` };
    }

    const data = await response.json();
    const text = data.content[0].text;

    // JSON 추출
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { properties: [], error: 'JSON 추출 실패' };
    }

    const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
    const properties = parsed.properties || [];

    // 필드 매핑
    const mappedProperties = properties.map((p: any) => ({
      articleName: p.articleName || p.매물명 || '',
      realEstateTypeCode: mapTypeCode(p.realEstateTypeName),
      realEstateTypeName: p.realEstateTypeName || p.매물유형 || '아파트',
      tradeTypeCode: mapTradeCode(p.tradeTypeName),
      tradeTypeName: p.tradeTypeName || p.거래타입 || '매매',
      dealOrWarrantPrc: p.dealOrWarrantPrc || p.매매가 || p.보증금 || null,
      rentPrc: p.rentPrc || p.월세 || null,
      area1: p.area1 || p.공급면적 || null,
      area2: p.area2 || p.전용면적 || null,
      floorInfo: p.floorInfo || p.층수 || p.층 || null,
      direction: p.direction || p.방향 || null,
      buildingName: p.buildingName || p.건물명 || null,
      detailAddress: p.detailAddress || p.주소 || null,
      articleFeatureDesc: p.articleFeatureDesc || p.매물설명 || p.설명 || null,
      articleConfirmYmd: p.articleConfirmYmd || p.확정일 || null,
      cpName: p.cpName || p.중개업소 || null,
      realtorName: p.realtorName || p.중개사 || null,
      managerName: p.managerName || p.책임자명 || p.담당자 || null,
      managerPhone: p.managerPhone || p.책임자전화번호 || p.전화번호 || null,
    }));

    return { properties: mappedProperties };
  } catch (error) {
    return { properties: [], error: error instanceof Error ? error.message : String(error) };
  }
}

function mapTypeCode(typeName: string): string {
  if (!typeName) return 'APT';
  const name = typeName.toLowerCase();
  if (name.includes('아파트')) return 'APT';
  if (name.includes('오피스텔')) return 'OPST';
  if (name.includes('빌라') || name.includes('연립')) return 'VL';
  if (name.includes('원룸')) return 'ONEROOM';
  if (name.includes('투룸')) return 'TWOROOM';
  if (name.includes('상가')) return 'SG';
  return 'APT';
}

function mapTradeCode(tradeName: string): string {
  if (!tradeName) return 'A1';
  const name = tradeName.toLowerCase();
  if (name.includes('매매')) return 'A1';
  if (name.includes('전세')) return 'B1';
  if (name.includes('월세')) return 'B2';
  return 'A1';
}
