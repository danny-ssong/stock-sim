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
