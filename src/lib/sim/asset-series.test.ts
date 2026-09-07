import { describe, expect, it } from 'vitest';
import { buildDailyAssetSeries } from './asset-series';
import type { SimCalendar, SimMonth } from './calendar';
import type { LedgerHolding } from './ledger';
import type { Ledger, MonthEntry } from './types';

function month(overrides: Partial<SimMonth>): SimMonth {
  return {
    monthIndex: 0, month: '2026-01', buyDate: '2026-01-01', buyOffset: 0,
    endOffset: 0, endDate: '2026-01-01', yearIndex: 0, calendarYear: 2026, isYearEnd: false,
    ...overrides,
  };
}

function calendar(months: SimMonth[], dailyDates: string[]): SimCalendar {
  return { months, totalDays: dailyDates.length, daysPerYear: 252, mode: 'future', dailyDates };
}

function entry(overrides: Partial<MonthEntry>): MonthEntry {
  return {
    monthIndex: 0, date: '2026-01-01', endDate: '2026-01-01', accountId: 'DIRECT_US', productId: 'QQQ',
    contribution: 0, buyPrice: 1, sharesBought: 0, sharesHeld: 0, marketValue: 0,
    costBasis: 0, realizedGain: 0, isSynthetic: false,
    ...overrides,
  };
}

function holding(levels: number[]): LedgerHolding {
  return {
    accountId: 'DIRECT_US',
    productId: 'QQQ',
    levels: Float64Array.from(levels),
    syntheticFlags: new Uint8Array(levels.length),
  };
}

describe('buildDailyAssetSeries', () => {
  it('달이 하나도 없으면 빈 배열을 낸다', () => {
    const result = buildDailyAssetSeries(
      calendar([], []),
      holding([]),
      { syntheticRatio: 0, entries: [] },
    );
    expect(result).toEqual([]);
  });

  it('보유 좌수를 그 달 내내 고정한 채 매일의 가격으로 평가한다', () => {
    // 1월(3거래일, offset 0~2) → 2월(3거래일, offset 3~5)
    const cal = calendar(
      [
        month({ monthIndex: 0, buyOffset: 0, endOffset: 2 }),
        month({ monthIndex: 1, month: '2026-02', buyOffset: 3, endOffset: 5 }),
      ],
      ['2026-01-02', '2026-01-03', '2026-01-04', '2026-02-02', '2026-02-03', '2026-02-04'],
    );
    const h = holding([10, 11, 9, 12, 13, 14]);
    const ledger: Ledger = {
      syntheticRatio: 0,
      entries: [
        entry({ monthIndex: 0, sharesHeld: 10, costBasis: 100 }),
        entry({ monthIndex: 1, sharesHeld: 25, costBasis: 300 }),
      ],
    };

    expect(buildDailyAssetSeries(cal, h, ledger)).toEqual([
      { date: '2026-01-02', contributed: 100, marketValue: 100 },
      { date: '2026-01-03', contributed: 100, marketValue: 110 },
      { date: '2026-01-04', contributed: 100, marketValue: 90 },
      { date: '2026-02-02', contributed: 300, marketValue: 300 },
      { date: '2026-02-03', contributed: 300, marketValue: 325 },
      { date: '2026-02-04', contributed: 300, marketValue: 350 },
    ]);
  });

  it('시뮬 구간이 dataset 전체가 아니라 오프셋을 넘겨받아 시작해도(백테스트) 첫날부터 정확히 계산한다', () => {
    // buyOffset이 0이 아닌 경우 — holding.levels가 dataset 전체 축을 담고 있는
    // 백테스트 모드를 흉내낸다(engine.ts dailyWindowStart 주석 참고).
    const cal = calendar(
      [month({ monthIndex: 0, buyOffset: 5, endOffset: 6 })],
      ['2026-06-01', '2026-06-02'],
    );
    const h = holding([0, 0, 0, 0, 0, 50, 55]);
    const ledger: Ledger = {
      syntheticRatio: 0,
      entries: [entry({ monthIndex: 0, sharesHeld: 4, costBasis: 200 })],
    };

    expect(buildDailyAssetSeries(cal, h, ledger)).toEqual([
      { date: '2026-06-01', contributed: 200, marketValue: 200 },
      { date: '2026-06-02', contributed: 200, marketValue: 220 },
    ]);
  });
});
