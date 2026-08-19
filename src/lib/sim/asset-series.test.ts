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

  it('여러 해에 걸쳐 연말 평가액이 갱신된다', () => {
    const ledger: Ledger = {
      syntheticRatio: 0,
      entries: Array.from({ length: 24 }, (_, i) =>
        entry({ monthIndex: i, contribution: 1_000_000, marketValue: 1_000_000 * (i + 1) }),
      ),
    };
    const rows = buildAssetSeries(ledger, 2);
    expect(rows).toEqual([
      { yearIndex: 0, contributed: 12_000_000, marketValue: 12_000_000 },
      { yearIndex: 1, contributed: 24_000_000, marketValue: 24_000_000 },
    ]);
  });

  it('연말 경계에 정확히 일치하는 항목이 없으면 이전 해 평가액을 그대로 이어간다', () => {
    const ledger: Ledger = {
      syntheticRatio: 0,
      entries: [
        // 1년차: 0~11월, 11월(연말)에 평가액 5,000,000 확정
        ...Array.from({ length: 12 }, (_, i) =>
          entry({ monthIndex: i, contribution: 1_000_000, marketValue: 1_000 * (i + 1) }),
        ).map((e, i) => (i === 11 ? { ...e, marketValue: 5_000_000 } : e)),
        // 2년차: 12~21월만 존재, 연말 경계(23월)에는 항목이 없다 —
        // 21월 시점 평가액(9,999,999)이 아니라 1년차 말 평가액(5,000,000)이 유지돼야 한다
        ...Array.from({ length: 10 }, (_, i) =>
          entry({ monthIndex: 12 + i, contribution: 1_000_000, marketValue: 9_999_999 }),
        ),
      ],
    };
    const rows = buildAssetSeries(ledger, 2);
    expect(rows).toEqual([
      { yearIndex: 0, contributed: 12_000_000, marketValue: 5_000_000 },
      { yearIndex: 1, contributed: 22_000_000, marketValue: 5_000_000 },
    ]);
  });
});
