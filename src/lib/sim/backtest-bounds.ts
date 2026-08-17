/**
 * startMonth부터 lastAvailableDate까지 온전히 채울 수 있는 최대 연수(내림).
 *
 * 12개월 미만이면 0을 반환한다 — `input.years`는 항상 1 이상의 정수이므로
 * (`z.coerce`로 클램프됨, url/schema.ts), 호출부가 `input.years > maxBacktestYears(...)`로
 * 비교하면 0인 경우도 자연히 "불가능"으로 걸러진다. 여기서 최소 1로 올림하면
 * "1년까지는 가능하다"는 거짓 신호를 줘 buildBacktestCalendar가 크래시하는
 * 조합을 통과시키게 된다.
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
