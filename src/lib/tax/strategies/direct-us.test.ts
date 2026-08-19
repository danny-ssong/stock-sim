import { describe, it, expect } from 'vitest';
import { directUsStrategy } from './direct-us';
import { getTaxConstants } from '../constants';
import type { AccountYearState, TaxContext } from '../types';

const C = getTaxConstants(2026);
const HARVEST: TaxContext = {
  constants: C,
  realizationStrategy: { type: 'annualDeductionHarvest' },
  isaExistingYears: 0,
};
const HOLD: TaxContext = {
  constants: C,
  realizationStrategy: { type: 'holdUntilExit' },
  isaExistingYears: 0,
};

function state(overrides: Partial<AccountYearState> = {}): AccountYearState {
  return {
    yearIndex: 0,
    calendarYear: 2026,
    accountId: 'DIRECT_US',
    productId: 'QQQ',
    marketValue: 100_000_000,
    costBasis: 90_000_000,
    dividendIncome: 0,
    realizedGain: 0,
    heldYears: 1,
    isFinalYear: false,
    ...overrides,
  };
}

describe('양도소득세 (exitTax)', () => {
  it('이익이 정확히 250만원이면 세금이 0원이다', () => {
    const result = directUsStrategy.exitTax(
      state({ marketValue: 92_500_000, costBasis: 90_000_000 }),
      HOLD,
    );
    expect(result.tax).toBe(0);
  });

  it('250만원보다 1원 많으면 세금이 22전이 아니라 0.22원이다', () => {
    const result = directUsStrategy.exitTax(
      state({ marketValue: 92_500_001, costBasis: 90_000_000 }),
      HOLD,
    );
    expect(result.tax).toBeCloseTo(0.22, 6);
  });

  it('손실이면 세금이 0원이다', () => {
    const result = directUsStrategy.exitTax(
      state({ marketValue: 80_000_000, costBasis: 90_000_000 }),
      HOLD,
    );
    expect(result.tax).toBe(0);
    expect(result.realizedGain).toBe(-10_000_000);
  });

  it('스펙 예시를 재현한다 — 양도차익 3억이면 6,545만원', () => {
    const result = directUsStrategy.exitTax(
      state({ marketValue: 300_000_000, costBasis: 0 }),
      HOLD,
    );
    expect(result.tax).toBe(65_450_000);
  });

  it('양도차익은 분류과세라 금융소득에 합산되지 않는다', () => {
    const result = directUsStrategy.exitTax(
      state({ marketValue: 300_000_000, costBasis: 0 }),
      HOLD,
    );
    expect(result.financialIncome).toBe(0);
  });
});

describe('배당 (annualTax)', () => {
  it('해외 배당은 미국 원천징수 15%를 내고 종합과세 대상에 들어간다', () => {
    const result = directUsStrategy.annualTax(
      state({ dividendIncome: 1_000_000 }),
      HOLD,
    );
    expect(result.withheldTax).toBe(150_000);
    expect(result.financialIncome).toBe(1_000_000);
    expect(result.tax).toBe(150_000);
  });

  it('배당이 없으면 세금도 0원이다', () => {
    const result = directUsStrategy.annualTax(state(), HOLD);
    expect(result.tax).toBe(0);
    expect(result.financialIncome).toBe(0);
  });
});

describe('연간 기본공제 소진 전략 (§6.3)', () => {
  it('미실현이익이 250만원을 넘으면 250만원만 실현하고 세금은 0원이다', () => {
    const result = directUsStrategy.annualTax(
      state({ marketValue: 100_000_000, costBasis: 90_000_000 }),
      HARVEST,
    );
    expect(result.realizedGain).toBe(2_500_000);
    expect(result.costBasisStepUp).toBe(2_500_000);
    expect(result.tax).toBe(0);
  });

  it('미실현이익이 250만원에 못 미치면 그만큼만 실현한다', () => {
    const result = directUsStrategy.annualTax(
      state({ marketValue: 91_000_000, costBasis: 90_000_000 }),
      HARVEST,
    );
    expect(result.realizedGain).toBe(1_000_000);
    expect(result.costBasisStepUp).toBe(1_000_000);
    expect(result.tax).toBe(0);
  });

  it('미실현손실이면 실현하지 않는다', () => {
    const result = directUsStrategy.annualTax(
      state({ marketValue: 80_000_000, costBasis: 90_000_000 }),
      HARVEST,
    );
    expect(result.realizedGain).toBe(0);
    expect(result.costBasisStepUp).toBe(0);
  });

  it('holdUntilExit이면 실현하지 않는다', () => {
    const result = directUsStrategy.annualTax(
      state({ marketValue: 100_000_000, costBasis: 90_000_000 }),
      HOLD,
    );
    expect(result.realizedGain).toBe(0);
    expect(result.costBasisStepUp).toBe(0);
  });

  it('30년 누적하면 7,500만원의 이익이 비과세로 넘어가고 절세액은 1,650만원이다', () => {
    // 매년 250만원씩 step-up이 쌓이면 최종 과세이익이 그만큼 줄어든다
    const years = 30;
    const deduction = C.overseasBasicDeduction;
    let costBasis = 100_000_000;

    for (let year = 0; year < years; year += 1) {
      const annual = directUsStrategy.annualTax(
        state({
          yearIndex: year,
          marketValue: costBasis + 50_000_000,
          costBasis,
        }),
        HARVEST,
      );
      costBasis += annual.costBasisStepUp;
    }

    expect(costBasis - 100_000_000).toBe(deduction * years);
    expect(costBasis - 100_000_000).toBe(75_000_000);

    const finalValue = 1_000_000_000;
    const harvested = directUsStrategy.exitTax(
      state({ marketValue: finalValue, costBasis }),
      HARVEST,
    );
    const held = directUsStrategy.exitTax(
      state({ marketValue: finalValue, costBasis: 100_000_000 }),
      HOLD,
    );

    expect(held.tax - harvested.tax).toBe(75_000_000 * 0.22);
    expect(held.tax - harvested.tax).toBe(16_500_000);
  });
});

describe('납입한도와 보유 가능 상품', () => {
  it('해외직투는 납입한도가 없다', () => {
    expect(
      directUsStrategy.contributionLimit(0, { byYear: {}, total: 0 }, HOLD),
    ).toBeNull();
  });

  it('미국 상장 3배 레버리지를 담을 수 있다', () => {
    const resolution = directUsStrategy.canHold('NASDAQ100_3X');
    expect(resolution.available).toBe(true);
    if (resolution.available) expect(resolution.product.id).toBe('TQQQ');
  });
});
