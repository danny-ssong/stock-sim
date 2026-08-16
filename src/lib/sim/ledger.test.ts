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
    weight: 1,
    levels: buildLevels(new Float64Array(CALENDAR.totalDays)),
    syntheticFlags: new Uint8Array(CALENDAR.totalDays),
    dividendYield: 0,
    dividendWithholdingRate: 0,
    ...overrides,
  };
}

const FLAT_SCHEDULE: AnchoredSchedule = {
  base: 1_000_000,
  growthRate: 0,
  anchors: {},
};

const FX = Float64Array.from(new Array(CALENDAR.totalDays).fill(1500));

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
  it('매월 한 번 매수하고 주수가 누적된다', () => {
    const ledger = buildLedger({
      calendar: CALENDAR,
      holdings: [flatHolding()],
      contribution: FLAT_SCHEDULE,
      initialAmount: 0,
      fxLevels: FX,
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
      holdings: [flatHolding()],
      contribution: FLAT_SCHEDULE,
      initialAmount: 10_000_000,
      fxLevels: FX,
    });
    expect(ledger.entries[0].costBasis).toBeCloseTo(11_000_000, 6);
  });

  it('납입액 상승률이 매년 1월이 아니라 연차 경계에서 적용된다', () => {
    const ledger = buildLedger({
      calendar: CALENDAR,
      holdings: [flatHolding()],
      contribution: { base: 1_000_000, growthRate: 0.1, anchors: {} },
      initialAmount: 0,
      fxLevels: FX,
    });
    expect(ledger.entries[11].contribution).toBeCloseTo(1_000_000, 6);
    expect(ledger.entries[12].contribution).toBeCloseTo(1_100_000, 6);
  });

  it('배분 비중대로 계좌별 엔트리를 나눠 만든다', () => {
    const ledger = buildLedger({
      calendar: CALENDAR,
      holdings: [
        flatHolding({ accountId: 'DIRECT_US', productId: 'QQQ', weight: 0.6 }),
        flatHolding({
          accountId: 'ISA',
          productId: 'TIGER_NASDAQ100',
          weight: 0.4,
        }),
      ],
      contribution: FLAT_SCHEDULE,
      initialAmount: 0,
      fxLevels: FX,
    });

    expect(ledger.entries).toHaveLength(48);
    const first = ledger.entries.filter((e) => e.monthIndex === 0);
    expect(first[0].contribution).toBeCloseTo(600_000, 6);
    expect(first[1].contribution).toBeCloseTo(400_000, 6);
  });

  it('수익률이 붙으면 평가액이 취득원가를 넘어선다', () => {
    const returns = new Float64Array(CALENDAR.totalDays);
    returns.fill(0.0005);
    const ledger = buildLedger({
      calendar: CALENDAR,
      holdings: [flatHolding({ levels: buildLevels(returns) })],
      contribution: FLAT_SCHEDULE,
      initialAmount: 0,
      fxLevels: FX,
    });

    const last = ledger.entries[23];
    expect(last.marketValue).toBeGreaterThan(last.costBasis);
  });

  it('납입 상한을 넘기면 그만큼만 납입한다 — ISA 연 2,000만원', () => {
    const ledger = buildLedger({
      calendar: CALENDAR,
      holdings: [flatHolding({ accountId: 'ISA' })],
      contribution: { base: 5_000_000, growthRate: 0, anchors: {} },
      initialAmount: 0,
      fxLevels: FX,
      monthlyCap: (_accountId, _yearIndex, contributedSoFar) =>
        Math.max(0, 20_000_000 - contributedSoFar),
    });

    const firstYear = ledger.entries.filter((e) => e.monthIndex < 12);
    const total = firstYear.reduce((sum, e) => sum + e.contribution, 0);
    expect(total).toBe(20_000_000);
    // 4개월(2,000만)까지 채우고 5개월차부터 0원
    expect(firstYear[3].contribution).toBe(5_000_000);
    expect(firstYear[4].contribution).toBe(0);
  });

  it('전 기간 누적 한도도 함께 본다 — ISA 총 1억원', () => {
    const ledger = buildLedger({
      calendar: buildFutureCalendar({ startMonth: '2026-09', months: 84 }),
      holdings: [flatHolding({ accountId: 'ISA' })],
      contribution: { base: 5_000_000, growthRate: 0, anchors: {} },
      initialAmount: 0,
      fxLevels: Float64Array.from(new Array(3000).fill(1500)),
      monthlyCap: (_accountId, yearIndex, thisYear, total) =>
        Math.min(
          20_000_000 - thisYear,
          Math.min(20_000_000 * (yearIndex + 1), 100_000_000) - total,
        ),
    });

    const total = ledger.entries.reduce((sum, e) => sum + e.contribution, 0);
    expect(total).toBe(100_000_000);
  });

  it('연말에 배당을 계상하고 원천징수분만큼 주수가 줄어든다', () => {
    const ledger = buildLedger({
      calendar: CALENDAR,
      holdings: [
        flatHolding({ dividendYield: 0.02, dividendWithholdingRate: 0.15 }),
      ],
      contribution: FLAT_SCHEDULE,
      initialAmount: 0,
      fxLevels: FX,
    });

    const yearEnd = ledger.entries[11];
    expect(yearEnd.dividendReceived).toBeCloseTo(yearEnd.marketValue * 0.02, 4);

    const nonYearEnd = ledger.entries[10];
    expect(nonYearEnd.dividendReceived).toBe(0);

    // 원천징수 0.02 × 0.15 = 0.3%만큼 주수가 깎인다
    const withoutDrag = buildLedger({
      calendar: CALENDAR,
      holdings: [flatHolding()],
      contribution: FLAT_SCHEDULE,
      initialAmount: 0,
      fxLevels: FX,
    });
    expect(ledger.entries[23].sharesHeld).toBeLessThan(
      withoutDrag.entries[23].sharesHeld,
    );
  });

  it('연말 배당 행의 marketValue는 원천징수 반영 전 스냅샷이다 — sharesHeld × 종가와 어긋난다', () => {
    const holding = flatHolding({
      dividendYield: 0.02,
      dividendWithholdingRate: 0.15,
    });
    const ledger = buildLedger({
      calendar: CALENDAR,
      holdings: [holding],
      contribution: FLAT_SCHEDULE,
      initialAmount: 0,
      fxLevels: FX,
    });

    const yearEndMonth = CALENDAR.months[11];
    const yearEnd = ledger.entries[11];
    const endPriceForThatMonth = holding.levels[yearEndMonth.endOffset];
    const sharesHeldMarketValue = yearEnd.sharesHeld * endPriceForThatMonth;

    // marketValue는 원천징수 반영 "전" 스냅샷을 그대로 기록한다 — 의도된 트레이드오프다.
    // (MonthEntry 한 줄 스키마에서 dividendReceived ≈ marketValue × dividendYield도
    // 함께 지키려면 이 달의 marketValue는 sharesHeld × 종가와 일치할 수 없다.
    // 이 테스트가 실패한다면 그 트레이드오프를 실수로 되돌린 것이니
    // src/lib/sim/types.ts의 MonthEntry.marketValue 주석을 먼저 확인한다.)
    expect(yearEnd.marketValue).not.toBeCloseTo(sharesHeldMarketValue, 4);

    // 어긋나는 크기는 dividendYield × dividendWithholdingRate 만큼으로 유계다
    const discrepancy = yearEnd.marketValue - sharesHeldMarketValue;
    const expectedDiscrepancy =
      yearEnd.marketValue * holding.dividendYield * holding.dividendWithholdingRate;
    expect(discrepancy).toBeCloseTo(expectedDiscrepancy, 4);
  });

  it('환율을 각 엔트리에 기록한다', () => {
    const ledger = buildLedger({
      calendar: CALENDAR,
      holdings: [flatHolding()],
      contribution: FLAT_SCHEDULE,
      initialAmount: 0,
      fxLevels: FX,
    });
    expect(ledger.entries[0].fxRate).toBe(1500);
  });

  it('합성 구간 비율을 낸다 — 배지에 바로 쓸 수 있다', () => {
    const flags = new Uint8Array(CALENDAR.totalDays);
    flags.fill(1, 0, Math.floor(CALENDAR.totalDays / 2));

    const ledger = buildLedger({
      calendar: CALENDAR,
      holdings: [flatHolding({ syntheticFlags: flags })],
      contribution: FLAT_SCHEDULE,
      initialAmount: 0,
      fxLevels: FX,
    });

    expect(ledger.syntheticRatio).toBeGreaterThan(0.4);
    expect(ledger.syntheticRatio).toBeLessThan(0.6);
    expect(ledger.entries[0].isSynthetic).toBe(true);
    expect(ledger.entries[23].isSynthetic).toBe(false);
  });

  it('합성 구간이 없으면 비율이 0이다', () => {
    const ledger = buildLedger({
      calendar: CALENDAR,
      holdings: [flatHolding()],
      contribution: FLAT_SCHEDULE,
      initialAmount: 0,
      fxLevels: FX,
    });
    expect(ledger.syntheticRatio).toBe(0);
  });
});
