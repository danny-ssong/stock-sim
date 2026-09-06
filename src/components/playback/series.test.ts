import { describe, expect, it } from 'vitest';
import type { ExposureOutcome } from '../../lib/sim/compare';
import type { MonthEntry, PortfolioIndexPoint, SimulationResult } from '../../lib/sim/types';
import { CONTRIBUTED_KEY, buildAssetPlayback, buildPricePlayback } from './series';

type ReadyOutcome = Extract<ExposureOutcome, { kind: 'ready' }>;

/** 테스트가 읽지 않는 필드까지 채운 최소한의 월별 원장 한 줄 */
function monthEntry(
  date: string,
  contribution: number,
  marketValue: number,
  endDate: string = date,
): MonthEntry {
  return {
    monthIndex: 0,
    date,
    endDate,
    accountId: 'DIRECT_US',
    productId: 'test-product',
    contribution,
    buyPrice: 1,
    sharesBought: 0,
    sharesHeld: 0,
    marketValue,
    costBasis: 0,
    realizedGain: 0,
    isSynthetic: false,
  };
}

/** 테스트가 읽지 않는 필드까지 채운 최소한의 포트폴리오 인덱스 한 점 */
function indexPoint(date: string, level: number): PortfolioIndexPoint {
  return { date, level, isSynthetic: false, priceUsd: null };
}

/**
 * buildAssetPlayback/buildPricePlayback이 실제로 읽는 필드(ledger.entries,
 * portfolioIndex)만 채우고 나머지는 테스트가 신경 쓰지 않는 값으로 둔 ready outcome.
 */
function readyOutcome(entries: MonthEntry[], portfolioIndex: PortfolioIndexPoint[]): ReadyOutcome {
  const result: SimulationResult = {
    ledger: { entries, syntheticRatio: 0 },
    yearlyTax: [],
    exitBreakdowns: [],
    finalBeforeTax: 0,
    finalAfterTax: 0,
    totalContributed: 0,
    totalTax: 0,
    harvest: { taxFreeGain: 0, savedTax: 0 },
    syntheticRatio: 0,
    portfolioIndex,
    drawdown: null,
    warnings: [],
  };
  return { kind: 'ready', exposure: 'SP500_1X', result };
}

describe('buildAssetPlayback', () => {
  // 3개월치 원장: 매달 100만원씩 납입, 평가액은 원금 대비 등락한다.
  const entries: MonthEntry[] = [
    monthEntry('2020-01-15', 1_000_000, 1_000_000),
    monthEntry('2020-02-15', 1_000_000, 2_400_000),
    monthEntry('2020-03-15', 1_000_000, 2_400_000),
  ];

  const outcome = readyOutcome(entries, []);

  it('중간 시점의 수익률은 그 시점의 원금 대비로 계산된다', () => {
    const bundle = buildAssetPlayback([outcome]);
    const outcomeSeries = bundle.series.find((one) => one.key === 's0');
    if (outcomeSeries === undefined) throw new Error('s0 시리즈를 찾지 못했다');

    // points[0]은 매수 시점 행이라 원금과 같다 — 이후 인덱스가 한 칸씩 밀린다.
    // 3번째 점(2020-02 말): 원금 200만원, 평가액 240만원 → +20%
    const midPoint = outcomeSeries.points[2];
    expect(bundle.changeRateOf('s0', midPoint)).toBeCloseTo(0.2);

    // 마지막 점(2020-03 말): 원금 300만원, 평가액 240만원 → -20%
    const lastPoint = outcomeSeries.points[3];
    expect(bundle.changeRateOf('s0', lastPoint)).toBeCloseTo(-0.2);
  });

  it('첫 점은 매수 시점이라 평가액이 원금과 같다(수익률 0)', () => {
    const bundle = buildAssetPlayback([outcome]);
    const outcomeSeries = bundle.series.find((one) => one.key === 's0');
    const contributedSeries = bundle.series.find((one) => one.key === CONTRIBUTED_KEY);
    if (outcomeSeries === undefined || contributedSeries === undefined) {
      throw new Error('시리즈를 찾지 못했다');
    }

    expect(outcomeSeries.points[0].value).toBe(contributedSeries.points[0].value);
    expect(bundle.changeRateOf('s0', outcomeSeries.points[0])).toBeCloseTo(0);
  });

  it('원금 시리즈 키는 항상 null을 낸다', () => {
    const bundle = buildAssetPlayback([outcome]);
    const contributedSeries = bundle.series.find((one) => one.key === CONTRIBUTED_KEY);
    if (contributedSeries === undefined) throw new Error('원금 시리즈를 찾지 못했다');

    const anyPoint = contributedSeries.points[0];
    expect(bundle.changeRateOf(CONTRIBUTED_KEY, anyPoint)).toBeNull();
  });

  it('그 시점의 원금을 찾지 못하면(등록되지 않은 time) null을 낸다', () => {
    const bundle = buildAssetPlayback([outcome]);
    const unknownTimePoint = { date: '1999-01-01', time: 0, value: 500_000 };
    expect(bundle.changeRateOf('s0', unknownTimePoint)).toBeNull();
  });
});

describe('buildPricePlayback', () => {
  const portfolioIndex: PortfolioIndexPoint[] = [
    indexPoint('2020-01-01', 1),
    indexPoint('2020-06-01', 1.5),
    indexPoint('2020-12-31', 0.8),
  ];

  const outcome = readyOutcome([], portfolioIndex);

  it('가격 시리즈는 level - 1을 수익률로 낸다', () => {
    const bundle = buildPricePlayback([outcome]);
    const outcomeSeries = bundle.series.find((one) => one.key === 's0');
    if (outcomeSeries === undefined) throw new Error('s0 시리즈를 찾지 못했다');

    const midPoint = outcomeSeries.points[1];
    expect(bundle.changeRateOf('s0', midPoint)).toBeCloseTo(0.5);

    const lastPoint = outcomeSeries.points[2];
    expect(bundle.changeRateOf('s0', lastPoint)).toBeCloseTo(-0.2);
  });
});
