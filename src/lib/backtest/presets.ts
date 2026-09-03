import { BACKFILL_START } from '../data/catalog';
import { findLastCorrectionPeak } from '../sim/drawdown';
import { backtestYearsToDataEnd, maxBacktestYears } from '../sim/backtest-bounds';
import { addMonths } from '../sim/calendar';

/** 스펙 §8 "N년 전 프리셋" */
export const YEARS_AGO_PRESETS: readonly number[] = [1, 3, 5, 10, 15, 20];

/**
 * 스펙 §8 "역사적 전고점 프리셋" 중 고정된 6개. "최근 조정 전고점"은 시간이
 * 지날수록 값이 바뀌어야 하는 항목이라 여기 하드코딩하지 않고, 렌더 시점에
 * `findLastCorrectionPeak`(drawdown.ts)로 동적 계산한다(BacktestStartPicker).
 */
export const HISTORICAL_HIGH_PRESETS: readonly { label: string; date: string }[] = [
  { label: '데이터 시작', date: BACKFILL_START },
  { label: '닷컴버블 전고점', date: '2000-03-24' },
  { label: '금융위기 전고점', date: '2007-10-09' },
  { label: '미중 무역분쟁 전고점', date: '2018-09-20' },
  { label: '코로나 전고점', date: '2020-02-19' },
  { label: '긴축 전고점', date: '2021-11-19' },
];

/**
 * 'YYYY-MM-DD'에서 n년을 뺀다. 데이터 시작일 이전으로는 내려가지 않는다.
 * 반환값은 buildBacktestCalendar가 'YYYY-MM'만 쓰므로(url/schema.ts의
 * startMonth 파싱) 일(day) 부분의 윤년 경계 정확도는 결과에 영향을 주지 않는다.
 *
 * 일 단위 재생 구간(RecentYearsPresetButtons의 "최근 N년")이 쓴다. 백테스트
 * 시작월은 대신 backtestStartForYears를 쓴다 — 아래 주석 참고.
 */
export function subtractYears(date: string, years: number): string {
  const year = Number(date.slice(0, 4));
  const rest = date.slice(4);
  const target = `${year - years}${rest}`;
  return target < BACKFILL_START ? BACKFILL_START : target;
}

/**
 * 백테스트 "N년 전" 프리셋의 시작 날짜 — 구간이 데이터 마지막 달에서 끝나도록 역산한다.
 *
 * 백테스트 구간은 시작월부터 월 단위로 세므로, 마지막 날짜에서 그냥 N년을 빼면
 * 시작월이 한 달 이르게 잡혀 구간이 데이터 끝보다 한 달 앞에서 끊긴다
 * (마지막 달 2026-09에서 10년을 빼면 2016-09 → 구간은 2016-09~2026-08).
 * "N년 전"은 "N년 전부터 지금까지"라는 뜻이므로 마지막 달을 고정하고 거꾸로 센다.
 *
 * 마지막 달을 포함해 N×12개월이라 일(day)은 의미가 없다 — 그 달 1일로 고정한다.
 */
export function backtestStartForYears(lastAvailableDate: string, years: number): string {
  const startMonth = addMonths(lastAvailableDate.slice(0, 7), -(years * 12 - 1));
  const target = `${startMonth}-01`;
  return target < BACKFILL_START ? BACKFILL_START : target;
}

/** "조정"의 통상적 정의(고점 대비 -10%)를 임계치로 쓴다 */
const CORRECTION_THRESHOLD = 0.1;

export type HistoricalPeakPreset = { label: string; date: string; years: number };

/**
 * 역사적 전고점 프리셋(HISTORICAL_HIGH_PRESETS) 각각에 "그 시점부터 지금까지 몇
 * 년치 데이터가 있는가"를 채워 넣고, "최근 조정 전고점"을 SPY 기준으로 동적
 * 계산해 함께 낸다.
 *
 * 벤치마크는 항상 SPY다 — 사용자가 고른 노출과 무관하게 둬야 프리셋 날짜가 노출을
 * 바꿀 때마다 흔들리지 않는다. 그래서 이 함수는 노출을 받지 않으며, 노출이 여러
 * 개일 때도 프리셋을 그대로 쓸 수 있다.
 */
export function buildHistoricalPeakPresets({
  dates,
  spy,
  lastAvailableDate,
}: {
  dates: string[];
  spy: Float64Array;
  lastAvailableDate: string;
}): { presets: HistoricalPeakPreset[]; recentCorrection: HistoricalPeakPreset | null } {
  const presets = HISTORICAL_HIGH_PRESETS.map((preset) => ({
    label: preset.label,
    date: preset.date,
    years: backtestYearsToDataEnd(preset.date.slice(0, 7), lastAvailableDate),
  }));

  const peak = findLastCorrectionPeak(dates, spy, CORRECTION_THRESHOLD);
  if (peak === null) return { presets, recentCorrection: null };

  // 1년이 안 되는 전고점은 프리셋으로 내지 않는다 — hasBacktestRange가 막는
  // 구간이라 눌러 봐야 insufficient-data로 착지한다. 이 판정만 온전한 연 단위
  // (maxBacktestYears)로 하고, 실제로 넘기는 연수는 데이터 끝까지 닿는 올림값이다.
  const peakMonth = peak.date.slice(0, 7);
  if (maxBacktestYears(peakMonth, lastAvailableDate) < 1) {
    return { presets, recentCorrection: null };
  }

  return {
    presets,
    recentCorrection: {
      label: '최근 조정 전고점',
      date: peak.date,
      years: backtestYearsToDataEnd(peakMonth, lastAvailableDate),
    },
  };
}
