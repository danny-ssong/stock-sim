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
 * 스케줄 전체를 비례 스케일링한다.
 *
 * 목표금액 역산에서 base만 움직이면 anchor가 걸린 연도 이후가 전혀 변하지 않아
 * 단조성이 깨진다(§5.7). 상승률·점프 시점·상대적 크기라는 '형태'는 보존하고
 * 수준만 바꾼다.
 */
export function scaleSchedule(
  schedule: AnchoredSchedule,
  factor: number,
): AnchoredSchedule {
  const anchors: Record<number, number> = {};
  for (const [year, value] of Object.entries(schedule.anchors)) {
    anchors[Number(year)] = value * factor;
  }

  return {
    base: schedule.base * factor,
    growthRate: schedule.growthRate,
    anchors,
  };
}
