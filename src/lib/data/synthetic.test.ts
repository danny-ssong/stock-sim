import { describe, it, expect } from 'vitest';
import {
  dailyReturns,
  synthesizeLeveraged,
  synthesizeLeveragedWithRates,
  TRADING_DAYS_PER_YEAR,
} from './synthetic';

describe('dailyReturns', () => {
  it('첫 원소는 NaN이다', () => {
    const r = dailyReturns(Float64Array.from([100, 110]));
    expect(Number.isNaN(r[0])).toBe(true);
  });

  it('일별 수익률을 계산한다', () => {
    const r = dailyReturns(Float64Array.from([100, 110, 99]));
    expect(r[1]).toBeCloseTo(0.1, 10);
    expect(r[2]).toBeCloseTo(-0.1, 10);
  });

  it('직전 값이 NaN이면 결과도 NaN이다', () => {
    const r = dailyReturns(Float64Array.from([Number.NaN, 110, 121]));
    expect(Number.isNaN(r[1])).toBe(true);
    expect(r[2]).toBeCloseTo(0.1, 10);
  });
});

describe('synthesizeLeveraged', () => {
  it('배율 1에 드래그 0이면 원본과 같다', () => {
    const idx = Float64Array.from([Number.NaN, 0.01, -0.02]);
    const out = synthesizeLeveraged(idx, 1, 0);
    expect(out[1]).toBeCloseTo(0.01, 12);
    expect(out[2]).toBeCloseTo(-0.02, 12);
  });

  it('배율을 곱한다', () => {
    const idx = Float64Array.from([Number.NaN, 0.01]);
    const out = synthesizeLeveraged(idx, 3, 0);
    expect(out[1]).toBeCloseTo(0.03, 12);
  });

  it('연간 드래그를 거래일수로 나눠 차감한다', () => {
    const idx = Float64Array.from([Number.NaN, 0]);
    const out = synthesizeLeveraged(idx, 2, 0.0252);
    expect(out[1]).toBeCloseTo(-0.0252 / TRADING_DAYS_PER_YEAR, 12);
  });

  it('변동성 끌림을 재현한다 — 지수는 제자리인데 3배는 손실이다', () => {
    // -10% 후 +11.11% = 지수 원위치
    const idx = Float64Array.from([Number.NaN, -0.1, 1 / 0.9 - 1]);
    const out = synthesizeLeveraged(idx, 3, 0);
    const cumulative = (1 + out[1]) * (1 + out[2]) - 1;
    expect(cumulative).toBeLessThan(-0.06);
    expect(cumulative).toBeGreaterThan(-0.07);
  });

  it('NaN 입력은 NaN을 유지한다', () => {
    const idx = Float64Array.from([Number.NaN, Number.NaN, 0.01]);
    const out = synthesizeLeveraged(idx, 2, 0.01);
    expect(Number.isNaN(out[1])).toBe(true);
    expect(Number.isNaN(out[2])).toBe(false);
  });
});

describe('synthesizeLeveragedWithRates', () => {
  it('배율 1이면 금리와 무관하게 드래그가 스프레드뿐이다', () => {
    const idx = Float64Array.from([Number.NaN, 0.01]);
    const rates = Float64Array.from([Number.NaN, 0.05]);
    const spread = 0.0088;
    const out = synthesizeLeveragedWithRates(idx, rates, 1, spread);
    expect(out[1]).toBeCloseTo(0.01 - spread / TRADING_DAYS_PER_YEAR, 12);
  });

  it('배율 3이고 금리 5%면 드래그가 2 × 0.05 + spread다', () => {
    const idx = Float64Array.from([Number.NaN, 0]);
    const rates = Float64Array.from([Number.NaN, 0.05]);
    const spread = 0.01;
    const out = synthesizeLeveragedWithRates(idx, rates, 3, spread);
    const expectedDrag = (2 * 0.05 + spread) / TRADING_DAYS_PER_YEAR;
    expect(out[1]).toBeCloseTo(-expectedDrag, 12);
  });

  it('금리가 NaN이면 결과도 NaN이다', () => {
    const idx = Float64Array.from([Number.NaN, 0.01]);
    const rates = Float64Array.from([Number.NaN, Number.NaN]);
    const out = synthesizeLeveragedWithRates(idx, rates, 2, 0.01);
    expect(Number.isNaN(out[1])).toBe(true);
  });
});
