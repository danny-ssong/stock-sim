/**
 * 조회 기간이 3년을 넘으면 x축을 1월 기준 연도 라벨만 남기고 월 단위 촘촘함을
 * 포기한다 — 10~20년 구간에서 매달 라벨을 다 보여주면 겹쳐서 읽을 수 없다.
 * 데이터가 항상 'YYYY-MM' 월 단위 1개씩이라는 전제(SimMonth·PortfolioIndexPoint)를 쓴다.
 */
const LONG_RANGE_THRESHOLD_MONTHS = 36;

export function shouldShowYearOnlyTicks(months: number): boolean {
  return months > LONG_RANGE_THRESHOLD_MONTHS;
}

export function januaryTicks(xValues: readonly string[]): string[] {
  return xValues.filter((x) => x.slice(5, 7) === '01');
}

export function formatYearTick(value: string): string {
  return value.slice(0, 4);
}
