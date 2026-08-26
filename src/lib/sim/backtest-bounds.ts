/**
 * 백테스트 기간(년)의 대략적 상한 — dataset을 아직 모르는 시점(URL 파싱, 데이터
 * 로딩 중 UI)에서 쓰는 안전한 기본값이다. 데이터가 실제로 로드되면 그보다
 * 짧을 수 있으므로, dataset을 아는 곳에서는 항상 maxBacktestYears()로 다시
 * 계산해 이 값을 대체한다.
 */
export const MAX_BACKTEST_YEARS = 30;

/**
 * startMonth부터 lastAvailableDate까지 온전히 채울 수 있는 최대 연수(내림).
 *
 * 12개월 미만이면 0을 반환한다 — `input.years`는 항상 1 이상의 정수이므로
 * (url/schema.ts에서 `Math.max(1, Math.min(30, Math.round(...)))`로 클램프됨),
 * 호출부가 `input.years > maxBacktestYears(...)`로 비교하면 0인 경우도 자연히
 * "불가능"으로 걸러진다. 여기서 최소 1로 올림하면 "1년까지는 가능하다"는 거짓
 * 신호를 줘 buildBacktestCalendar가 크래시하는 조합을 통과시키게 된다.
 */
export function maxBacktestYears(startMonth: string, lastAvailableDate: string): number {
  const lastMonth = lastAvailableDate.slice(0, 7);
  const startYear = Number(startMonth.slice(0, 4));
  const startMonthNumber = Number(startMonth.slice(5, 7));
  const lastYear = Number(lastMonth.slice(0, 4));
  const lastMonthNumber = Number(lastMonth.slice(5, 7));

  const totalMonths =
    (lastYear * 12 + (lastMonthNumber - 1)) - (startYear * 12 + (startMonthNumber - 1)) + 1;

  return Math.max(0, Math.floor(totalMonths / 12));
}

/**
 * 백테스트를 **아예 계산할 수 없는** 조합인지 판정한다. 계산할 수 있으면 true.
 *
 * 여기서 막는 것은 `buildBacktestCalendar`(calendar.ts)가 빈 달을 만나 던질
 * 크래시뿐이다 — "기간이 데이터보다 길다"는 크래시가 아니라 조정 가능한
 * 상황이므로 여기서 막지 않는다. `simulate()`가 effectiveYears로 줄이고
 * BACKTEST_YEARS_CLAMPED 경고를 내며(engine.ts), 그 경고는
 * ExposureSummaryCard의 WarningsBanner에 그대로 표시된다.
 *
 * 예전 `backtestYearsShortfall`은 그 경우까지 화면 전체를 대체해, 엔진의
 * soft-clamp 경로를 UI에서 도달 불가능하게 만들고 있었다. 그 하드 게이트 때문에
 * BacktestYearsInput이 years를 URL에 되써야 했고(손실적 클램프), 그게 슬라이더
 * 드래그마다 커밋을 두 배로 만들던 원인이다.
 *
 * 미래 모드는 데이터 범위와 무관하므로 항상 true다.
 */
export function hasBacktestRange(
  input: { mode: 'future' | 'backtest'; startMonth: string },
  dates: readonly string[],
): boolean {
  if (input.mode !== 'backtest') return true;
  if (dates.length === 0) return false;

  // 데이터 첫 월보다 이른 시작월은 첫 달부터 거래일이 없어 크래시한다.
  if (input.startMonth < dates[0].slice(0, 7)) return false;

  // 1년도 채우지 못하면 엔진이 클램프하지 않는다(engine.ts는 available >= 1일 때만
  // 줄인다) — 그대로 두면 buildBacktestCalendar가 빈 달을 만난다.
  return maxBacktestYears(input.startMonth, dates[dates.length - 1]) >= 1;
}
