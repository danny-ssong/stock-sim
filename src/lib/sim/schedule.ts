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
 * 스케줄의 기준점을 byYears만큼 뒤로 옮긴다 — 옮긴 스케줄의 0년차가
 * 원본의 byYears년차와 같은 값을 낸다.
 *
 * 시뮬을 두 구간으로 쪼갤 때(§5.8의 계좌 간 이전) 뒤 구간의 연차가 0부터
 * 다시 시작하므로, 연 근로소득처럼 연차에 매달린 스케줄을 그대로 물려주면
 * 뒤 구간이 첫해 소득으로 되돌아간다. 상승률과 남은 anchor의 형태는 보존한다.
 */
export function shiftSchedule(
  schedule: AnchoredSchedule,
  byYears: number,
): AnchoredSchedule {
  const anchors: Record<number, number> = {};
  for (const [year, value] of Object.entries(schedule.anchors)) {
    const shifted = Number(year) - byYears;
    // 0년차 anchor는 base가 이미 그 값을 담으므로 다시 넣지 않는다
    if (shifted > 0) anchors[shifted] = value;
  }

  return {
    base: resolveAtYear(schedule, byYears),
    growthRate: schedule.growthRate,
    anchors,
  };
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
