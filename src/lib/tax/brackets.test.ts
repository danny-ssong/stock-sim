import { describe, it, expect } from 'vitest';
import { progressiveTax, topBracketRate } from './brackets';
import { getTaxConstants } from './constants';

const BRACKETS = getTaxConstants(2026).comprehensive.incomeTaxBrackets;

/** 구간별 적분 — 누진공제 방식이 맞는지 대조하는 독립 구현 */
function integrateTax(taxBase: number): number {
  let tax = 0;
  let lower = 0;
  for (const bracket of BRACKETS) {
    if (taxBase <= lower) break;
    tax += (Math.min(taxBase, bracket.upTo) - lower) * bracket.rate;
    lower = bracket.upTo;
  }
  return tax;
}

describe('progressiveTax', () => {
  it('8개 구간 경계에서 누진공제 방식과 구간별 적분이 일치한다', () => {
    const boundaries = [
      14_000_000, 50_000_000, 88_000_000, 150_000_000, 300_000_000,
      500_000_000, 1_000_000_000, 2_000_000_000,
    ];
    for (const taxBase of boundaries) {
      expect(progressiveTax(taxBase, BRACKETS)).toBeCloseTo(
        integrateTax(taxBase),
        4,
      );
    }
  });

  it('구간 내부 임의 값에서도 두 방식이 일치한다', () => {
    for (const taxBase of [1, 7_000_000, 45_750_000, 107_956_000, 325_750_000]) {
      expect(progressiveTax(taxBase, BRACKETS)).toBeCloseTo(
        integrateTax(taxBase),
        4,
      );
    }
  });

  it('국세청 표의 대표값을 재현한다', () => {
    // 5,000만원: 50,000,000 × 15% − 1,260,000
    expect(progressiveTax(50_000_000, BRACKETS)).toBe(6_240_000);
    // 1억원: 100,000,000 × 35% − 15,440,000
    expect(progressiveTax(100_000_000, BRACKETS)).toBe(19_560_000);
  });

  it('과세표준이 0 이하면 0이다', () => {
    expect(progressiveTax(0, BRACKETS)).toBe(0);
    expect(progressiveTax(-1_000_000, BRACKETS)).toBe(0);
  });
});

describe('topBracketRate', () => {
  it('도달한 최고 구간의 세율을 준다', () => {
    expect(topBracketRate(10_000_000, BRACKETS)).toBe(0.06);
    expect(topBracketRate(50_000_000, BRACKETS)).toBe(0.15);
    expect(topBracketRate(50_000_001, BRACKETS)).toBe(0.24);
    expect(topBracketRate(5_000_000_000, BRACKETS)).toBe(0.45);
  });
});

describe('getTaxConstants', () => {
  it('2026년 확정값을 준다', () => {
    const c = getTaxConstants(2026);
    expect(c.overseasCapitalGainsRate).toBe(0.22);
    expect(c.overseasBasicDeduction).toBe(2_500_000);
    expect(c.domesticDividendRate).toBe(0.154);
    expect(c.isa.annualLimit).toBe(20_000_000);
    expect(c.isa.totalLimit).toBe(100_000_000);
    expect(c.isa.taxFreeIncome).toBe(2_000_000);
    expect(c.isa.excessRate).toBe(0.099);
    expect(c.isa.lockupYears).toBe(3);
    expect(c.comprehensive.threshold).toBe(20_000_000);
    expect(c.comprehensive.separateRate).toBe(0.14);
    expect(c.comprehensive.localTaxRate).toBe(0.1);
    expect(c.comprehensive.basicDeduction).toBe(1_500_000);
  });

  it('테이블에 없는 미래 연도는 가장 최근 연도의 값을 쓴다', () => {
    expect(getTaxConstants(2045)).toEqual(getTaxConstants(2026));
  });

  it('테이블보다 이른 연도는 가장 이른 연도의 값을 쓴다', () => {
    expect(getTaxConstants(1999)).toEqual(getTaxConstants(2026));
  });

  it('누진세율 테이블의 마지막 구간은 상한이 없다', () => {
    const brackets = getTaxConstants(2026).comprehensive.incomeTaxBrackets;
    expect(brackets[brackets.length - 1].upTo).toBe(Number.POSITIVE_INFINITY);
  });
});
