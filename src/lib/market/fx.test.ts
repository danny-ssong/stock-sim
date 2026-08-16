import { describe, it, expect } from 'vitest';
import {
  stripFx,
  applyFx,
  buildAssumedFxReturns,
  buildFxLevels,
  describeFxAssumption,
} from './fx';
import { dailyReturns } from '../data/synthetic';

const FX_LEVELS = Float64Array.from([1000, 1010, 1005, 1030, 1020]);
const KRW_LEVELS = Float64Array.from([100, 103, 101, 108, 106]);

const fxReturns = dailyReturns(FX_LEVELS);
const krwReturns = dailyReturns(KRW_LEVELS);

describe('stripFx / applyFx', () => {
  it('되벗긴 뒤 같은 환율을 다시 씌우면 원본이 나온다 — 왕복 항등', () => {
    const local = stripFx(krwReturns, fxReturns);
    const restored = applyFx(local, fxReturns);

    for (let i = 1; i < restored.length; i += 1) {
      expect(restored[i]).toBeCloseTo(krwReturns[i], 12);
    }
  });

  it('환율이 오른 만큼 현지통화 수익률은 원화 수익률보다 낮다', () => {
    const local = stripFx(krwReturns, fxReturns);
    // 1일차: 원화 +3%, 환율 +1% → 현지 (1.03/1.01 − 1) ≈ +1.98%
    expect(local[1]).toBeCloseTo(1.03 / 1.01 - 1, 12);
    expect(local[1]).toBeLessThan(krwReturns[1]);
  });

  it('환율이 그대로면 현지 수익률과 원화 수익률이 같다', () => {
    const flat = Float64Array.from([Number.NaN, 0, 0, 0, 0]);
    const local = stripFx(krwReturns, flat);
    for (let i = 1; i < local.length; i += 1) {
      expect(local[i]).toBeCloseTo(krwReturns[i], 12);
    }
  });

  it('입력 중 하나라도 NaN이면 NaN을 낸다 — 조용히 0으로 채우지 않는다', () => {
    expect(Number.isNaN(stripFx(krwReturns, fxReturns)[0])).toBe(true);
  });
});

describe('buildAssumedFxReturns', () => {
  const indices = Int32Array.from([1, 2, 3, 4, 1, 2]);

  it('historicalPath는 참조 인덱스의 실제 환율 수익률을 그대로 쓴다', () => {
    const assumed = buildAssumedFxReturns({
      assumption: { type: 'historicalPath' },
      historicalFxReturns: fxReturns,
      pathIndices: indices,
      totalDays: indices.length,
      daysPerYear: 252,
    });
    expect(Array.from(assumed)).toEqual(
      Array.from(indices).map((i) => fxReturns[i]),
    );
  });

  it('fixed는 전 구간 0이다 — 환율이 움직이지 않는다', () => {
    const assumed = buildAssumedFxReturns({
      assumption: { type: 'fixed', rate: 1548 },
      historicalFxReturns: fxReturns,
      pathIndices: indices,
      totalDays: indices.length,
      daysPerYear: 252,
    });
    expect(Array.from(assumed)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('drift는 연 X%가 정확히 복리로 붙는 상수 수익률이다', () => {
    const daysPerYear = 252;
    const assumed = buildAssumedFxReturns({
      assumption: { type: 'drift', annualRate: 0.02 },
      historicalFxReturns: fxReturns,
      pathIndices: null,
      totalDays: daysPerYear,
      daysPerYear,
    });
    expect(assumed).toHaveLength(daysPerYear);

    let compounded = 1;
    for (const r of assumed) compounded *= 1 + r;
    expect(compounded).toBeCloseTo(1.02, 10);
  });

  it('CAGR 모드(pathIndices 없음)에서 historicalPath를 요구하면 던진다', () => {
    expect(() =>
      buildAssumedFxReturns({
        assumption: { type: 'historicalPath' },
        historicalFxReturns: fxReturns,
        pathIndices: null,
        totalDays: 10,
        daysPerYear: 252,
      }),
    ).toThrow(/경로/);
  });
});

describe('buildFxLevels', () => {
  it('시작 환율에서 가정된 수익률로 복리 누적한다', () => {
    const levels = buildFxLevels(Float64Array.from([0.01, 0.01]), 1000);
    expect(levels[0]).toBeCloseTo(1010, 8);
    expect(levels[1]).toBeCloseTo(1020.1, 8);
  });

  it('fixed 가정에서는 전 구간 같은 환율이다', () => {
    const levels = buildFxLevels(Float64Array.from([0, 0, 0]), 1548);
    expect(Array.from(levels)).toEqual([1548, 1548, 1548]);
  });
});

describe('describeFxAssumption', () => {
  it('어떤 가정이 쓰였는지 숨기지 않는다 (§13)', () => {
    expect(describeFxAssumption({ type: 'fixed', rate: 1548 })).toContain('1,548');
    expect(describeFxAssumption({ type: 'historicalPath' })).toContain('실제');
    expect(describeFxAssumption({ type: 'drift', annualRate: 0.02 })).toContain('2');
  });
});
