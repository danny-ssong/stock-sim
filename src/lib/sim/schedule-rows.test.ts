import { describe, it, expect } from 'vitest';
import { buildScheduleRows, clearAnchor, setAnchor } from './schedule-rows';
import type { AnchoredSchedule } from './types';

const SCHEDULE: AnchoredSchedule = {
  base: 5_000_000,
  growthRate: 0.05,
  anchors: { 4: 10_000_000 },
};

describe('buildScheduleRows', () => {
  it('연차마다 resolveAtYear 값과 anchor 여부를 담는다', () => {
    const rows = buildScheduleRows(SCHEDULE, 6);
    expect(rows).toHaveLength(6);
    expect(rows[0]).toEqual({ yearIndex: 0, value: 5_000_000, isAnchor: false });
    expect(rows[4].isAnchor).toBe(true);
    expect(rows[4].value).toBe(10_000_000);
  });
});

describe('setAnchor', () => {
  it('해당 연차를 anchor로 고정한다', () => {
    const next = setAnchor(SCHEDULE, 2, 7_000_000);
    expect(next.anchors[2]).toBe(7_000_000);
    expect(next.anchors[4]).toBe(10_000_000); // 기존 anchor는 유지
  });

  it('원본을 변경하지 않는다', () => {
    setAnchor(SCHEDULE, 2, 7_000_000);
    expect(SCHEDULE.anchors[2]).toBeUndefined();
  });
});

describe('clearAnchor', () => {
  it('해당 연차의 anchor만 지운다', () => {
    const next = clearAnchor(SCHEDULE, 4);
    expect(next.anchors[4]).toBeUndefined();
    expect(next.base).toBe(SCHEDULE.base);
  });

  it('없는 연차를 지워도 안전하다', () => {
    const next = clearAnchor(SCHEDULE, 99);
    expect(next).toEqual(SCHEDULE);
  });
});
