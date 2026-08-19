import { describe, it, expect } from 'vitest';
import { buildLedger, buildLevels, type LedgerHolding } from './ledger';
import { buildFutureCalendar } from './calendar';
import type { AnchoredSchedule } from './types';

const CALENDAR = buildFutureCalendar({ startMonth: '2026-09', months: 24 });

/** 수익률 0인 평탄한 시계열 — 납입·주수 계산만 검증할 때 쓴다 */
function flatHolding(overrides: Partial<LedgerHolding> = {}): LedgerHolding {
  return {
    accountId: 'DIRECT_US',
    productId: 'QQQ',
    levels: buildLevels(new Float64Array(CALENDAR.totalDays)),
    syntheticFlags: new Uint8Array(CALENDAR.totalDays),
    ...overrides,
  };
}

const FLAT_SCHEDULE: AnchoredSchedule = {
  base: 1_000_000,
  growthRate: 0,
  anchors: {},
};

describe('buildLevels', () => {
  it('1에서 시작해 수익률을 복리로 누적한다', () => {
    const levels = buildLevels(Float64Array.from([0.1, 0.1, -0.5]));
    expect(levels[0]).toBeCloseTo(1.1, 12);
    expect(levels[1]).toBeCloseTo(1.21, 12);
    expect(levels[2]).toBeCloseTo(0.605, 12);
  });

  it('NaN 수익률은 변동 없음으로 취급한다 — 레벨이 NaN으로 오염되지 않는다', () => {
    const levels = buildLevels(Float64Array.from([0.1, Number.NaN, 0.1]));
    expect(levels[1]).toBeCloseTo(1.1, 12);
    expect(levels[2]).toBeCloseTo(1.21, 12);
  });
});

describe('buildLedger', () => {
  it('배당 없이 매수·평가액만 쌓인다', () => {
    const calendar = buildFutureCalendar({ startMonth: '2026-01', months: 12 });
    const levels = new Float64Array(calendar.totalDays + 1).fill(1);
    const ledger = buildLedger({
      calendar,
      holding: { accountId: 'DIRECT_US', productId: 'QQQ', levels, syntheticFlags: new Uint8Array(levels.length) },
      contribution: { base: 1_000_000, growthRate: 0, anchors: {} },
      initialAmount: 0,
    });
    expect(ledger.entries).toHaveLength(12);
  });

  it('매월 한 번 매수하고 주수가 누적된다', () => {
    const ledger = buildLedger({
      calendar: CALENDAR,
      holding: flatHolding(),
      contribution: FLAT_SCHEDULE,
      initialAmount: 0,
    });

    expect(ledger.entries).toHaveLength(24);
    expect(ledger.entries[0].contribution).toBe(1_000_000);
    expect(ledger.entries[0].sharesHeld).toBeCloseTo(1_000_000, 6);
    expect(ledger.entries[23].sharesHeld).toBeCloseTo(24_000_000, 6);
    expect(ledger.entries[23].costBasis).toBeCloseTo(24_000_000, 6);
    expect(ledger.entries[23].marketValue).toBeCloseTo(24_000_000, 6);
  });

  it('초기 원금은 0개월차에 함께 매수된다', () => {
    const ledger = buildLedger({
      calendar: CALENDAR,
      holding: flatHolding(),
      contribution: FLAT_SCHEDULE,
      initialAmount: 10_000_000,
    });
    expect(ledger.entries[0].costBasis).toBeCloseTo(11_000_000, 6);
  });

  it('납입액 상승률이 매년 1월이 아니라 연차 경계에서 적용된다', () => {
    const ledger = buildLedger({
      calendar: CALENDAR,
      holding: flatHolding(),
      contribution: { base: 1_000_000, growthRate: 0.1, anchors: {} },
      initialAmount: 0,
    });
    expect(ledger.entries[11].contribution).toBeCloseTo(1_000_000, 6);
    expect(ledger.entries[12].contribution).toBeCloseTo(1_100_000, 6);
  });

  it('수익률이 붙으면 평가액이 취득원가를 넘어선다', () => {
    const returns = new Float64Array(CALENDAR.totalDays);
    returns.fill(0.0005);
    const ledger = buildLedger({
      calendar: CALENDAR,
      holding: flatHolding({ levels: buildLevels(returns) }),
      contribution: FLAT_SCHEDULE,
      initialAmount: 0,
    });

    const last = ledger.entries[23];
    expect(last.marketValue).toBeGreaterThan(last.costBasis);
  });

  it('합성 구간 비율을 낸다 — 배지에 바로 쓸 수 있다', () => {
    const flags = new Uint8Array(CALENDAR.totalDays);
    flags.fill(1, 0, Math.floor(CALENDAR.totalDays / 2));

    const ledger = buildLedger({
      calendar: CALENDAR,
      holding: flatHolding({ syntheticFlags: flags }),
      contribution: FLAT_SCHEDULE,
      initialAmount: 0,
    });

    expect(ledger.syntheticRatio).toBeGreaterThan(0.4);
    expect(ledger.syntheticRatio).toBeLessThan(0.6);
    expect(ledger.entries[0].isSynthetic).toBe(true);
    expect(ledger.entries[23].isSynthetic).toBe(false);
  });

  it('합성 구간이 없으면 비율이 0이다', () => {
    const ledger = buildLedger({
      calendar: CALENDAR,
      holding: flatHolding(),
      contribution: FLAT_SCHEDULE,
      initialAmount: 0,
    });
    expect(ledger.syntheticRatio).toBe(0);
  });
});
