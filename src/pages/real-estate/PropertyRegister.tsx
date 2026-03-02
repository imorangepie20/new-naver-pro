// ============================================
// 매물 등록 페이지
// 텍스트/CSV/Excel 파일에서 매물 정보를 읽어서 개인 DB에 등록
// ============================================

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
    Upload,
    FileText,
    Check,
    X,
    Loader2,
    AlertCircle,
    FileJson,
    FileSpreadsheet,
    Plus,
    Eye,
    EyeOff,
} from 'lucide-react';
import HudCard from '../../components/common/HudCard';
import Button from '../../components/common/Button';
import { API_BASE } from '../../lib/api';

// ============================================
// 타입 정의
// ============================================

interface ParsedProperty {
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
    tagList: string[];
    cortarNo: string;
    complexNo: string | null;
}

interface ParseResult {
    success: boolean;
    properties: ParsedProperty[];
    errors: string[];
    totalLines: number;
    parsedLines: number;
}

// ============================================
// 컴포넌트
// ============================================

const PropertyRegister = () => {
    const navigate = useNavigate();

    // State
    const [file, setFile] = useState<File | null>(null);
    const [fileContent, setFileContent] = useState<string>('');
    const [excelData, setExcelData] = useState<XLSX.WorkBook | null>(null);
    const [parseResult, setParseResult] = useState<ParseResult | null>(null);
    const [isParsing, setIsParsing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [selectedForSave, setSelectedForSave] = useState<Set<number>>(new Set());
    const [saveResult, setSaveResult] = useState<{ success: number; failed: number } | null>(null);
    const [showGuide, setShowGuide] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    // 핸들러
    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        setParseResult(null);
        setSaveResult(null);
        setSelectedForSave(new Set());
        setExcelData(null);

        const fileExt = selectedFile.name.split('.').pop()?.toLowerCase();

        // 엑셀 파일은 arrayBuffer로 읽기
        if (fileExt === 'xlsx' || fileExt === 'xls') {
            const reader = new FileReader();
            reader.onload = (e) => {
                const data = e.target?.result;
                if (data) {
                    try {
                        const workbook = XLSX.read(data, { type: 'array' });
                        setExcelData(workbook);
                        // 엑셀 내용을 텍스트로도 미리보기용 변환
                        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                        const csvText = XLSX.utils.sheet_to_csv(firstSheet);
                        setFileContent(csvText);
                    } catch (err) {
                        console.error('Excel 파일 파싱 오류:', err);
                        alert('Excel 파일을 읽는 중 오류가 발생했습니다.\n파일이 손상되었거나 지원되지 않는 형식일 수 있습니다.');
                    }
                }
            };
            reader.onerror = () => {
                alert('파일을 읽는 중 오류가 발생했습니다.');
            };
            reader.readAsArrayBuffer(selectedFile);
        } else {
            // 텍스트 파일 (txt, csv, json, md)
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target?.result as string;
                setFileContent(content);
            };
            reader.readAsText(selectedFile);
        }
    }, []);

    const handleRemoveFile = () => {
        setFile(null);
        setFileContent('');
        setExcelData(null);
        setParseResult(null);
        setSaveResult(null);
        setSelectedForSave(new Set());
    };

    // 텍스트 파싱 (정규식 기반)
    const parseTextContent = useCallback((content: string): ParseResult => {
        const lines = content.split('\n').filter(line => line.trim());
        const properties: ParsedProperty[] = [];
        const errors: string[] = [];

        let currentProperty: Partial<ParsedProperty> = {};
        let lineIndex = 0;

        for (const line of lines) {
            lineIndex++;
            const trimmedLine = line.trim();

            // 빈 줄 또는 구분선 건너뛰기
            if (!trimmedLine || /^[-=]+$/.test(trimmedLine)) {
                continue;
            }

            // 매물 구분자 (=== 또는 번호로 시작)
            if (/^[\d]+\s*[.]|===+/.test(trimmedLine) || trimmedLine.includes('매물') || trimmedLine.includes('부동산')) {
                // 이전 매물 저장
                if (currentProperty.articleName) {
                    properties.push(currentProperty as ParsedProperty);
                }
                currentProperty = {};

                // 번호로 시작하는 경우 이름 추정
                const match = trimmedLine.match(/^[\d]+\s*[.]?\s*(.+)$/);
                if (match && match[1] && !match[1].includes('매물') && !match[1].includes('부동산')) {
                    currentProperty.articleName = match[1].trim();
                }
                continue;
            }

            // 키:값 형식 파싱
            if (trimmedLine.includes(':') || trimmedLine.includes('：')) {
                const [key, ...valueParts] = trimmedLine.split(/[:：]/);
                const value = valueParts.join(':').trim();

                switch (key.trim()) {
                    case '매물명':
                    case '건물명':
                    case '물건명':
                    case '이름':
                        currentProperty.articleName = value;
                        break;
                    case '유형':
                    case '매물유형':
                    case '종류':
                        if (value.includes('아파트') || value.includes('APT')) {
                            currentProperty.realEstateTypeCode = 'APT';
                            currentProperty.realEstateTypeName = '아파트';
                        } else if (value.includes('오피스텔') || value.includes('OPST')) {
                            currentProperty.realEstateTypeCode = 'OPST';
                            currentProperty.realEstateTypeName = '오피스텔';
                        } else if (value.includes('빌라') || value.includes('연립')) {
                            currentProperty.realEstateTypeCode = 'VL';
                            currentProperty.realEstateTypeName = '빌라';
                        } else if (value.includes('원룸')) {
                            currentProperty.realEstateTypeCode = 'ONEROOM';
                            currentProperty.realEstateTypeName = '원룸';
                        } else if (value.includes('투룸')) {
                            currentProperty.realEstateTypeCode = 'TWOROOM';
                            currentProperty.realEstateTypeName = '투룸';
                        } else if (value.includes('상가')) {
                            currentProperty.realEstateTypeCode = 'SG';
                            currentProperty.realEstateTypeName = '상가';
                        }
                        break;
                    case '거래':
                    case '거래방식':
                    case '매매방식':
                        if (value.includes('매매')) {
                            currentProperty.tradeTypeCode = 'A1';
                            currentProperty.tradeTypeName = '매매';
                        } else if (value.includes('전세')) {
                            currentProperty.tradeTypeCode = 'B1';
                            currentProperty.tradeTypeName = '전세';
                        } else if (value.includes('월세')) {
                            currentProperty.tradeTypeCode = 'B2';
                            currentProperty.tradeTypeName = '월세';
                        }
                        break;
                    case '가격':
                    case '매매가':
                    case '보증금':
                        // "9억 5,000" 또는 "95000" 형식 파싱
                        const priceMatch = value.match(/(\d+)억\s*(\d+)?/);
                        if (priceMatch) {
                            const ok = parseInt(priceMatch[1]) * 10000;
                            const man = priceMatch[2] ? parseInt(priceMatch[2].replace(/,/g, '')) : 0;
                            currentProperty.dealOrWarrantPrc = ok + man;
                        } else {
                            const numPrice = parseInt(value.replace(/[^0-9]/g, ''));
                            if (!isNaN(numPrice)) {
                                currentProperty.dealOrWarrantPrc = numPrice;
                            }
                        }
                        break;
                    case '월세':
                        const monthlyRent = parseInt(value.replace(/[^0-9]/g, ''));
                        if (!isNaN(monthlyRent)) {
                            currentProperty.rentPrc = monthlyRent;
                        }
                        break;
                    case '면적':
                    case '전용면적':
                    case '공급면적':
                        const areaMatch = value.match(/([\d.]+)/);
                        if (areaMatch) {
                            const area = parseFloat(areaMatch[1]);
                            if (key.includes('전용')) {
                                currentProperty.area2 = area;
                            } else if (key.includes('공급')) {
                                currentProperty.area1 = area;
                            } else {
                                currentProperty.area2 = area;
                            }
                        }
                        break;
                    case '층':
                    case '층수':
                        currentProperty.floorInfo = value;
                        break;
                    case '방향':
                        currentProperty.direction = value;
                        break;
                    case '주소':
                    case '상세주소':
                    case '소재지':
                        currentProperty.detailAddress = value;
                        break;
                    case '설명':
                    case '상세설명':
                    case '비고':
                        currentProperty.articleFeatureDesc = value;
                        break;
                    case '확정일':
                    case '날짜':
                    case '매물일':
                        // YYYY.MM.DD 또는 YYYYMMDD 형식
                        const dateMatch = value.match(/(\d{4})[.]?(\d{2})[.]?(\d{2})/);
                        if (dateMatch) {
                            currentProperty.articleConfirmYmd = `${dateMatch[1]}${dateMatch[2]}${dateMatch[3]}`;
                        }
                        break;
                    case '중개사':
                    case '부동산':
                        currentProperty.cpName = value;
                        break;
                    case '담당자':
                    case '중개사명':
                        currentProperty.realtorName = value;
                        break;
                    case '태그':
                    case '특징':
                        currentProperty.tagList = value.split(',').map(t => t.trim());
                        break;
                }
            }
        }

        // 마지막 매물 저장
        if (currentProperty.articleName) {
            properties.push(currentProperty as ParsedProperty);
        }

        // 기본값 채우기
        const validatedProperties = properties.map((p, idx) => ({
            articleName: p.articleName || `매물 ${idx + 1}`,
            realEstateTypeCode: p.realEstateTypeCode || 'APT',
            realEstateTypeName: p.realEstateTypeName || '아파트',
            tradeTypeCode: p.tradeTypeCode || 'A1',
            tradeTypeName: p.tradeTypeName || '매매',
            dealOrWarrantPrc: p.dealOrWarrantPrc ?? null,
            rentPrc: p.rentPrc ?? null,
            area1: p.area1 ?? null,
            area2: p.area2 ?? null,
            floorInfo: p.floorInfo ?? null,
            direction: p.direction ?? null,
            buildingName: p.buildingName ?? p.articleName ?? null,
            detailAddress: p.detailAddress ?? null,
            articleFeatureDesc: p.articleFeatureDesc ?? null,
            articleConfirmYmd: p.articleConfirmYmd ?? null,
            cpName: p.cpName ?? null,
            realtorName: p.realtorName ?? null,
            tagList: p.tagList ?? [],
            cortarNo: '0000000000', // 기본값 (필수)
            complexNo: p.complexNo ?? null,
        }));

        return {
            success: validatedProperties.length > 0,
            properties: validatedProperties,
            errors,
            totalLines: lineIndex,
            parsedLines: validatedProperties.length,
        };
    }, []);

    // CSV 파싱 (따옴표 처리 개선)
    const parseCSVContent = useCallback((content: string): ParseResult => {
        const properties: ParsedProperty[] = [];
        const errors: string[] = [];

        if (!content || content.trim().length === 0) {
            return { success: false, properties: [], errors: ['빈 파일입니다'], totalLines: 0, parsedLines: 0 };
        }

        // CSV 파싱 함수 (따옴표 처리)
        const parseCSVLine = (line: string): string[] => {
            const result: string[] = [];
            let current = '';
            let inQuotes = false;
            let i = 0;

            while (i < line.length) {
                const char = line[i];
                const nextChar = line[i + 1];

                if (char === '"') {
                    if (inQuotes && nextChar === '"') {
                        // 이스케이프된 따옴표 ("")
                        current += '"';
                        i += 2;
                    } else {
                        // 따옴표 토글
                        inQuotes = !inQuotes;
                        i++;
                    }
                } else if (char === ',' && !inQuotes) {
                    // 필드 구분자
                    result.push(current.trim());
                    current = '';
                    i++;
                } else {
                    current += char;
                    i++;
                }
            }
            result.push(current.trim());
            return result;
        };

        const lines = content.split(/\r?\n/).filter(line => line.trim());

        if (lines.length === 0) {
            return { success: false, properties: [], errors: ['빈 파일입니다'], totalLines: 0, parsedLines: 0 };
        }

        // 첫 번째 줄이 헤더인지 확인
        const firstLine = lines[0].trim();
        const hasHeader = firstLine.includes('매물명') || firstLine.includes('유형') ||
                          firstLine.includes('거래') || firstLine.includes('가격');

        // 데이터 시작 인덱스
        const startIndex = hasHeader ? 1 : 0;

        // 헤더가 있는 경우 컬럼 인덱스 파악
        let colIndices: { [key: string]: number } = {};
        if (hasHeader) {
            const headers = parseCSVLine(firstLine);
            headers.forEach((h, idx) => {
                const header = h.trim();
                if (header.includes('매물명') || header.includes('건물명') || header.includes('물건명')) colIndices['매물명'] = idx;
                else if (header.includes('유형') || header.includes('종류')) colIndices['유형'] = idx;
                else if (header.includes('거래')) colIndices['거래'] = idx;
                else if (header.includes('가격') || header.includes('매매가') || header.includes('보증금')) colIndices['가격'] = idx;
                else if (header.includes('월세')) colIndices['월세'] = idx;
                else if (header.includes('면적')) colIndices['면적'] = idx;
                else if (header.includes('층')) colIndices['층'] = idx;
                else if (header.includes('방향')) colIndices['방향'] = idx;
                else if (header.includes('주소') || header.includes('소재지')) colIndices['주소'] = idx;
                else if (header.includes('확정일') || header.includes('날짜')) colIndices['확정일'] = idx;
                else if (header.includes('중개사') || header.includes('부동산')) colIndices['중개사'] = idx;
                else if (header.includes('담당자')) colIndices['담당자'] = idx;
                else if (header.includes('설명') || header.includes('비고')) colIndices['설명'] = idx;
            });
        }

        // CSV 컬럼 순서 (기본값 또는 헤더에서 파악)
        const defaultOrder = ['매물명', '유형', '거래', '가격', '월세', '면적', '층', '방향', '주소', '확정일', '중개사', '담당자', '설명'];

        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // 개선된 CSV 파싱
            const values = parseCSVLine(line);

            if (values.length < 2) {
                errors.push(`라인 ${i + 1}: 데이터가 충분하지 않습니다 (최소 2개 필드 필요)`);
                continue;
            }

            // 헤더가 있으면 인덱스 기반, 없으면 순서 기반
            const getValue = (fieldName: string) => {
                if (hasHeader && colIndices[fieldName] !== undefined) {
                    const val = values[colIndices[fieldName]] || '';
                    // 따옴표 제거
                    return val.replace(/^["']|["']$/g, '');
                }
                // 기본 순서에서 찾기
                const idx = defaultOrder.indexOf(fieldName);
                if (idx >= 0 && idx < values.length) {
                    const val = values[idx];
                    return val.replace(/^["']|["']$/g, '');
                }
                return '';
            };

            const property: ParsedProperty = {
                articleName: getValue('매물명') || `매물 ${properties.length + 1}`,
                realEstateTypeCode: 'APT',
                realEstateTypeName: '아파트',
                tradeTypeCode: 'A1',
                tradeTypeName: '매매',
                dealOrWarrantPrc: null,
                rentPrc: null,
                area1: null,
                area2: null,
                floorInfo: null,
                direction: null,
                buildingName: null,
                detailAddress: null,
                articleFeatureDesc: null,
                articleConfirmYmd: null,
                cpName: null,
                realtorName: null,
                tagList: [],
                cortarNo: '0000000000',
                complexNo: null,
            };

            // 유형 파싱
            const typeValue = getValue('유형');
            if (typeValue) {
                if (typeValue.includes('아파트') || typeValue === 'APT') {
                    property.realEstateTypeCode = 'APT';
                    property.realEstateTypeName = '아파트';
                } else if (typeValue.includes('오피스텔') || typeValue === 'OPST') {
                    property.realEstateTypeCode = 'OPST';
                    property.realEstateTypeName = '오피스텔';
                } else if (typeValue.includes('빌라') || typeValue.includes('연립')) {
                    property.realEstateTypeCode = 'VL';
                    property.realEstateTypeName = '빌라';
                } else if (typeValue.includes('원룸')) {
                    property.realEstateTypeCode = 'ONEROOM';
                    property.realEstateTypeName = '원룸';
                } else if (typeValue.includes('투룸')) {
                    property.realEstateTypeCode = 'TWOROOM';
                    property.realEstateTypeName = '투룸';
                } else if (typeValue.includes('상가')) {
                    property.realEstateTypeCode = 'SG';
                    property.realEstateTypeName = '상가';
                }
            }

            // 거래 방식 파싱
            const tradeValue = getValue('거래');
            if (tradeValue) {
                if (tradeValue.includes('매매')) {
                    property.tradeTypeCode = 'A1';
                    property.tradeTypeName = '매매';
                } else if (tradeValue.includes('전세')) {
                    property.tradeTypeCode = 'B1';
                    property.tradeTypeName = '전세';
                } else if (tradeValue.includes('월세')) {
                    property.tradeTypeCode = 'B2';
                    property.tradeTypeName = '월세';
                }
            }

            // 가격 파싱
            const priceValue = getValue('가격');
            if (priceValue) {
                const priceMatch = priceValue.match(/(\d+)억\s*(\d+)?/);
                if (priceMatch) {
                    const ok = parseInt(priceMatch[1]) * 10000;
                    const man = priceMatch[2] ? parseInt(priceMatch[2].replace(/,/g, '')) : 0;
                    property.dealOrWarrantPrc = ok + man;
                } else {
                    const numPrice = parseInt(priceValue.replace(/[^0-9]/g, ''));
                    if (!isNaN(numPrice)) {
                        property.dealOrWarrantPrc = numPrice;
                    }
                }
            }

            // 월세 파싱
            const rentValue = getValue('월세');
            if (rentValue) {
                const monthlyRent = parseInt(rentValue.replace(/[^0-9]/g, ''));
                if (!isNaN(monthlyRent)) {
                    property.rentPrc = monthlyRent;
                }
            }

            // 면적 파싱
            const areaValue = getValue('면적');
            if (areaValue) {
                const areaMatch = areaValue.match(/([\d.]+)/);
                if (areaMatch) {
                    property.area2 = parseFloat(areaMatch[1]);
                    property.area1 = property.area2; // 전용=공급으로 동일하게 처리
                }
            }

            // 층 정보
            const floorValue = getValue('층');
            if (floorValue) property.floorInfo = floorValue;

            // 방향
            const directionValue = getValue('방향');
            if (directionValue) property.direction = directionValue;

            // 주소
            const addressValue = getValue('주소');
            if (addressValue) property.detailAddress = addressValue;

            // 확정일
            const dateValue = getValue('확정일');
            if (dateValue) {
                const dateMatch = dateValue.match(/(\d{4})[.]?(\d{2})[.]?(\d{2})/);
                if (dateMatch) {
                    property.articleConfirmYmd = `${dateMatch[1]}${dateMatch[2]}${dateMatch[3]}`;
                }
            }

            // 중개사
            const cpValue = getValue('중개사');
            if (cpValue) property.cpName = cpValue;

            // 담당자
            const realtorValue = getValue('담당자');
            if (realtorValue) property.realtorName = realtorValue;

            // 설명
            const descValue = getValue('설명');
            if (descValue) property.articleFeatureDesc = descValue;

            property.buildingName = property.articleName;

            properties.push(property);
        }

        return {
            success: properties.length > 0,
            properties,
            errors,
            totalLines: lines.length,
            parsedLines: properties.length,
        };
    }, []);

    // 엑셀 파싱
    const parseExcelContent = useCallback((workbook: XLSX.WorkBook): ParseResult => {
        const properties: ParsedProperty[] = [];
        const errors: string[] = [];

        try {
            // 첫 번째 시트 사용
            const sheetName = workbook.SheetNames[0];
            if (!sheetName) {
                return { success: false, properties: [], errors: ['시트를 찾을 수 없습니다'], totalLines: 0, parsedLines: 0 };
            }

            const worksheet = workbook.Sheets[sheetName];
            if (!worksheet) {
                return { success: false, properties: [], errors: ['워크시트를 읽을 수 없습니다'], totalLines: 0, parsedLines: 0 };
            }

            // 시트를 JSON으로 변환
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as Record<string, any>[];

            if (jsonData.length === 0) {
                return { success: false, properties: [], errors: ['빈 엑셀 파일입니다'], totalLines: 0, parsedLines: 0 };
            }

        // 첫 번째 행에서 헤더 파악
        const firstRow = jsonData[0];
        const headers = Object.keys(firstRow);

        // 헤더와 필드 매핑
        const getFieldMapping = (header: string): string | null => {
            const h = header.trim().toLowerCase();
            if (h.includes('매물명') || h.includes('건물명') || h.includes('물건명') || h === 'name') return '매물명';
            if (h.includes('유형') || h.includes('종류') || h === 'type') return '유형';
            if (h.includes('거래') || h.includes('매매방식')) return '거래';
            if (h.includes('가격') || h.includes('매매가') || h.includes('보증금') || h === 'price') return '가격';
            if (h.includes('월세') || h === 'rent') return '월세';
            if (h.includes('면적') || h === 'area') return '면적';
            if (h.includes('층') || h === 'floor') return '층';
            if (h.includes('방향') || h === 'direction') return '방향';
            if (h.includes('주소') || h.includes('소재지') || h === 'address') return '주소';
            if (h.includes('확정일') || h.includes('날짜') || h.includes('일자') || h === 'date') return '확정일';
            if (h.includes('중개사') || h.includes('부동산')) return '중개사';
            if (h.includes('담당자') || h.includes('중개사명')) return '담당자';
            if (h.includes('설명') || h.includes('비고') || h.includes('상세')) return '설명';
            return null;
        };

        // 헤더 매핑 생성
        const headerMapping: { [key: string]: string } = {};
        headers.forEach(h => {
            const field = getFieldMapping(h);
            if (field) headerMapping[field] = h;
        });

        for (let i = 0; i < jsonData.length; i++) {
            const row = jsonData[i];
            const property: ParsedProperty = {
                articleName: '',
                realEstateTypeCode: 'APT',
                realEstateTypeName: '아파트',
                tradeTypeCode: 'A1',
                tradeTypeName: '매매',
                dealOrWarrantPrc: null,
                rentPrc: null,
                area1: null,
                area2: null,
                floorInfo: null,
                direction: null,
                buildingName: null,
                detailAddress: null,
                articleFeatureDesc: null,
                articleConfirmYmd: null,
                cpName: null,
                realtorName: null,
                tagList: [],
                cortarNo: '0000000000',
                complexNo: null,
            };

            // 각 필드 파싱
            for (const [field, header] of Object.entries(headerMapping)) {
                const value = row[header];
                if (value === undefined || value === null || value === '') continue;

                switch (field) {
                    case '매물명':
                        property.articleName = String(value);
                        break;
                    case '유형':
                        const typeStr = String(value);
                        if (typeStr.includes('아파트') || typeStr === 'APT') {
                            property.realEstateTypeCode = 'APT';
                            property.realEstateTypeName = '아파트';
                        } else if (typeStr.includes('오피스텔') || typeStr === 'OPST') {
                            property.realEstateTypeCode = 'OPST';
                            property.realEstateTypeName = '오피스텔';
                        } else if (typeStr.includes('빌라') || typeStr.includes('연립')) {
                            property.realEstateTypeCode = 'VL';
                            property.realEstateTypeName = '빌라';
                        } else if (typeStr.includes('원룸')) {
                            property.realEstateTypeCode = 'ONEROOM';
                            property.realEstateTypeName = '원룸';
                        } else if (typeStr.includes('투룸')) {
                            property.realEstateTypeCode = 'TWOROOM';
                            property.realEstateTypeName = '투룸';
                        } else if (typeStr.includes('상가')) {
                            property.realEstateTypeCode = 'SG';
                            property.realEstateTypeName = '상가';
                        }
                        break;
                    case '거래':
                        const tradeStr = String(value);
                        if (tradeStr.includes('매매')) {
                            property.tradeTypeCode = 'A1';
                            property.tradeTypeName = '매매';
                        } else if (tradeStr.includes('전세')) {
                            property.tradeTypeCode = 'B1';
                            property.tradeTypeName = '전세';
                        } else if (tradeStr.includes('월세')) {
                            property.tradeTypeCode = 'B2';
                            property.tradeTypeName = '월세';
                        }
                        break;
                    case '가격':
                        const priceStr = String(value);
                        const priceMatch = priceStr.match(/(\d+)억\s*(\d+)?/);
                        if (priceMatch) {
                            const ok = parseInt(priceMatch[1]) * 10000;
                            const man = priceMatch[2] ? parseInt(priceMatch[2].replace(/,/g, '')) : 0;
                            property.dealOrWarrantPrc = ok + man;
                        } else {
                            const numPrice = parseInt(priceStr.replace(/[^0-9]/g, ''));
                            if (!isNaN(numPrice)) {
                                property.dealOrWarrantPrc = numPrice;
                            }
                        }
                        break;
                    case '월세':
                        const rentStr = String(value);
                        const monthlyRent = parseInt(rentStr.replace(/[^0-9]/g, ''));
                        if (!isNaN(monthlyRent)) {
                            property.rentPrc = monthlyRent;
                        }
                        break;
                    case '면적':
                        const areaStr = String(value);
                        const areaMatch = areaStr.match(/([\d.]+)/);
                        if (areaMatch) {
                            property.area2 = parseFloat(areaMatch[1]);
                            property.area1 = property.area2;
                        }
                        break;
                    case '층':
                        property.floorInfo = String(value);
                        break;
                    case '방향':
                        property.direction = String(value);
                        break;
                    case '주소':
                        property.detailAddress = String(value);
                        break;
                    case '확정일':
                        const dateStr = String(value);
                        const dateMatch = dateStr.match(/(\d{4})[.]?(\d{2})[.]?(\d{2})/);
                        if (dateMatch) {
                            property.articleConfirmYmd = `${dateMatch[1]}${dateMatch[2]}${dateMatch[3]}`;
                        }
                        break;
                    case '중개사':
                        property.cpName = String(value);
                        break;
                    case '담당자':
                        property.realtorName = String(value);
                        break;
                    case '설명':
                        property.articleFeatureDesc = String(value);
                        break;
                }
            }

            // 필수 필드 검증
            if (!property.articleName) {
                property.articleName = `매물 ${properties.length + 1}`;
            }

            property.buildingName = property.articleName;
            properties.push(property);
        }

        return {
            success: properties.length > 0,
            properties,
            errors,
            totalLines: jsonData.length,
            parsedLines: properties.length,
        };
        } catch (error) {
            console.error('Excel 파싱 오류:', error);
            return {
                success: false,
                properties: [],
                errors: [error instanceof Error ? error.message : '엑셀 파일 파싱 중 오류가 발생했습니다'],
                totalLines: 0,
                parsedLines: 0,
            };
        }
    }, []);

    // 파일 파싱
    const handleParse = useCallback(() => {
        if (!fileContent && !excelData) {
            alert('파일을 먼저 선택해주세요.');
            return;
        }

        setIsParsing(true);

        setTimeout(() => {
            try {
                let result: ParseResult;

                // 파일 확장자에 따라 파싱 방식 선택
                const fileExt = file?.name.toLowerCase().split('.').pop();
                if (excelData && (fileExt === 'xlsx' || fileExt === 'xls')) {
                    // 엑셀 파일
                    result = parseExcelContent(excelData);
                } else if (fileExt === 'csv') {
                    // CSV 파일
                    result = parseCSVContent(fileContent);
                } else {
                    // TXT 파일 (키:값 형식)
                    result = parseTextContent(fileContent);
                }

                setParseResult(result);

                // 파싱 실패 시 에러 표시
                if (!result.success && result.errors.length > 0) {
                    alert(`파싱 실패:\n${result.errors.slice(0, 3).join('\n')}${result.errors.length > 3 ? `\n...외 ${result.errors.length - 3}개` : ''}`);
                }

                // 전체 선택
                if (result.properties.length > 0) {
                    setSelectedForSave(new Set(result.properties.map((_, idx) => idx)));
                } else {
                    setSelectedForSave(new Set());
                }
            } catch (error) {
                console.error('파싱 오류:', error);
                alert(`파일 파싱 중 오류가 발생했습니다:\n${error instanceof Error ? error.message : String(error)}`);
                setParseResult({ success: false, properties: [], errors: [String(error)], totalLines: 0, parsedLines: 0 });
            } finally {
                setIsParsing(false);
            }
        }, 100);
    }, [fileContent, excelData, file, parseTextContent, parseCSVContent, parseExcelContent]);

    // 전체 선택 토글
    const toggleSelectAll = () => {
        if (!parseResult) return;
        const allSelected = parseResult.properties.length === selectedForSave.size;

        if (allSelected) {
            setSelectedForSave(new Set());
        } else {
            setSelectedForSave(new Set(parseResult.properties.map((_, idx) => idx)));
        }
    };

    // 개별 선택 토글
    const toggleSelect = (idx: number) => {
        const newSelected = new Set(selectedForSave);
        if (newSelected.has(idx)) {
            newSelected.delete(idx);
        } else {
            newSelected.add(idx);
        }
        setSelectedForSave(newSelected);
    };

    // 저장 (중앙 DB에만 저장)
    const handleSave = async () => {
        if (!parseResult || selectedForSave.size === 0) return;

        setIsSaving(true);
        setSaveResult(null);

        try {
            const selectedProperties = parseResult.properties.filter((_, idx) => selectedForSave.has(idx));

            // ParsedProperty를 Article 형식으로 변환
            const articles = selectedProperties.map((property) => ({
                articleNo: `REG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // 개별 articleNo 생성
                articleName: property.articleName || '매물',
                buildingName: property.buildingName || property.articleName || '매물',
                realEstateTypeCode: property.realEstateTypeCode || 'APT',
                realEstateTypeName: property.realEstateTypeName || '아파트',
                tradeTypeCode: property.tradeTypeCode || 'A1',
                tradeTypeName: property.tradeTypeName || '매매',
                dealOrWarrantPrc: property.dealOrWarrantPrc ?? null,
                rentPrc: property.rentPrc ?? null,
                area1: property.area1 ?? null,
                area2: property.area2 ?? null,
                floorInfo: property.floorInfo ?? null,
                direction: property.direction ?? null,
                detailAddress: property.detailAddress ?? null,
                articleFeatureDesc: property.articleFeatureDesc ?? null,
                articleConfirmYmd: property.articleConfirmYmd ?? null,
                cpName: property.cpName ?? null,
                realtorName: property.realtorName ?? null,
                tagList: Array.isArray(property.tagList) ? property.tagList : [],
                cortarNo: property.cortarNo || '0000000000',
                complexNo: property.complexNo ?? null,
            }));

            // 중앙 DB에만 저장
            const response = await fetch(`${API_BASE}/api/properties/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  articles,
                  dataSource: 'UPLOAD',  // 파일 업로드 데이터
                }),
            });

            if (response.ok) {
                const data = await response.json();
                setSaveResult({ success: data.savedCount, failed: data.skippedCount || 0 });

                // 에러가 있으면 콘솔에 출력
                if (data.errors && data.errors.length > 0) {
                    console.error('Some articles failed to save:', data.errors);
                }

                if (data.savedCount > 0) {
                    // 성공한 항목은 리스트에서 제거
                    const remainingIndices = new Set(
                        parseResult.properties
                            .map((_, idx) => idx)
                            .filter(idx => !selectedForSave.has(idx))
                    );
                    setSelectedForSave(remainingIndices);
                }
            } else {
                const errorData = await response.json();
                setSaveResult({ success: 0, failed: selectedProperties.length });
                console.error('Save error:', errorData);
                // 상세 에러 메시지 표시
                alert(`저장 실패: ${errorData.error || '알 수 없는 오류'}\n${errorData.details ? JSON.stringify(errorData.details, null, 2) : ''}`);
            }
        } catch (error) {
            console.error('Save error:', error);
            setSaveResult({ success: 0, failed: parseResult.properties.filter((_, idx) => selectedForSave.has(idx)).length });
            alert(`저장 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsSaving(false);
        }
    };

    // 파일 아이콘
    const getFileIcon = (fileName: string) => {
        const ext = fileName.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'json':
                return <FileJson size={20} />;
            case 'csv':
            case 'xlsx':
            case 'xls':
                return <FileSpreadsheet size={20} />;
            default:
                return <FileText size={20} />;
        }
    };

    return (
        <div className="min-h-screen animate-fade-in p-4 sm:p-6">
            {/* 헤더 */}
            <div className="mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold text-hud-text-primary">매물 등록</h1>
                <p className="text-sm text-hud-text-muted mt-1">
                    파일에서 매물 정보를 읽어서 개인 DB에 등록합니다
                </p>
            </div>

            {/* 파일 선택 전: 중앙 집중형 레이아웃 */}
            {!file && !parseResult && (
                <div className="max-w-xl mx-auto">
                    {/* 파일 업로드 */}
                    <div
                        className={`relative border-2 border-dashed rounded-3xl p-16 text-center transition-all duration-300 cursor-pointer ${
                            isDragging
                                ? 'border-hud-accent-primary bg-hud-accent-primary/20 scale-[1.02]'
                                : 'border-hud-border-secondary hover:border-hud-accent-primary/50 bg-hud-bg-secondary'
                        }`}
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={(e) => {
                            e.preventDefault();
                            setIsDragging(false);
                            const droppedFile = e.dataTransfer.files?.[0];
                            if (droppedFile) {
                                const event = { target: { files: [droppedFile] } } as unknown as React.ChangeEvent<HTMLInputElement>;
                                handleFileSelect(event);
                            }
                        }}
                    >
                        <input
                            type="file"
                            id="file-upload"
                            className="hidden"
                            accept=".txt,.csv,.xlsx,.xls,.json,.md"
                            onChange={handleFileSelect}
                        />
                        <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-5">
                            <div className={`p-8 rounded-3xl transition-all duration-300 ${
                                isDragging ? 'bg-hud-accent-primary scale-110' : 'bg-gradient-to-br from-hud-accent-primary/30 to-hud-accent-primary/10'
                            }`}>
                                <Upload className={`w-16 h-16 ${isDragging ? 'text-white' : 'text-hud-accent-primary'}`} />
                            </div>
                            <div className="space-y-2">
                                <p className="text-xl font-semibold text-hud-text-primary">
                                    {isDragging ? '파일을 놓아주세요' : '파일을 선택해주세요'}
                                </p>
                                <p className="text-sm text-hud-text-muted">
                                    드래그하거나 클릭하여 파일 선택
                                </p>
                                <div className="flex items-center justify-center gap-2 mt-4">
                                    <span className="px-3 py-1.5 rounded-full bg-hud-bg-secondary text-xs text-hud-text-muted font-medium border border-hud-border-secondary">
                                        TXT
                                    </span>
                                    <span className="px-3 py-1.5 rounded-full bg-hud-bg-secondary text-xs text-hud-text-muted font-medium border border-hud-border-secondary">
                                        CSV
                                    </span>
                                    <span className="px-3 py-1.5 rounded-full bg-hud-bg-secondary text-xs text-hud-text-muted font-medium border border-hud-border-secondary">
                                        Excel
                                    </span>
                                </div>
                            </div>
                        </label>
                    </div>

                    {/* 간단한 가이드 토글 */}
                    <div className="mt-6 text-center">
                        <button
                            onClick={() => setShowGuide(!showGuide)}
                            className="text-sm text-hud-text-muted hover:text-hud-accent-primary transition-colors flex items-center gap-2 mx-auto"
                        >
                            {showGuide ? (
                                <span>가이드 접기</span>
                            ) : (
                                <>
                                    <span>파일 형식 가이드 보기</span>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </>
                            )}
                        </button>
                    </div>

                    {showGuide && (
                        <div className="mt-4 bg-hud-bg-secondary rounded-2xl p-5 border border-hud-border-secondary animate-slideIn">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="p-4 bg-hud-bg-primary rounded-xl border border-hud-border-secondary">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="p-2 bg-blue-500/30 rounded-lg">
                                            <FileText size={18} className="text-blue-400" />
                                        </div>
                                        <span className="text-sm font-semibold text-hud-text-primary">TXT</span>
                                    </div>
                                    <pre className="text-xs text-hud-text-muted font-mono whitespace-pre-wrap bg-hud-bg-secondary p-3 rounded-lg border border-hud-border-secondary">
매물명: 헬리오
유형: 아파트
거래: 매매
가격: 9억 5,000
                                    </pre>
                                </div>
                                <div className="p-4 bg-hud-bg-primary rounded-xl border border-hud-border-secondary">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="p-2 bg-green-500/30 rounded-lg">
                                            <FileSpreadsheet size={18} className="text-green-400" />
                                        </div>
                                        <span className="text-sm font-semibold text-hud-text-primary">CSV</span>
                                    </div>
                                    <pre className="text-xs text-hud-text-muted font-mono whitespace-pre-wrap bg-hud-bg-secondary p-3 rounded-lg border border-hud-border-secondary">
매물명,유형,거래,가격
헬리오,아파트,매매,95000
                                    </pre>
                                </div>
                                <div className="p-4 bg-hud-bg-primary rounded-xl border border-hud-border-secondary">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="p-2 bg-purple-500/30 rounded-lg">
                                            <FileSpreadsheet size={18} className="text-purple-400" />
                                        </div>
                                        <span className="text-sm font-semibold text-hud-text-primary">Excel</span>
                                    </div>
                                    <p className="text-xs text-hud-text-muted p-3 bg-hud-bg-secondary rounded-lg border border-hud-border-secondary">
                                        첫 행을 헤더로 인식합니다. CSV와 동일한 컬럼 구조.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 파일 선택 후: 2열 레이아웃 */}
            {(file || parseResult) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* 왼쪽: 파일 정보 + 파싱 */}
                    <div className="space-y-4">
                        <HudCard
                            title="파일 정보"
                            action={
                                file && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleRemoveFile}
                                        className="text-hud-accent-danger hover:text-hud-accent-danger hover:bg-hud-accent-danger/10"
                                    >
                                        <X size={16} />
                                    </Button>
                                )
                            }
                        >
                            {file ? (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-4 p-4 bg-hud-bg-secondary rounded-xl border border-hud-border-secondary">
                                        <div className={`p-4 rounded-2xl ${
                                            file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
                                                ? 'bg-green-500/30'
                                                : 'bg-blue-500/30'
                                        }`}>
                                            {getFileIcon(file.name)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-hud-text-primary truncate">
                                                {file.name}
                                            </p>
                                            <p className="text-xs text-hud-text-muted mt-1">
                                                {(file.size / 1024).toFixed(1)} KB · {fileContent.split('\n').length}줄
                                            </p>
                                        </div>
                                    </div>

                                    {/* 미리보기 */}
                                    {fileContent && !parseResult && (
                                        <div className="bg-hud-bg-secondary rounded-xl p-4 max-h-48 overflow-y-auto border border-hud-border-secondary">
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-xs font-medium text-hud-text-secondary">파일 미리보기</span>
                                                <span className="text-xs text-hud-text-muted">{fileContent.slice(0, 100).split('\n').length}줄 표시</span>
                                            </div>
                                            <pre className="text-xs text-hud-text-muted whitespace-pre-wrap font-mono leading-relaxed bg-hud-bg-primary p-3 rounded-lg border border-hud-border-secondary">
                                                {fileContent.slice(0, 400)}
                                                {fileContent.length > 400 && '\n...'}
                                            </pre>
                                        </div>
                                    )}

                                    {/* 파싱 버튼 */}
                                    {!parseResult && (
                                        <Button
                                            variant="primary"
                                            fullWidth
                                            size="lg"
                                            leftIcon={isParsing ? <Loader2 size={20} className="animate-spin" /> : <FileText size={20} />}
                                            onClick={handleParse}
                                            disabled={isParsing}
                                            className="h-12 text-base"
                                        >
                                            {isParsing ? '파싱 중...' : (
                                                file?.name.endsWith('.csv') ? 'CSV 파싱' :
                                                file?.name.endsWith('.xlsx') || file?.name.endsWith('.xls') ? '엑셀 파싱' :
                                                '파싱 시작'
                                            )}
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <FileText className="w-12 h-12 text-hud-text-muted mx-auto mb-2" />
                                    <p className="text-sm text-hud-text-muted">파일이 선택되지 않았습니다</p>
                                </div>
                            )}
                        </HudCard>

                        {/* 파싱 가이드 (파싱 후) */}
                        {parseResult && (
                            <HudCard title="파일 등록 완료" className="bg-gradient-to-br from-hud-accent-success/10 to-transparent border-hud-accent-success/30">
                                <div className="flex items-center gap-3 p-4">
                                    <div className="p-3 bg-hud-accent-success/30 rounded-full">
                                        <Check size={24} className="text-hud-accent-success" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-hud-text-primary">
                                            {parseResult.parsedLines}개의 매물을 찾았습니다
                                        </p>
                                        <p className="text-sm text-hud-text-muted">
                                            저장할 매물을 확인하고 저장 버튼을 눌러주세요
                                        </p>
                                    </div>
                                </div>
                            </HudCard>
                        )}
                    </div>

                    {/* 오른쪽: 파싱 결과 */}
                    <div className="space-y-4">
                        <HudCard
                            title={parseResult ? `파싱 결과 (${parseResult.parsedLines}개)` : '결과 대기 중'}
                            action={
                                parseResult && parseResult.properties.length > 0 && (
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={toggleSelectAll}
                                            className="text-xs px-2 py-1"
                                        >
                                            {selectedForSave.size === parseResult.properties.length ? '전체 해제' : '전체 선택'}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setShowPreview(!showPreview)}
                                            className="p-1"
                                        >
                                            {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </Button>
                                    </div>
                                )
                            }
                        >
                            {!parseResult ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    {isParsing ? (
                                        <>
                                            <div className="relative mb-4">
                                                <Loader2 size={48} className="animate-spin text-hud-accent-primary" />
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <FileText size={20} className="text-hud-accent-primary/50" />
                                                </div>
                                            </div>
                                            <p className="text-sm font-medium text-hud-text-primary">파일을 파싱 중입니다...</p>
                                            <p className="text-xs text-hud-text-muted mt-1">잠시만 기다려주세요</p>
                                        </>
                                    ) : (
                                        <>
                                            <div className="p-4 bg-hud-bg-primary rounded-2xl mb-3">
                                                <FileText className="w-14 h-14 text-hud-text-muted mx-auto" />
                                            </div>
                                            <p className="text-sm text-hud-text-muted">
                                                파일을 선택하고 파싱을 시작해주세요
                                            </p>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {/* 요약 바 */}
                                    <div className="flex items-center justify-between p-3 bg-hud-bg-secondary rounded-xl border border-hud-border-secondary">
                                        <div className="flex items-center gap-3">
                                            <div className="text-center">
                                                <p className="text-2xl font-bold text-hud-accent-primary">
                                                    {parseResult.parsedLines}
                                                </p>
                                                <p className="text-xs text-hud-text-muted">매물</p>
                                            </div>
                                            {parseResult.errors.length > 0 && (
                                                <div className="text-center">
                                                    <p className="text-2xl font-bold text-hud-accent-warning">
                                                        {parseResult.errors.length}
                                                    </p>
                                                    <p className="text-xs text-hud-text-muted">에러</p>
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <p className="text-2xl font-bold text-hud-accent-success">
                                                {selectedForSave.size}
                                            </p>
                                            <p className="text-xs text-hud-text-muted">선택됨</p>
                                        </div>
                                    </div>

                                    {/* 매물 목록 */}
                                    <div className="max-h-80 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                        {parseResult.properties.map((property, idx) => {
                                            const isSelected = selectedForSave.has(idx);
                                            return (
                                                <div
                                                    key={idx}
                                                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                                                        isSelected
                                                            ? 'bg-hud-accent-primary/20 border-hud-accent-primary shadow-lg shadow-hud-accent-primary/15'
                                                            : 'bg-hud-bg-secondary border-hud-border-secondary hover:border-hud-accent-primary/50 hover:shadow-md'
                                                    }`}
                                                    onClick={() => toggleSelect(idx)}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${
                                                            isSelected
                                                                ? 'bg-hud-accent-primary border-hud-accent-primary'
                                                                : 'border-hud-border-secondary'
                                                        }`}>
                                                            {isSelected && <Check size={12} className="text-white" />}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-semibold text-hud-text-primary truncate mb-1.5">
                                                                {property.articleName}
                                                            </p>
                                                            <div className="flex items-center flex-wrap gap-1.5">
                                                                <span className="text-xs px-2 py-0.5 rounded-full bg-hud-accent-info/20 text-hud-accent-info font-medium">
                                                                    {property.realEstateTypeName}
                                                                </span>
                                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                                                    property.tradeTypeCode === 'A1'
                                                                        ? 'bg-hud-accent-danger/20 text-hud-accent-danger'
                                                                        : property.tradeTypeCode === 'B1'
                                                                            ? 'bg-hud-accent-success/20 text-hud-accent-success'
                                                                            : 'bg-hud-accent-warning/20 text-hud-accent-warning'
                                                                }`}>
                                                                    {property.tradeTypeName}
                                                                </span>
                                                                <span className="text-xs font-semibold text-hud-accent-primary">
                                                                    {property.dealOrWarrantPrc
                                                                        ? `${Math.floor(property.dealOrWarrantPrc / 10000)}억 ${
                                                                            property.dealOrWarrantPrc % 10000 > 0
                                                                                ? `${property.dealOrWarrantPrc % 10000}만`
                                                                                : ''
                                                                          }`
                                                                        : '가격문의'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* 저장 버튼 */}
                                    {selectedForSave.size > 0 && (
                                        <Button
                                            variant="primary"
                                            fullWidth
                                            size="lg"
                                            leftIcon={isSaving ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
                                            onClick={handleSave}
                                            disabled={isSaving}
                                            className="h-12 text-base font-semibold shadow-lg shadow-hud-accent-primary/20"
                                        >
                                            {isSaving ? '저장 중...' : `${selectedForSave.size}개 매물 저장`}
                                        </Button>
                                    )}
                                </div>
                            )}
                        </HudCard>

                        {/* 저장 결과 */}
                        {saveResult && (
                            <HudCard
                                title="저장 완료"
                                subtitle={saveResult.failed === 0 ? '모든 매물이 저장되었습니다!' : '일부 매물 저장 실패'}
                                className="bg-gradient-to-br from-hud-accent-success/10 to-transparent border-hud-accent-success/30"
                            >
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-2 px-4 py-2 bg-hud-accent-success/30 rounded-xl">
                                            <Check size={20} className="text-hud-accent-success" />
                                            <span className="text-base font-semibold text-hud-accent-success">
                                                {saveResult.success}개 저장
                                            </span>
                                        </div>
                                        {saveResult.failed > 0 && (
                                            <div className="flex items-center gap-2 px-4 py-2 bg-hud-accent-warning/30 rounded-xl">
                                                <AlertCircle size={20} className="text-hud-accent-warning" />
                                                <span className="text-base font-semibold text-hud-accent-warning">
                                                    {saveResult.failed}개 실패
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => navigate('/real-estate/regular-properties')}
                                            className="flex-1"
                                        >
                                            저장된 매물 보기
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setSaveResult(null);
                                                if (selectedForSave.size === 0) {
                                                    setParseResult(null);
                                                    setFileContent('');
                                                    setFile(null);
                                                }
                                            }}
                                            className="flex-1"
                                        >
                                            {selectedForSave.size === 0 ? '닫기' : '추가 등록'}
                                        </Button>
                                    </div>
                                </div>
                            </HudCard>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PropertyRegister;
