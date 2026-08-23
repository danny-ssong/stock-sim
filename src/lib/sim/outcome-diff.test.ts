import { describe, it, expect } from 'vitest';
import { computeOutcomeDiff } from './outcome-diff';
import { runExposure, type ExposureOutcome } from './compare';
import { computeDrawdown } from './drawdown';
import { makeDataset, baseInputWithoutExposure } from './__fixtures__/simulation';

const DATASET = makeDataset({ days: 3000, dailyReturn: 0.0003, productIds: ['QQQ', 'QLD'] });
const BASE = baseInputWithoutExposure({ years: 5 });

describe('computeOutcomeDiff', () => {
  it('두 ready 결과의 최종액·세금 차이를 target − baseline으로 낸다', () => {
    const baseline = runExposure(BASE, 'NASDAQ100_1X', DATASET);
    const target = runExposure(BASE, 'NASDAQ100_2X', DATASET);
    const diff = computeOutcomeDiff(baseline, target);
    expect(diff).not.toBeNull();
    if (diff === null) return;
    if (baseline.kind !== 'ready' || target.kind !== 'ready') throw new Error('unexpected kind');
    expect(diff.finalAfterTaxDiff).toBeCloseTo(
      target.result.finalAfterTax - baseline.result.finalAfterTax,
      6,
    );
    expect(diff.totalTaxDiff).toBeCloseTo(target.result.totalTax - baseline.result.totalTax, 6);
  });

  it('한쪽이 blocked면 null을 반환한다', () => {
    const baseline = runExposure(BASE, 'NASDAQ100_1X', DATASET);
    const blocked: ExposureOutcome = {
      kind: 'blocked',
      exposure: 'SP500_3X',
      blockers: [],
    };
    expect(computeOutcomeDiff(baseline, blocked)).toBeNull();
  });

  it('MDD 차이를 target − baseline의 computeDrawdown 결과로 낸다(§5)', () => {
    // 평탄한(수익률 0) 데이터셋은 낙폭이 없어 baseline의 MDD가 0이고, 지속 하락하는
    // 데이터셋은 target의 MDD가 뚜렷이 양수라 diff가 의미있는 비영값인지까지 검증한다.
    // constantCagr 소스는 데이터셋을 무시하므로 historicalPath로 실제 경로를 태운다.
    const flat = makeDataset({ days: 3000, dailyReturn: 0, productIds: ['QQQ'] });
    const declining = makeDataset({ days: 3000, dailyReturn: -0.001, productIds: ['QLD'] });
    const historicalBase = (dataset: ReturnType<typeof makeDataset>) =>
      baseInputWithoutExposure({
        years: 2,
        returnSource: {
          type: 'historicalPath',
          from: dataset.dates[0],
          to: dataset.dates[dataset.dates.length - 1],
          tileMode: 'repeat',
        },
      });

    const baseline = runExposure(historicalBase(flat), 'NASDAQ100_1X', flat);
    const target = runExposure(historicalBase(declining), 'NASDAQ100_2X', declining);
    const diff = computeOutcomeDiff(baseline, target);
    expect(diff).not.toBeNull();
    if (diff === null) return;
    if (baseline.kind !== 'ready' || target.kind !== 'ready') throw new Error('unexpected kind');

    const baselineDrawdown = computeDrawdown(baseline.result.portfolioIndex)?.maxDrawdown ?? 0;
    const targetDrawdown = computeDrawdown(target.result.portfolioIndex)?.maxDrawdown ?? 0;
    expect(baselineDrawdown).toBe(0);
    expect(targetDrawdown).toBeGreaterThan(0);
    expect(diff.maxDrawdownDiff).toBeCloseTo(targetDrawdown - baselineDrawdown, 10);
  });
});
