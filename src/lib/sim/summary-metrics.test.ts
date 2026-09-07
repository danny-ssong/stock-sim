import { describe, expect, it } from 'vitest';
import { buildSummaryMetrics, pickBestIndices } from './summary-metrics';
import type { DrawdownResult } from './drawdown';
import type { MonthEntry, SimulationResult } from './types';

/** 원장 한 줄. buildSummaryMetrics가 보는 필드(costBasis·marketValue·monthIndex)만
 *  의미가 있고 나머지는 자리를 채운다 */
function entry(monthIndex: number, costBasis: number, marketValue: number): MonthEntry {
  return {
    monthIndex,
    date: `2020-${String(monthIndex + 1).padStart(2, '0')}-01`,
    endDate: `2020-${String(monthIndex + 1).padStart(2, '0')}-28`,
    accountId: 'DIRECT_US',
    productId: 'SPY',
    contribution: 0,
    buyPrice: 1,
    sharesBought: 0,
    sharesHeld: 0,
    marketValue,
    costBasis,
    realizedGain: 0,
    isSynthetic: false,
  };
}

/** buildSummaryMetrics가 읽는 필드만 뜻이 있는 최소 결과 */
function makeResult(overrides: Partial<SimulationResult> = {}): SimulationResult {
  return {
    ledger: { entries: [], syntheticRatio: 0 },
    yearlyTax: [],
    exitBreakdowns: [],
    finalBeforeTax: 0,
    finalAfterTax: 0,
    totalContributed: 0,
    totalTax: 0,
    harvest: { taxFreeGain: 0, savedTax: 0 },
    syntheticRatio: 0,
    portfolioIndex: [],
    dailyAssetSeries: [],
    drawdown: null,
    warnings: [],
    ...overrides,
  };
}

function makeDrawdown(overrides: Partial<DrawdownResult> = {}): DrawdownResult {
  return {
    maxDrawdown: 0.3,
    peak: { date: '2020-01-01' },
    trough: { date: '2020-03-01' },
    recovery: { date: '2020-09-01' },
    recoveryMonths: 8,
    ...overrides,
  };
}

describe('buildSummaryMetrics', () => {
  it('afterTax는 finalAfterTax를 그대로 옮긴다', () => {
    const metrics = buildSummaryMetrics(makeResult({ finalAfterTax: 12_345 }));
    expect(metrics.afterTax).toBe(12_345);
  });

  it('수익률은 totalContributed 기준이다 — 숏츠 화면과 같은 식', () => {
    const metrics = buildSummaryMetrics(
      makeResult({ finalAfterTax: 300, totalContributed: 100 }),
    );
    expect(metrics.returnRate).toBeCloseTo(2, 10);
  });

  it('손실이면 수익률이 음수다', () => {
    const metrics = buildSummaryMetrics(
      makeResult({ finalAfterTax: 40, totalContributed: 100 }),
    );
    expect(metrics.returnRate).toBeCloseTo(-0.6, 10);
  });

  it('납입이 0이면 수익률은 null이다 — 0으로 나누지 않는다', () => {
    const metrics = buildSummaryMetrics(
      makeResult({ finalAfterTax: 100, totalContributed: 0 }),
    );
    expect(metrics.returnRate).toBeNull();
  });

  it('drawdown이 null이면 MDD와 전고점 회복이 모두 null이다', () => {
    const metrics = buildSummaryMetrics(makeResult({ drawdown: null }));
    expect(metrics.maxDrawdown).toBeNull();
    expect(metrics.peakRecovery).toBeNull();
  });

  it('하락이 없었던 구간(maxDrawdown 0)은 null이 아니라 0이다 — 부재와 구분한다', () => {
    const metrics = buildSummaryMetrics(
      makeResult({ drawdown: makeDrawdown({ maxDrawdown: 0, recovery: null, recoveryMonths: null }) }),
    );
    expect(metrics.maxDrawdown).toBe(0);
  });

  it('하락이 없었으면 전고점 회복은 never-fell이다 — 미회복과 다른 사실이다', () => {
    const metrics = buildSummaryMetrics(
      makeResult({ drawdown: makeDrawdown({ maxDrawdown: 0, recovery: null, recoveryMonths: null }) }),
    );
    expect(metrics.peakRecovery).toEqual({ kind: 'never-fell' });
  });

  it('전고점을 회복했으면 걸린 개월을 담은 recovered다', () => {
    const metrics = buildSummaryMetrics(makeResult({ drawdown: makeDrawdown({ recoveryMonths: 8 }) }));
    expect(metrics.peakRecovery).toEqual({ kind: 'recovered', months: 8 });
  });

  it('하락은 있었지만 전고점을 회복하지 못했으면 unrecovered다', () => {
    const metrics = buildSummaryMetrics(
      makeResult({ drawdown: makeDrawdown({ recovery: null, recoveryMonths: null }) }),
    );
    expect(metrics.maxDrawdown).toBe(0.3);
    expect(metrics.peakRecovery).toEqual({ kind: 'unrecovered' });
  });

  it('원금 회복 개월은 결손 최저점 이후 잔고가 원금을 넘어선 시점까지다', () => {
    const metrics = buildSummaryMetrics(
      makeResult({
        ledger: {
          entries: [entry(0, 100, 90), entry(1, 200, 120), entry(2, 300, 400)],
          syntheticRatio: 0,
        },
      }),
    );
    // 결손이 가장 컸던 달은 monthIndex 1(200-120=80), 회복은 2 → 1개월
    expect(metrics.principalRecovery).toEqual({ kind: 'recovered', months: 1 });
  });

  it('원금을 한 번도 하회하지 않았으면 never-fell이다 — 미회복과 뭉뚱그리지 않는다', () => {
    const metrics = buildSummaryMetrics(
      makeResult({
        ledger: { entries: [entry(0, 100, 150), entry(1, 200, 300)], syntheticRatio: 0 },
      }),
    );
    expect(metrics.principalRecovery).toEqual({ kind: 'never-fell' });
  });

  it('기간이 끝나도록 원금을 회복하지 못했으면 unrecovered다', () => {
    const metrics = buildSummaryMetrics(
      makeResult({
        ledger: { entries: [entry(0, 100, 90), entry(1, 200, 120)], syntheticRatio: 0 },
      }),
    );
    expect(metrics.principalRecovery).toEqual({ kind: 'unrecovered' });
  });

  it('원장이 비어 있으면 원금 회복은 null이다 — 잴 대상이 없다', () => {
    const metrics = buildSummaryMetrics(makeResult());
    expect(metrics.principalRecovery).toBeNull();
  });
});

describe('pickBestIndices', () => {
  it('higher-better는 최댓값 인덱스를 고른다', () => {
    expect(pickBestIndices([1, 5, 3], 'higher-better')).toEqual(new Set([1]));
  });

  it('lower-better는 최솟값 인덱스를 고른다', () => {
    expect(pickBestIndices([1, 5, 3], 'lower-better')).toEqual(new Set([0]));
  });

  it('null은 후보에서 빠진다', () => {
    expect(pickBestIndices([null, 5, 3], 'lower-better')).toEqual(new Set([2]));
  });

  it('동점이면 모두 고른다', () => {
    expect(pickBestIndices([5, 5, 3], 'higher-better')).toEqual(new Set([0, 1]));
  });

  it('유효 후보가 1개면 강조하지 않는다 — 혼자면 최우수가 의미 없다', () => {
    expect(pickBestIndices([null, 5, null], 'higher-better')).toEqual(new Set());
  });

  it('전부 null이면 강조하지 않는다', () => {
    expect(pickBestIndices([null, null], 'higher-better')).toEqual(new Set());
  });

  it('빈 배열이면 강조하지 않는다', () => {
    expect(pickBestIndices([], 'higher-better')).toEqual(new Set());
  });
});
