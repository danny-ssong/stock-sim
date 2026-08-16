import { describe, it, expect } from 'vitest';
import {
  calculateComprehensiveTax,
  findCrossoverFinancialIncome,
} from './comprehensive';
import { getTaxConstants } from './constants';

const C = getTaxConstants(2026);

function calc(financialIncome: number, employmentIncome = 60_000_000) {
  return calculateComprehensiveTax(
    {
      calendarYear: 2041,
      yearIndex: 15,
      employmentIncome,
      financialIncome,
      withheldTax: financialIncome * C.domesticDividendRate,
    },
    C,
  );
}

describe('발동 여부', () => {
  it('금융소득이 정확히 2,000만원이면 발동하지 않는다', () => {
    const result = calc(20_000_000);
    expect(result.applicable).toBe(false);
    expect(result.method).toBe('withholdingOnly');
    expect(result.additionalTax).toBe(0);
    expect(result.effectiveRate).toBeCloseTo(0.154, 10);
  });

  it('1원만 초과해도 발동한다', () => {
    expect(calc(20_000_001).applicable).toBe(true);
  });

  it('임계값 바로 위아래에서 세액이 연속이다 — 계단이 생기지 않는다', () => {
    const below = calc(20_000_000).financialTax;
    const above = calc(20_000_001).financialTax;
    expect(Math.abs(above - below)).toBeLessThan(1);
  });
});

describe('비교과세', () => {
  it('연봉 6,000만·금융소득 3,000만이면 A를 채택한다', () => {
    const result = calc(30_000_000);
    expect(result.method).toBe('A');
    // A = 종소세(45,750,000 + 10,000,000) + 2,000만 × 14% = 7,620,000 + 2,800,000
    expect(result.grossTax).toBe(10_420_000);
    // (10,420,000 − 5,602,500) × 1.1
    expect(result.financialTax).toBeCloseTo(5_299_250, 4);
    expect(result.additionalTax).toBeCloseTo(679_250, 4);
    expect(result.effectiveRate).toBeCloseTo(0.1766416, 6);
  });

  it('근로소득이 0원이면 B를 채택하고 추가 부담이 없다', () => {
    const result = calc(30_000_000, 0);
    expect(result.method).toBe('B');
    // B = 0 + 3,000만 × 14% = 4,200,000 → × 1.1 = 4,620,000 = 원천징수액
    expect(result.financialTax).toBeCloseTo(4_620_000, 4);
    expect(result.additionalTax).toBeCloseTo(0, 4);
    expect(result.effectiveRate).toBeCloseTo(0.154, 8);
  });

  it('항상 A와 B 중 큰 쪽을 쓴다', () => {
    for (const income of [25_000_000, 50_000_000, 300_000_000]) {
      for (const salary of [0, 30_000_000, 60_000_000, 150_000_000]) {
        const result = calculateComprehensiveTax(
          {
            calendarYear: 2041,
            yearIndex: 15,
            employmentIncome: salary,
            financialIncome: income,
            withheldTax: 0,
          },
          C,
        );
        expect(result.method === 'A' || result.method === 'B').toBe(true);
      }
    }
  });
});

describe('한 해 몰아팔기 — 세율 폭발', () => {
  it('금융소득 3억이면 실효세율이 15.4%를 크게 상회한다', () => {
    const result = calc(300_000_000);
    expect(result.effectiveRate).toBeGreaterThan(0.35);
    expect(result.financialTax).toBeCloseTo(111_713_250, 2);
    expect(result.topBracketReached).toBe(0.4);
  });

  it('5년에 나눠 팔면 일괄 매도보다 세금이 작다', () => {
    const lumpSum = calc(300_000_000).financialTax;
    const split = calc(60_000_000).financialTax * 5;
    expect(split).toBeLessThan(lumpSum);
    expect(split).toBeCloseTo(66_096_250, 2);
    expect(lumpSum - split).toBeCloseTo(45_617_000, 2);
  });

  it('금액이 커질수록 실효세율이 단조 증가한다', () => {
    const rates = [30_000_000, 60_000_000, 100_000_000, 300_000_000].map(
      (v) => calc(v).effectiveRate,
    );
    for (let i = 1; i < rates.length; i += 1) {
      expect(rates[i]).toBeGreaterThan(rates[i - 1]);
    }
  });
});

describe('과세표준 직접 입력', () => {
  it('직접 입력이 있으면 총급여를 무시한다', () => {
    const withOverride = calculateComprehensiveTax(
      {
        calendarYear: 2041,
        yearIndex: 15,
        employmentIncome: 999_000_000,
        taxBaseOverride: 45_750_000,
        financialIncome: 30_000_000,
        withheldTax: 4_620_000,
      },
      C,
    );
    expect(withOverride.financialTax).toBeCloseTo(calc(30_000_000).financialTax, 4);
  });
});

describe('findCrossoverFinancialIncome', () => {
  it('해외직투 22%와 실효세율이 같아지는 금액을 찾는다', () => {
    const crossover = findCrossoverFinancialIncome({
      employmentIncome: 60_000_000,
      constants: C,
    });
    expect(crossover).toBeGreaterThan(20_000_000);

    const below = calc(crossover * 0.8);
    const above = calc(crossover * 1.2);
    expect(below.effectiveRate).toBeLessThan(0.22);
    expect(above.effectiveRate).toBeGreaterThan(0.22);
  });
});
