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
      monthlyCap: ({ yearIndex, contributedByYear }) =>
        Math.max(0, 20_000_000 - (contributedByYear[yearIndex] ?? 0)),
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
      monthlyCap: ({ yearIndex, contributedByYear, contributedTotal }) =>
        Math.min(
          20_000_000 - (contributedByYear[yearIndex] ?? 0),
          Math.min(20_000_000 * (yearIndex + 1), 100_000_000) - contributedTotal,
        ),
    });

    const total = ledger.entries.reduce((sum, e) => sum + e.contribution, 0);
    expect(total).toBe(100_000_000);
  });

  it('납입 이력을 연차별로 넘긴다 — 지나간 연차는 확정 총액, 진행 중인 연차는 누계다', () => {
    // 연 10%씩 오르는 납입액. 연차마다 총액이 달라야 byYear가 진짜 값을 담는지 알 수 있다.
    const histories: Array<{
      yearIndex: number;
      byYear: Readonly<Record<number, number>>;
    }> = [];

    const ledger = buildLedger({
      calendar: buildFutureCalendar({ startMonth: '2026-09', months: 36 }),
      holdings: [flatHolding({ accountId: 'ISA' })],
      contribution: { base: 1_000_000, growthRate: 0.1, anchors: {} },
      initialAmount: 0,
      fxLevels: Float64Array.from(new Array(1200).fill(1500)),
      monthlyCap: ({ yearIndex, contributedByYear }) => {
        histories.push({ yearIndex, byYear: { ...contributedByYear } });
        return null;
      },
    });

    const contributedIn = (yearIndex: number): number =>
      ledger.entries
        .filter((e) => Math.floor(e.monthIndex / 12) === yearIndex)
        .reduce((sum, e) => sum + e.contribution, 0);

    // 2년차 진입 직후에는 0·1년차가 확정돼 있고 2년차는 아직 비어 있다
    const enteringYear2 = histories.find((h) => h.yearIndex === 2);
    expect(enteringYear2).toBeDefined();
    expect(enteringYear2?.byYear[0]).toBeCloseTo(contributedIn(0), 6);
    expect(enteringYear2?.byYear[1]).toBeCloseTo(contributedIn(1), 6);
    expect(enteringYear2?.byYear[2] ?? 0).toBe(0);

    // 연차마다 다른 값이다 — 총액만 맞춰서는 통과할 수 없다
    expect(contributedIn(1)).toBeCloseTo(contributedIn(0) * 1.1, 6);
    expect(contributedIn(2)).toBeCloseTo(contributedIn(0) * 1.21, 6);

    // 마지막 호출 시점에는 2년차가 11개월치까지 쌓여 있다
    const lastOfYear2 = histories[histories.length - 1];
    expect(lastOfYear2.yearIndex).toBe(2);
    expect(lastOfYear2.byYear[2]).toBeCloseTo((contributedIn(2) * 11) / 12, 6);
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

  describe('overflowRouting', () => {
    it('from 계좌가 한도에 걸리면 초과분을 그 달 즉시 to 계좌로 옮긴다', () => {
      const ledger = buildLedger({
        calendar: CALENDAR,
        holdings: [
          flatHolding({ accountId: 'ISA', productId: 'TIGER_NASDAQ100' }),
          flatHolding({ accountId: 'DIRECT_US', productId: 'QQQ', weight: 0 }),
        ],
        contribution: { base: 5_000_000, growthRate: 0, anchors: {} },
        initialAmount: 0,
        fxLevels: FX,
        monthlyCap: ({ accountId, yearIndex, contributedByYear }) =>
          accountId === 'ISA'
            ? Math.max(0, 20_000_000 - (contributedByYear[yearIndex] ?? 0))
            : null,
        overflowRouting: { from: 'ISA', to: 'DIRECT_US' },
      });

      const firstYear = ledger.entries.filter((e) => e.monthIndex < 12);
      const isaTotal = firstYear
        .filter((e) => e.accountId === 'ISA')
        .reduce((sum, e) => sum + e.contribution, 0);
      const directUsTotal = firstYear
        .filter((e) => e.accountId === 'DIRECT_US')
        .reduce((sum, e) => sum + e.contribution, 0);

      // 월 500만원 × 12 = 연 6,000만원. ISA는 연 2,000만원에서 멈추고
      // 나머지 4,000만원은 전부 DIRECT_US로 그 달 즉시 넘어간다
      expect(isaTotal).toBe(20_000_000);
      expect(directUsTotal).toBe(40_000_000);
      // CALENDAR가 24개월(2년)이라 2년차에도 같은 패턴(2,000만 ISA + 4,000만 초과)이
      // 반복돼 누적 overflowRouted는 두 해 합인 8,000만원이다
      expect(ledger.overflowRouted).toBe(80_000_000);
    });

    it('한도에 걸리지 않으면 라우팅이 일어나지 않는다', () => {
      const ledger = buildLedger({
        calendar: CALENDAR,
        holdings: [
          flatHolding({ accountId: 'ISA', productId: 'TIGER_NASDAQ100' }),
          flatHolding({ accountId: 'DIRECT_US', productId: 'QQQ', weight: 0 }),
        ],
        contribution: FLAT_SCHEDULE,
        initialAmount: 0,
        fxLevels: FX,
        monthlyCap: () => 10_000_000,
        overflowRouting: { from: 'ISA', to: 'DIRECT_US' },
      });

      const directUsTotal = ledger.entries
        .filter((e) => e.accountId === 'DIRECT_US')
        .reduce((sum, e) => sum + e.contribution, 0);
      expect(directUsTotal).toBe(0);
      expect(ledger.overflowRouted).toBe(0);
    });

    it('to 계좌가 홀딩에 없으면 초과분은 예전처럼 사라진다', () => {
      const ledger = buildLedger({
        calendar: CALENDAR,
        holdings: [flatHolding({ accountId: 'ISA', productId: 'TIGER_NASDAQ100' })],
        contribution: { base: 5_000_000, growthRate: 0, anchors: {} },
        initialAmount: 0,
        fxLevels: FX,
        monthlyCap: ({ yearIndex, contributedByYear }) =>
          Math.max(0, 20_000_000 - (contributedByYear[yearIndex] ?? 0)),
        overflowRouting: { from: 'ISA', to: 'DIRECT_US' },
      });

      const firstYear = ledger.entries.filter((e) => e.monthIndex < 12);
      const isaTotal = firstYear.reduce((sum, e) => sum + e.contribution, 0);
      expect(isaTotal).toBe(20_000_000);
      expect(ledger.overflowRouted).toBe(0);
    });
  });
});
