import { describe, it, expect } from 'vitest';
import { resolveAtYear, scaleSchedule } from './schedule';
import type { AnchoredSchedule } from './types';

const PLAIN: AnchoredSchedule = { base: 5_000_000, growthRate: 0.05, anchors: {} };
const WITH_ANCHOR: AnchoredSchedule = {
  base: 5_000_000,
  growthRate: 0.05,
  anchors: { 4: 10_000_000 },
};

describe('resolveAtYear', () => {
  it('anchor가 없으면 base × (1+g)^t 다', () => {
    expect(resolveAtYear(PLAIN, 0)).toBeCloseTo(5_000_000, 6);
    expect(resolveAtYear(PLAIN, 1)).toBeCloseTo(5_250_000, 6);
    expect(resolveAtYear(PLAIN, 3)).toBeCloseTo(5_788_125, 6);
  });

  it('anchor 이전 연도는 anchor의 영향을 받지 않는다', () => {
    for (const year of [0, 1, 2, 3]) {
      expect(resolveAtYear(WITH_ANCHOR, year)).toBeCloseTo(
        resolveAtYear(PLAIN, year),
        6,
      );
    }
  });

  it('anchor 연도는 사용자 입력값 그대로다', () => {
    expect(resolveAtYear(WITH_ANCHOR, 4)).toBeCloseTo(10_000_000, 6);
  });

  it('anchor 이후는 anchor를 새 기준으로 다시 상승한다', () => {
    expect(resolveAtYear(WITH_ANCHOR, 5)).toBeCloseTo(10_500_000, 6);
    expect(resolveAtYear(WITH_ANCHOR, 7)).toBeCloseTo(11_576_250, 6);
  });

  it('anchor가 여럿이면 가장 가까운 이전 것을 쓴다', () => {
    const schedule: AnchoredSchedule = {
      base: 5_000_000,
      growthRate: 0.05,
      anchors: { 4: 10_000_000, 9: 15_000_000 },
    };
    expect(resolveAtYear(schedule, 8)).toBeCloseTo(10_000_000 * 1.05 ** 4, 6);
    expect(resolveAtYear(schedule, 9)).toBeCloseTo(15_000_000, 6);
    expect(resolveAtYear(schedule, 10)).toBeCloseTo(15_750_000, 6);
  });

  it('0년차 anchor는 base를 덮어쓴다', () => {
    const schedule: AnchoredSchedule = {
      base: 5_000_000,
      growthRate: 0.05,
      anchors: { 0: 7_000_000 },
    };
    expect(resolveAtYear(schedule, 0)).toBeCloseTo(7_000_000, 6);
    expect(resolveAtYear(schedule, 2)).toBeCloseTo(7_000_000 * 1.05 ** 2, 6);
  });

  it('anchor를 지우면 이전 기준으로 복귀한다', () => {
    const { 4: _removed, ...rest } = WITH_ANCHOR.anchors;
    const without: AnchoredSchedule = { ...WITH_ANCHOR, anchors: rest };
    expect(resolveAtYear(without, 5)).toBeCloseTo(resolveAtYear(PLAIN, 5), 6);
  });

  it('음수 연차는 0년차로 취급한다', () => {
    expect(resolveAtYear(PLAIN, -1)).toBeCloseTo(5_000_000, 6);
  });
});

describe('scaleSchedule', () => {
  it('base와 모든 anchor에 같은 배수를 적용하고 상승률은 유지한다', () => {
    const scaled = scaleSchedule(WITH_ANCHOR, 1.28);
    expect(scaled.base).toBeCloseTo(6_400_000, 6);
    expect(scaled.anchors[4]).toBeCloseTo(12_800_000, 6);
    expect(scaled.growthRate).toBe(0.05);
  });

  it('원본을 변경하지 않는다', () => {
    scaleSchedule(WITH_ANCHOR, 2);
    expect(WITH_ANCHOR.base).toBe(5_000_000);
    expect(WITH_ANCHOR.anchors[4]).toBe(10_000_000);
  });

  it('스케일링 후의 모든 연도 값이 배수만큼 커진다 — 역산의 단조성 근거', () => {
    const scaled = scaleSchedule(WITH_ANCHOR, 1.3);
    for (const year of [0, 3, 4, 5, 10]) {
      expect(resolveAtYear(scaled, year)).toBeCloseTo(
        resolveAtYear(WITH_ANCHOR, year) * 1.3,
        6,
      );
    }
  });
});
