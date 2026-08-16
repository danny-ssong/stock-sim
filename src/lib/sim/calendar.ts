export type SimMonth = {
  monthIndex: number;
  /** 'YYYY-MM' */
  month: string;
  /** 매수 시점. 매월 1일이되 휴장이면 다음 거래일이다(§5.1.1) */
  buyDate: string;
  /** 일별 수익률 배열에서 매수일의 오프셋 */
  buyOffset: number;
  /** 그 달 마지막 거래일의 오프셋. 평가액은 이 시점 기준이다 */
  endOffset: number;
  yearIndex: number;
  calendarYear: number;
  /** 그 연차의 마지막 달인지 — 연말 세금 처리 시점 */
  isYearEnd: boolean;
};

export type SimCalendar = {
  months: SimMonth[];
  totalDays: number;
  /** 연평균 거래일 수. CAGR 일별 수익률 환산에 쓴다(계획 D4) */
  daysPerYear: number;
  mode: 'future' | 'backtest';
};

function pad(value: number): string {
  return value < 10 ? `0${value}` : `${value}`;
}

function addMonths(month: string, delta: number): string {
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  const total = year * 12 + (monthNumber - 1) + delta;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

/** 그 달의 평일(월~금)을 ISO 날짜로 나열한다. 미국 공휴일은 반영하지 않는다(계획 D4). */
function weekdaysInMonth(month: string): string[] {
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const days: string[] = [];

  for (let day = 1; day <= lastDay; day += 1) {
    const weekday = new Date(Date.UTC(year, monthNumber - 1, day)).getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    days.push(`${year}-${pad(monthNumber)}-${pad(day)}`);
  }
  return days;
}

function assemble(
  months: Array<{ month: string; days: string[] }>,
  mode: 'future' | 'backtest',
  offsetOf: (month: string, index: number) => number,
): SimCalendar {
  const result: SimMonth[] = [];
  let totalDays = 0;

  for (let monthIndex = 0; monthIndex < months.length; monthIndex += 1) {
    const { month, days } = months[monthIndex];
    if (days.length === 0) {
      throw new Error(`${month}에 거래일이 없습니다`);
    }

    const yearIndex = Math.floor(monthIndex / 12);
    result.push({
      monthIndex,
      month,
      buyDate: days[0],
      buyOffset: offsetOf(month, 0),
      endOffset: offsetOf(month, days.length - 1),
      yearIndex,
      calendarYear: Number(month.slice(0, 4)),
      isYearEnd: monthIndex % 12 === 11 || monthIndex === months.length - 1,
    });
    totalDays += days.length;
  }

  const years = months.length / 12;
  return {
    months: result,
    totalDays,
    daysPerYear: years > 0 ? totalDays / years : totalDays,
    mode,
  };
}

/**
 * 미래 시뮬 달력.
 * 실제 거래일 달력이 없으므로 평일을 거래일로 삼는다(계획 D4).
 * 오프셋은 이 달력 자체가 만드는 가상 축의 인덱스다.
 */
export function buildFutureCalendar(params: {
  startMonth: string;
  months: number;
}): SimCalendar {
  const buckets: Array<{ month: string; days: string[] }> = [];
  for (let i = 0; i < params.months; i += 1) {
    const month = addMonths(params.startMonth, i);
    buckets.push({ month, days: weekdaysInMonth(month) });
  }

  let cursor = 0;
  const starts = new Map<string, number>();
  for (const bucket of buckets) {
    starts.set(bucket.month, cursor);
    cursor += bucket.days.length;
  }

  return assemble(buckets, 'future', (month, index) => {
    const start = starts.get(month);
    return start === undefined ? 0 : start + index;
  });
}

/**
 * 과거 백테스트 달력.
 * meta.json의 실제 거래일 축을 쓰므로 공휴일 휴장이 그대로 반영된다.
 * 1월 1일 같은 휴장일이 매수일이면 자연히 다음 거래일이 첫 원소가 된다.
 */
export function buildBacktestCalendar(params: {
  dates: string[];
  startMonth: string;
  months: number;
}): SimCalendar {
  const indexByDate = new Map<string, number>();
  for (let i = 0; i < params.dates.length; i += 1) {
    indexByDate.set(params.dates[i], i);
  }

  const buckets: Array<{ month: string; days: string[] }> = [];
  for (let i = 0; i < params.months; i += 1) {
    const month = addMonths(params.startMonth, i);
    buckets.push({
      month,
      days: params.dates.filter((d) => d.slice(0, 7) === month),
    });
  }

  const daysByMonth = new Map(buckets.map((b) => [b.month, b.days]));

  return assemble(buckets, 'backtest', (month, index) => {
    const days = daysByMonth.get(month);
    const date = days === undefined ? undefined : days[index];
    const offset = date === undefined ? undefined : indexByDate.get(date);
    return offset === undefined ? 0 : offset;
  });
}
