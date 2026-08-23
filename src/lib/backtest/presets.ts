import { BACKFILL_START } from '../data/catalog';
import { findLastCorrectionPeak } from '../sim/drawdown';
import { maxBacktestYears } from '../sim/backtest-bounds';

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
 */
export function subtractYears(date: string, years: number): string {
  const year = Number(date.slice(0, 4));
  const rest = date.slice(4);
  const target = `${year - years}${rest}`;
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
    years: maxBacktestYears(preset.date.slice(0, 7), lastAvailableDate),
  }));

  const peak = findLastCorrectionPeak(dates, spy, CORRECTION_THRESHOLD);
  if (peak === null) return { presets, recentCorrection: null };

  const years = maxBacktestYears(peak.date.slice(0, 7), lastAvailableDate);
  const recentCorrection = years >= 1 ? { label: '최근 조정 전고점', date: peak.date, years } : null;

  return { presets, recentCorrection };
}
