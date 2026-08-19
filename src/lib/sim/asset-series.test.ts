import { describe, expect, it } from 'vitest';
import { buildAssetSeries } from './asset-series';
import type { Ledger, MonthEntry } from './types';

function entry(overrides: Partial<MonthEntry>): MonthEntry {
  return {
    monthIndex: 0, date: '2026-01-01', accountId: 'DIRECT_US', productId: 'QQQ',
    contribution: 0, buyPrice: 1, sharesBought: 0, sharesHeld: 0, marketValue: 0,
    costBasis: 0, realizedGain: 0, isSynthetic: false,
    ...overrides,
  };
}

describe('buildAssetSeries', () => {
  it('연말 시점의 납입 누계와 평가액을 낸다', () => {
    const ledger: Ledger = {
      syntheticRatio: 0,
      entries: Array.from({ length: 12 }, (_, i) =>
        entry({ monthIndex: i, contribution: 1_000_000, marketValue: 1_000_000 * (i + 1) }),
      ),
    };
    const rows = buildAssetSeries(ledger, 1);
    expect(rows).toEqual([{ yearIndex: 0, contributed: 12_000_000, marketValue: 12_000_000 }]);
  });
});
