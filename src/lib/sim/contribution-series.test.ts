import { describe, it, expect } from 'vitest';
import { buildContributionSeries } from './contribution-series';
import type { Ledger, MonthEntry } from './types';

function entry(overrides: Partial<MonthEntry>): MonthEntry {
  return {
    monthIndex: 0,
    date: '2026-08-01',
    accountId: 'ISA',
    productId: 'TIGER_NASDAQ100',
    contribution: 0,
    buyPrice: 1,
    sharesBought: 0,
    sharesHeld: 0,
    marketValue: 0,
    costBasis: 0,
    realizedGain: 0,
    dividendReceived: 0,
    fxRate: 1400,
    isSynthetic: false,
    ...overrides,
  };
}

describe('buildContributionSeries', () => {
  it('연말(마지막 달) 원장만 골라 계좌별로 합산한다', () => {
    const ledger: Ledger = {
      entries: [
        entry({ monthIndex: 0, accountId: 'ISA', marketValue: 100 }),
        entry({ monthIndex: 11, accountId: 'ISA', marketValue: 1_000 }),
        entry({ monthIndex: 11, accountId: 'DIRECT_US', marketValue: 500 }),
        entry({ monthIndex: 23, accountId: 'ISA', marketValue: 2_000 }),
        entry({ monthIndex: 23, accountId: 'DIRECT_US', marketValue: 900 }),
      ],
      syntheticRatio: 0,
      overflowRouted: 0,
    };

    const rows = buildContributionSeries(ledger, 2);

    expect(rows).toEqual([
      { yearIndex: 0, values: { ISA: 1_000, DIRECT_US: 500 } },
      { yearIndex: 1, values: { ISA: 2_000, DIRECT_US: 900 } },
    ]);
  });

  it('같은 계좌·연도에 여러 상품이 있으면 합산한다', () => {
    const ledger: Ledger = {
      entries: [
        entry({ monthIndex: 11, accountId: 'ISA', productId: 'A', marketValue: 300 }),
        entry({ monthIndex: 11, accountId: 'ISA', productId: 'B', marketValue: 200 }),
      ],
      syntheticRatio: 0,
      overflowRouted: 0,
    };

    expect(buildContributionSeries(ledger, 1)).toEqual([
      { yearIndex: 0, values: { ISA: 500 } },
    ]);
  });
});
