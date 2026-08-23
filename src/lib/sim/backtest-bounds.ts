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
 * 백테스트 모드에서 startMonth + years를 데이터가 감당하지 못하면 감당 가능한 최대
 * 연수를, 감당하면 null을 반환한다.
 *
 * 이 판정이 buildBacktestCalendar(calendar.ts)가 던질 크래시를 simulate() 호출
 * 전에 막는 유일한 관문이다. 단일 노출 결과 뷰와 노출 비교 뷰가 같은 판정을
 * 공유해야 하므로 훅이 아니라 순수 함수로 둔다.
 *
 * url/schema.ts가 from을 BACKFILL_START로 클램프하지만, 데이터셋의 실제 첫 월이
 * 그보다 늦을 수 있어(상품 조합별 backfill 범위) 여기서 한 번 더 막는다 —
 * 그 경우의 0은 "이 시작월부터는 계산 가능한 기간이 없다"는 정직한 답이다.
 */
export function backtestYearsShortfall(
  input: { mode: 'future' | 'backtest'; startMonth: string; years: number },
  dates: readonly string[],
): number | null {
  if (input.mode !== 'backtest') return null;
  if (dates.length === 0) return 0;

  if (input.startMonth < dates[0].slice(0, 7)) return 0;

  const maxYears = maxBacktestYears(input.startMonth, dates[dates.length - 1]);
  return input.years > maxYears ? maxYears : null;
}
