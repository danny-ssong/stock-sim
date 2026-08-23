import type { AnchoredSchedule } from './types';

/**
 * 해당 연차의 값을 구한다.
 * 가장 가까운 이전 anchor를 찾아 거기서부터 상승률을 적용한다.
 * 증액 시점은 매년 1월로 고정이라 그 해 내내 같은 값이다(§5.4).
 */
export function resolveAtYear(
  schedule: AnchoredSchedule,
  yearIndex: number,
): number {
  const year = Math.max(0, yearIndex);

  const anchorYears = Object.keys(schedule.anchors)
    .map(Number)
    .filter((y) => Number.isFinite(y) && y <= year);

  const anchorYear = anchorYears.length > 0 ? Math.max(...anchorYears) : 0;
  const anchorValue = schedule.anchors[anchorYear] ?? schedule.base;

  return anchorValue * (1 + schedule.growthRate) ** (year - anchorYear);
}

/**
 * "거치식"을 별도 상태로 두지 않고 schedule이 완전히 비어 있는지로 판정한다 —
 * base·growthRate·anchors가 전부 0/빈 값이면 정의상 추가 납입이 없으므로
 * 사용자가 어떻게 그 상태에 도달했든 "거치식"으로 보는 게 정확하다.
 */
export function isLumpSum(schedule: AnchoredSchedule): boolean {
  return (
    schedule.base === 0 &&
    schedule.growthRate === 0 &&
    Object.keys(schedule.anchors).length === 0
  );
}
