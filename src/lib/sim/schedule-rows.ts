import { resolveAtYear } from './schedule';
import type { AnchoredSchedule } from './types';

export type ScheduleRow = {
  yearIndex: number;
  value: number;
  isAnchor: boolean;
};

/** 연차별 값과 anchor 여부를 함께 낸다 — 테이블 렌더링이 바로 쓸 수 있는 형태다. */
export function buildScheduleRows(schedule: AnchoredSchedule, years: number): ScheduleRow[] {
  const rows: ScheduleRow[] = [];
  for (let yearIndex = 0; yearIndex < years; yearIndex += 1) {
    rows.push({
      yearIndex,
      value: resolveAtYear(schedule, yearIndex),
      isAnchor: yearIndex in schedule.anchors,
    });
  }
  return rows;
}

export function setAnchor(
  schedule: AnchoredSchedule,
  yearIndex: number,
  value: number,
): AnchoredSchedule {
  return { ...schedule, anchors: { ...schedule.anchors, [yearIndex]: value } };
}

export function clearAnchor(schedule: AnchoredSchedule, yearIndex: number): AnchoredSchedule {
  const { [yearIndex]: _removed, ...rest } = schedule.anchors;
  return { ...schedule, anchors: rest };
}
