import { describe, it, expect } from 'vitest';
import { stripFx } from './fx';
import { dailyReturns } from '../data/synthetic';

const FX_LEVELS = Float64Array.from([1000, 1010, 1005, 1030, 1020]);
const KRW_LEVELS = Float64Array.from([100, 103, 101, 108, 106]);

const fxReturns = dailyReturns(FX_LEVELS);
const krwReturns = dailyReturns(KRW_LEVELS);

describe('stripFx', () => {
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
