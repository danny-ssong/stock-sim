import { describe, expect, it } from 'vitest';
import { buildAssetSeries } from './asset-series';
import type { Ledger, MonthEntry } from './types';

function entry(overrides: Partial<MonthEntry>): MonthEntry {
  return {
    monthIndex: 0, date: '2026-01-01', endDate: '2026-01-30', accountId: 'DIRECT_US', productId: 'QQQ',
    contribution: 0, buyPrice: 1, sharesBought: 0, sharesHeld: 0, marketValue: 0,
    costBasis: 0, realizedGain: 0, isSynthetic: false,
    ...overrides,
  };
}

describe('buildAssetSeries', () => {
  it('원장이 비어 있으면 빈 배열을 낸다', () => {
    expect(buildAssetSeries({ syntheticRatio: 0, entries: [] })).toEqual([]);
  });

  it('각 월 항목을 평가 시점(endDate) 기준으로 낸다', () => {
    const ledger: Ledger = {
      syntheticRatio: 0,
      entries: [
        entry({ monthIndex: 0, date: '2026-01-02', endDate: '2026-01-30', contribution: 1_000_000, marketValue: 1_100_000 }),
        entry({ monthIndex: 1, date: '2026-02-02', endDate: '2026-02-27', contribution: 1_000_000, marketValue: 2_400_000 }),
      ],
    };
    expect(buildAssetSeries(ledger)).toEqual([
      { date: '2026-01-02', contributed: 1_000_000, marketValue: 1_000_000 },
      { date: '2026-01-30', contributed: 1_000_000, marketValue: 1_100_000 },
      { date: '2026-02-27', contributed: 2_000_000, marketValue: 2_400_000 },
    ]);
  });

  it('첫 행은 매수 시점이라 평가액이 그날 넣은 금액과 같다', () => {
    // 첫 달에 크게 빠진 구간(전고점 시작)이라도 두 선은 매수 시점에서 붙어 있어야 한다.
    const ledger: Ledger = {
      syntheticRatio: 0,
      entries: [
        entry({ date: '2000-03-24', endDate: '2000-03-31', contribution: 100_000_000, marketValue: 88_000_000 }),
      ],
    };
    const rows = buildAssetSeries(ledger);
    expect(rows[0]).toEqual({ date: '2000-03-24', contributed: 100_000_000, marketValue: 100_000_000 });
    expect(rows[1]).toEqual({ date: '2000-03-31', contributed: 100_000_000, marketValue: 88_000_000 });
  });

  it('납입 누계는 누적되어야 한다', () => {
    const ledger: Ledger = {
      syntheticRatio: 0,
      entries: [
        entry({ monthIndex: 0, date: '2026-01-02', endDate: '2026-01-30', contribution: 1_000_000, marketValue: 1_000_000 }),
        entry({ monthIndex: 1, date: '2026-02-02', endDate: '2026-02-27', contribution: 2_000_000, marketValue: 4_000_000 }),
        entry({ monthIndex: 2, date: '2026-03-02', endDate: '2026-03-31', contribution: 3_000_000, marketValue: 9_000_000 }),
      ],
    };
    const rows = buildAssetSeries(ledger);
    expect(rows.map((row) => row.contributed)).toEqual([
      1_000_000, 1_000_000, 3_000_000, 6_000_000,
    ]);
  });
});
