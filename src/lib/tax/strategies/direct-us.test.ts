import { describe, expect, it } from 'vitest';
import { directUsStrategy } from './direct-us';
import { getTaxConstants } from '../constants';
import type { AccountYearState, TaxContext } from '../types';

const C = getTaxConstants(2026);
const ctx: TaxContext = { constants: C };

function state(overrides: Partial<AccountYearState> = {}): AccountYearState {
  return {
    yearIndex: 0,
    calendarYear: 2026,
    accountId: 'DIRECT_US',
    productId: 'QQQ',
    marketValue: 100_000_000,
    costBasis: 90_000_000,
    realizedGain: 0,
    heldYears: 1,
    isFinalYear: false,
    ...overrides,
  };
}

describe('양도소득세 (exitTax)', () => {
  it('이익이 정확히 250만원이면 세금이 0원이다', () => {
    const result = directUsStrategy.exitTax(
      state({ marketValue: 92_500_000, costBasis: 90_000_000, isFinalYear: true }),
      ctx,
    );
    expect(result.tax).toBe(0);
  });

  it('250만원보다 1원 많으면 세금이 22전이 아니라 0.22원이다', () => {
    const result = directUsStrategy.exitTax(
      state({ marketValue: 92_500_001, costBasis: 90_000_000, isFinalYear: true }),
      ctx,
    );
    expect(result.tax).toBeCloseTo(0.22, 6);
  });

  it('손실이면 세금이 0원이다', () => {
    const result = directUsStrategy.exitTax(
      state({ marketValue: 80_000_000, costBasis: 90_000_000, isFinalYear: true }),
      ctx,
    );
    expect(result.tax).toBe(0);
    expect(result.realizedGain).toBe(-10_000_000);
  });

  it('스펙 예시를 재현한다 — 양도차익 3억이면 6,545만원', () => {
    const result = directUsStrategy.exitTax(
      state({ marketValue: 300_000_000, costBasis: 0, isFinalYear: true }),
      ctx,
    );
    expect(result.tax).toBe(65_450_000);
  });

  it('양도차익은 분류과세라 금융소득에 합산되지 않는다', () => {
    const result = directUsStrategy.exitTax(
      state({ marketValue: 300_000_000, costBasis: 0, isFinalYear: true }),
      ctx,
    );
    expect(result.financialIncome).toBe(0);
  });
});

describe('directUsStrategy.annualTax', () => {
  it('마지막 해가 아니면 미실현이익 범위에서 250만원까지 실현해 취득원가를 올리고 세금은 0이다', () => {
    const result = directUsStrategy.annualTax(
      state({ marketValue: 10_000_000, costBasis: 5_000_000, isFinalYear: false }),
      ctx,
    );
    expect(result.tax).toBe(0);
    expect(result.costBasisStepUp).toBe(2_500_000);
    expect(result.realizedGain).toBe(2_500_000);
  });

  it('마지막 해에는 공제를 소진하지 않는다 — exitTax가 한 번만 공제를 적용해야 하므로', () => {
    const result = directUsStrategy.annualTax(
      state({ marketValue: 10_000_000, costBasis: 5_000_000, isFinalYear: true }),
      ctx,
    );
    expect(result.costBasisStepUp).toBe(0);
    expect(result.realizedGain).toBe(0);
  });

  it('미실현손실이면 실현하지 않는다', () => {
    const result = directUsStrategy.annualTax(
      state({ marketValue: 4_000_000, costBasis: 5_000_000, isFinalYear: false }),
      ctx,
    );
    expect(result.costBasisStepUp).toBe(0);
  });

  it('미실현이익이 250만원에 못 미치면 그만큼만 실현한다', () => {
    const result = directUsStrategy.annualTax(
      state({ marketValue: 91_000_000, costBasis: 90_000_000, isFinalYear: false }),
      ctx,
    );
    expect(result.realizedGain).toBe(1_000_000);
    expect(result.costBasisStepUp).toBe(1_000_000);
    expect(result.tax).toBe(0);
  });
});

describe('directUsStrategy.exitTax', () => {
  it('이익이 기본공제 250만원 이하면 세금이 0이다', () => {
    const result = directUsStrategy.exitTax(
      state({ marketValue: 7_500_000, costBasis: 5_000_000, isFinalYear: true }),
      ctx,
    );
    expect(result.tax).toBe(0);
  });

  it('기본공제를 넘는 이익에 22%가 붙는다', () => {
    const result = directUsStrategy.exitTax(
      state({ marketValue: 10_000_000, costBasis: 5_000_000, isFinalYear: true }),
      ctx,
    );
    // 이익 500만 - 공제 250만 = 250만, ×22% = 55만
    expect(result.tax).toBe(550_000);
  });
});

describe('연간 기본공제 소진이 exitTax 세금을 줄인다 (§6.3)', () => {
  it('30년 누적하면 7,500만원의 이익이 비과세로 넘어가고 절세액은 1,650만원이다', () => {
    // 매년 250만원씩 step-up이 쌓이면 최종 과세이익이 그만큼 줄어든다.
    // isFinalYear가 false인 한 매년 annualTax가 자동으로 소진하므로
    // 별도의 realizationStrategy 토글 없이도 동일한 결과가 나와야 한다.
    const years = 30;
    const deduction = C.overseasBasicDeduction;
    let costBasis = 100_000_000;

    for (let year = 0; year < years; year += 1) {
      const annual = directUsStrategy.annualTax(
        state({
          yearIndex: year,
          marketValue: costBasis + 50_000_000,
          costBasis,
          isFinalYear: false,
        }),
        ctx,
      );
      costBasis += annual.costBasisStepUp;
    }

    expect(costBasis - 100_000_000).toBe(deduction * years);
    expect(costBasis - 100_000_000).toBe(75_000_000);

    const finalValue = 1_000_000_000;
    const harvested = directUsStrategy.exitTax(
      state({ marketValue: finalValue, costBasis, isFinalYear: true }),
      ctx,
    );
    // step-up이 전혀 없었다면(취득원가가 원금 그대로라면) 얼마나 더 냈을지 비교한다.
    const notHarvested = directUsStrategy.exitTax(
      state({ marketValue: finalValue, costBasis: 100_000_000, isFinalYear: true }),
      ctx,
    );

    expect(notHarvested.tax - harvested.tax).toBe(75_000_000 * 0.22);
    expect(notHarvested.tax - harvested.tax).toBe(16_500_000);
  });
});

describe('납입한도와 보유 가능 상품', () => {
  it('해외직투는 납입한도가 없다', () => {
    expect(
      directUsStrategy.contributionLimit(0, { byYear: {}, total: 0 }, ctx),
    ).toBeNull();
  });

  it('미국 상장 3배 레버리지를 담을 수 있다', () => {
    const resolution = directUsStrategy.canHold('NASDAQ100_3X');
    expect(resolution.available).toBe(true);
    if (resolution.available) expect(resolution.product.id).toBe('TQQQ');
  });
});
