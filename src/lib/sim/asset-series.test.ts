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
  it('각 월 항목을 date 포맷으로 낸다', () => {
    const ledger: Ledger = {
      syntheticRatio: 0,
      entries: [
        entry({ monthIndex: 0, date: '2026-01-15', contribution: 1_000_000, marketValue: 1_000_000 }),
        entry({ monthIndex: 1, date: '2026-02-15', contribution: 1_000_000, marketValue: 2_000_000 }),
      ],
    };
    const rows = buildAssetSeries(ledger);
    expect(rows).toEqual([
      { date: '2026-01', contributed: 1_000_000, marketValue: 1_000_000 },
      { date: '2026-02', contributed: 2_000_000, marketValue: 2_000_000 },
    ]);
  });

  it('일 정보를 제거하고 YYYY-MM 형식으로 정규화한다', () => {
    const ledger: Ledger = {
      syntheticRatio: 0,
      entries: [
        entry({ monthIndex: 0, date: '2026-01-01', contribution: 500_000, marketValue: 500_000 }),
        entry({ monthIndex: 1, date: '2026-02-28', contribution: 500_000, marketValue: 1_000_000 }),
      ],
    };
    const rows = buildAssetSeries(ledger);
    expect(rows[0].date).toBe('2026-01');
    expect(rows[1].date).toBe('2026-02');
  });

  it('납입 누계는 누적되어야 한다', () => {
    const ledger: Ledger = {
      syntheticRatio: 0,
      entries: [
        entry({ monthIndex: 0, date: '2026-01-15', contribution: 1_000_000, marketValue: 1_000_000 }),
        entry({ monthIndex: 1, date: '2026-02-15', contribution: 2_000_000, marketValue: 4_000_000 }),
        entry({ monthIndex: 2, date: '2026-03-15', contribution: 3_000_000, marketValue: 9_000_000 }),
      ],
    };
    const rows = buildAssetSeries(ledger);
    expect(rows[0].contributed).toBe(1_000_000);
    expect(rows[1].contributed).toBe(3_000_000);
    expect(rows[2].contributed).toBe(6_000_000);
  });
});
