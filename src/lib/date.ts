/**
 * UTC 기준 toISOString()은 KST 00~09시 사이 하루 전 날짜를 준다 — 9시간을
 * 더해 KST 달력 날짜를 구한다.
 * now를 매개변수로 받아 테스트에서 특정 시각을 주입할 수 있게 한다.
 */
export function todayInKst(now: number = Date.now()): string {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  return new Date(now + KST_OFFSET_MS).toISOString().slice(0, 10);
}
