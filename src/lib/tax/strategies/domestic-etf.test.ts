import { describe, it, expect } from 'vitest';
import { domesticEtfStrategy, analyzeDomesticSale } from './domestic-etf';
import { getTaxConstants } from '../constants';
import type { AccountYearState, TaxContext } from '../types';

const C = getTaxConstants(2026);
const CTX: TaxContext = {
  constants: C,
  realizationStrategy: { type: 'holdUntilExit' },
  isaExistingYears: 0,
};

function state(overrides: Partial<AccountYearState> = {}): AccountYearState {
  return {
    yearIndex: 0,
    calendarYear: 2026,
    accountId: 'DOMESTIC_ETF',
    productId: 'TIGER_NASDAQ100',
    marketValue: 100_000_000,
    costBasis: 90_000_000,
    dividendIncome: 0,
    realizedGain: 0,
    heldYears: 1,
    isFinalYear: false,
    ...overrides,
  };
}

describe('분배금 (annualTax)', () => {
  it('분배금은 15.4% 원천징수되고 금융소득에 합산된다', () => {
    const result = domesticEtfStrategy.annualTax(
      state({ dividendIncome: 3_000_000 }),
      CTX,
    );
    expect(result.withheldTax).toBeCloseTo(462_000, 6);
    expect(result.financialIncome).toBe(3_000_000);
  });

  it('보유만 하고 있으면 매매차익에는 과세하지 않는다', () => {
    const result = domesticEtfStrategy.annualTax(state(), CTX);
    expect(result.tax).toBe(0);
    expect(result.financialIncome).toBe(0);
  });
});

describe('매도 (exitTax)', () => {
  it('매매차익 전액이 그 해 배당소득으로 계상된다', () => {
    const result = domesticEtfStrategy.exitTax(
      state({ marketValue: 300_000_000, costBasis: 0 }),
      CTX,
    );
    expect(result.financialIncome).toBe(300_000_000);
    expect(result.withheldTax).toBeCloseTo(46_200_000, 4);
  });

  it('손실이면 과세도 합산도 없다 — 손익통산 불가라 이익 종목에는 그대로 과세된다', () => {
    const result = domesticEtfStrategy.exitTax(
      state({ marketValue: 80_000_000, costBasis: 90_000_000 }),
      CTX,
    );
    expect(result.tax).toBe(0);
    expect(result.financialIncome).toBe(0);
    expect(result.notes.some((n) => n.includes('손익통산'))).toBe(true);
  });

  it('과표기준가를 반영하지 않아 세금이 과대 추정된다는 사실을 notes에 남긴다', () => {
    const result = domesticEtfStrategy.exitTax(
      state({ marketValue: 300_000_000, costBasis: 0 }),
      CTX,
    );
    expect(result.notes.some((n) => n.includes('과표기준가'))).toBe(true);
  });
});

describe('한 해 몰아팔기 분석 (analyzeDomesticSale)', () => {
  const analysis = analyzeDomesticSale({
    capitalGain: 300_000_000,
    employmentIncome: 60_000_000,
    constants: C,
  });

  it('실효세율이 원천징수율 15.4%를 크게 상회한다', () => {
    expect(analysis.effectiveRate).toBeGreaterThan(0.35);
    expect(analysis.tax).toBeCloseTo(111_713_250, 2);
  });

  it('도달 구간과 최악 시나리오를 함께 낸다', () => {
    expect(analysis.topBracketReached).toBe(0.4);
    expect(analysis.worstCaseTax).toBe(148_500_000);
  });

  it('같은 금액의 해외직투는 22% 고정이다', () => {
    expect(analysis.overseasEquivalentTax).toBe(65_450_000);
    expect(analysis.tax - analysis.overseasEquivalentTax).toBeGreaterThan(
      40_000_000,
    );
  });

  it('5년 분할 매도 절감액을 계산한다', () => {
    expect(analysis.splitYears).toBe(5);
    expect(analysis.splitSaleSaving).toBeCloseTo(45_617_000, 2);
  });

  it('역전 금액을 함께 낸다 — 이 금액을 넘으면 해외직투가 유리하다', () => {
    expect(analysis.crossoverAmount).toBeGreaterThan(20_000_000);
    expect(analysis.crossoverAmount).toBeLessThan(300_000_000);
  });

  it('분할 연수를 바꿀 수 있고, 나눠 팔수록 절감액이 커진다', () => {
    const three = analyzeDomesticSale({
      capitalGain: 300_000_000,
      employmentIncome: 60_000_000,
      splitYears: 3,
      constants: C,
    });
    expect(three.splitSaleSaving).toBeLessThan(analysis.splitSaleSaving);
  });
});
