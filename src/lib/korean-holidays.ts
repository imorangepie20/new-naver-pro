// ============================================
// 한국 공휴일 데이터 및 유틸리티
// ============================================

export interface Holiday {
    date: string;      // YYYY-MM-DD
    name: string;      // 휴일 이름
    isAlternative: boolean; // 대체공휴일 여부
}

// 양력 기반 고정 공휴일 (월-일 기준)
const solarHolidays = [
    { month: 1, day: 1, name: '새해' },
    { month: 3, day: 1, name: '삼일절' },
    { month: 5, day: 5, name: '어린이날' },
    { month: 6, day: 6, name: '현충일' },
    { month: 8, day: 15, name: '광복절' },
    { month: 10, day: 3, name: '개천절' },
    { month: 10, day: 9, name: '한글날' },
    { month: 12, day: 25, name: '크리스마스' },
];

// 근로자의 날 (단, 5월 1일이 다른 공휴일과 겹치면 공휴일 아님)
// 이 경우 별도 처리 필요

// ============================================
// 음력-양력 변환 함수
// ============================================

// 간단한 음력-양력 변환 (1900년 ~ 2100년)
// 실제 변환 로직은 매우 복잡하므로 근사치를 사용하거나
// 라이브러리(lunar-calendar 등)를 사용하는 것이 좋습니다.
// 여기서는 주요 음력 명절의 양력 날짜를 미리 계산해둡니다.

// 음력 기반 명절 (2024년 ~ 2030년)
const lunarHolidaysData: Record<string, Array<{ date: string; name: string }>> = {
    '2024': [
        { date: '2024-02-09', name: '설날' }, // 음력 1월 1일 (대체공휴일 포함)
        { date: '2024-02-10', name: '설날' },
        { date: '2024-02-11', name: '설날' },
        { date: '2024-02-12', name: '설날 연휴' }, // 대체공휴일
        { date: '2024-04-10', name: '국회의원선거' }, // 임시공휴일
        { date: '2024-05-15', name: '부처님오신날' }, // 음력 4월 8일
        { date: '2024-06-06', name: '현충일' },
        { date: '2024-09-16', name: '추석' }, // 음력 8월 15일
        { date: '2024-09-17', name: '추석' },
        { date: '2024-09-18', name: '추석' },
    ],
    '2025': [
        { date: '2025-01-01', name: '새해' },
        { date: '2025-01-28', name: '설날' }, // 음력 1월 1일
        { date: '2025-01-29', name: '설날' },
        { date: '2025-01-30', name: '설날' },
        { date: '2025-03-01', name: '삼일절' },
        { date: '2025-03-03', name: '삼일절 대체공휴일' }, // 일요일 대체
        { date: '2025-05-01', name: '근로자의날' },
        { date: '2025-05-05', name: '어린이날' },
        { date: '2025-05-06', name: '어린이날 대체공휴일' }, // 화요일 대체
        { date: '2025-06-06', name: '현충일' },
        { date: '2025-08-15', name: '광복절' },
        { date: '2025-10-03', name: '개천절' },
        { date: '2025-10-06', name: '한글날' }, // 음력 8월 15일이 아닌 양력 10월 9일이 한글날
        { date: '2025-10-09', name: '한글날' },
        { date: '2025-12-25', name: '크리스마스' },
    ],
    '2026': [
        { date: '2026-01-01', name: '새해' },
        { date: '2026-02-17', name: '설날' }, // 음력 1월 1일
        { date: '2026-02-18', name: '설날' },
        { date: '2026-02-19', name: '설날' },
        { date: '2026-03-01', name: '삼일절' },
        { date: '2026-03-02', name: '삼일절 대체공휴일' }, // 일요일 대체
        { date: '2026-05-01', name: '근로자의날' },
        { date: '2026-05-05', name: '어린이날' },
        { date: '2026-05-24', name: '부처님오신날' }, // 음력 4월 8일
        { date: '2026-06-06', name: '현충일' },
        { date: '2026-08-15', name: '광복절' },
        { date: '2026-09-25', name: '추석' }, // 음력 8월 15일
        { date: '2026-09-26', name: '추석' },
        { date: '2026-09-27', name: '추석' },
        { date: '2026-10-03', name: '개천절' },
        { date: '2026-10-09', name: '한글날' },
        { date: '2026-12-25', name: '크리스마스' },
    ],
    '2027': [
        { date: '2027-01-01', name: '새해' },
        { date: '2027-02-06', name: '설날' }, // 음력 1월 1일
        { date: '2027-02-07', name: '설날' },
        { date: '2027-02-08', name: '설날' },
        { date: '2027-03-01', name: '삼일절' },
        { date: '2027-05-01', name: '근로자의날' },
        { date: '2027-05-05', name: '어린이날' },
        { date: '2027-05-13', name: '부처님오신날' }, // 음력 4월 8일
        { date: '2027-06-06', name: '현충일' },
        { date: '2027-08-15', name: '광복절' },
        { date: '2027-09-14', name: '추석' }, // 음력 8월 15일
        { date: '2027-09-15', name: '추석' },
        { date: '2027-09-16', name: '추석' },
        { date: '2027-10-03', name: '개천절' },
        { date: '2027-10-09', name: '한글날' },
        { date: '2027-12-25', name: '크리스마스' },
    ],
    '2028': [
        { date: '2028-01-01', name: '새해' },
        { date: '2028-02-01', name: '설날' }, // 음력 1월 1일
        { date: '2028-02-02', name: '설날' },
        { date: '2028-02-03', name: '설날' },
        { date: '2028-03-01', name: '삼일절' },
        { date: '2028-05-01', name: '근로자의날' },
        { date: '2028-05-05', name: '어린이날' },
        { date: '2028-05-26', name: '부처님오신날' }, // 음력 4월 8일
        { date: '2028-06-06', name: '현충일' },
        { date: '2028-08-15', name: '광복절' },
        { date: '2028-10-03', name: '개천절' },
        { date: '2028-10-09', name: '한글날' },
        { date: '2028-12-25', name: '크리스마스' },
    ],
    '2029': [
        { date: '2029-01-01', name: '새해' },
        { date: '2029-02-12', name: '설날' }, // 음력 1월 1일
        { date: '2029-02-13', name: '설날' },
        { date: '2029-02-14', name: '설날' },
        { date: '2029-03-01', name: '삼일절' },
        { date: '2029-05-01', name: '근로자의날' },
        { date: '2029-05-05', name: '어린이날' },
        { date: '2029-05-15', name: '부처님오신날' }, // 음력 4월 8일
        { date: '2029-06-06', name: '현충일' },
        { date: '2029-08-15', name: '광복절' },
        { date: '2029-09-21', name: '추석' }, // 음력 8월 15일
        { date: '2029-09-22', name: '추석' },
        { date: '2029-09-23', name: '추석' },
        { date: '2029-09-24', name: '추석 대체공휴일' },
        { date: '2029-10-03', name: '개천절' },
        { date: '2029-10-09', name: '한글날' },
        { date: '2029-12-25', name: '크리스마스' },
    ],
    '2030': [
        { date: '2030-01-01', name: '새해' },
        { date: '2030-02-02', name: '설날' }, // 음력 1월 1일
        { date: '2030-02-03', name: '설날' },
        { date: '2030-02-04', name: '설날' },
        { date: '2030-02-05', name: '설날 대체공휴일' },
        { date: '2030-03-01', name: '삼일절' },
        { date: '2030-05-01', name: '근로자의날' },
        { date: '2030-05-05', name: '어린이날' },
        { date: '2030-05-24', name: '부처님오신날' }, // 음력 4월 8일
        { date: '2030-06-06', name: '현충일' },
        { date: '2030-08-15', name: '광복절' },
        { date: '2030-09-11', name: '추석' }, // 음력 8월 15일
        { date: '2030-09-12', name: '추석' },
        { date: '2030-09-13', name: '추석' },
        { date: '2030-10-03', name: '개천절' },
        { date: '2030-10-09', name: '한글날' },
        { date: '2030-12-25', name: '크리스마스' },
    ],
};

// ============================================
// 공휴일 확인 함수
// ============================================

/**
 * 해당 날짜가 공휴일인지 확인
 */
export const isHoliday = (date: Date): Holiday | null => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    // 1. 미리 정의된 연도별 공휴일 확인 (음력 명절 포함)
    if (lunarHolidaysData[year]) {
        for (const holiday of lunarHolidaysData[year]) {
            if (holiday.date === dateStr) {
                return {
                    date: dateStr,
                    name: holiday.name,
                    isAlternative: holiday.name.includes('대체공휴일'),
                };
            }
        }
    }

    // 2. 양력 고정 공휴일 확인
    for (const holiday of solarHolidays) {
        if (holiday.month === month && holiday.day === day) {
            return {
                date: dateStr,
                name: holiday.name,
                isAlternative: false,
            };
        }
    }

    // 3. 부처님오신날 (음력 4월 8일) - 위 데이터에 없는 연도는 근사치로 계산
    // 실제로는 음력 변환 라이브러리가 필요하지만, 간단하게 처리

    // 4. 임시공휴일이나 특별한 경우는 데이터에 추가 필요

    return null;
};

/**
 * 해당 월의 모든 공휴일 반환
 */
export const getHolidaysInMonth = (year: number, month: number): Holiday[] => {
    const holidays: Holiday[] = [];
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);

    // 미리 정의된 연도 데이터 확인
    if (lunarHolidaysData[year]) {
        for (const holiday of lunarHolidaysData[year]) {
            const holidayDate = new Date(holiday.date);
            if (holidayDate.getMonth() + 1 === month) {
                holidays.push({
                    date: holiday.date,
                    name: holiday.name,
                    isAlternative: holiday.name.includes('대체공휴일'),
                });
            }
        }
    }

    // 양력 고정 공휴일
    for (const holiday of solarHolidays) {
        if (holiday.month === month) {
            const dateStr = `${year}-${String(holiday.month).padStart(2, '0')}-${String(holiday.day).padStart(2, '0')}`;
            // 중복 확인
            if (!holidays.find(h => h.date === dateStr)) {
                holidays.push({
                    date: dateStr,
                    name: holiday.name,
                    isAlternative: false,
                });
            }
        }
    }

    return holidays.sort((a, b) => a.date.localeCompare(b.date));
};

/**
 * 공휴일 이름 반환 (없으면 null)
 */
export const getHolidayName = (date: Date): string | null => {
    const holiday = isHoliday(date);
    return holiday ? holiday.name : null;
};

/**
 * 공휴일 날짜를 기준으로 공휴일 목록 생성
 */
export const getHolidaysInRange = (startDate: Date, endDate: Date): Holiday[] => {
    const holidays: Holiday[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
        const holiday = isHoliday(current);
        if (holiday) {
            holidays.push(holiday);
        }
        current.setDate(current.getDate() + 1);
    }

    return holidays;
};

// ============================================
// 공휴일 데이터 가져오기 (API 호출용)
// ============================================

/**
 * 공공데이터포털에서 특일 정보 가져오기 (선택적 구현)
 * 사용하려면 서비스 키가 필요합니다.
 */
export const fetchHolidaysFromAPI = async (year: number, month: number): Promise<Holiday[]> => {
    // 공공데이터포털 API 호출 구현 (선택사항)
    // 예: https://www.data.go.kr/tcs/dss/selectApiListDetailView.do?publicDataPk=15012690
    return [];
};
