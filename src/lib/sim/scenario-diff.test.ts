import { describe, it, expect } from 'vitest';
import { computeScenarioDiff } from './scenario-diff';
import { runScenario, type ScenarioOutcome } from './compare';
import { makeDataset, baseInput } from './__fixtures__/simulation';

const DATASET = makeDataset({ days: 3000, dailyReturn: 0.0003, productIds: ['QQQ', 'TIGER_NASDAQ100'] });
const BASE = baseInput({ years: 5 });

describe('computeScenarioDiff', () => {
  it('두 ready 시나리오의 최종액·세금 차이를 target − baseline으로 낸다', () => {
    const baseline = runScenario(BASE, { label: 'A', exposure: 'NASDAQ100_1X' }, DATASET);
    const target = runScenario(BASE, { label: 'B', exposure: 'NASDAQ100_1X' }, DATASET);
    const diff = computeScenarioDiff(baseline, target);
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
    const baseline = runScenario(BASE, { label: 'A', exposure: 'NASDAQ100_1X' }, DATASET);
    const blocked: ScenarioOutcome = {
      kind: 'blocked',
      config: { label: 'C', exposure: 'NASDAQ100_1X' },
      blockers: [],
    };
    expect(computeScenarioDiff(baseline, blocked)).toBeNull();
  });
});
