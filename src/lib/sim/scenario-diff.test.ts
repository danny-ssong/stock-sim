import { describe, it, expect } from 'vitest';
import { computeScenarioDiff } from './scenario-diff';
import { runScenario } from './compare';
import { makeDataset, baseInput } from './__fixtures__/simulation';

const DATASET = makeDataset({ days: 3000, dailyReturn: 0.0003, productIds: ['QQQ', 'TIGER_NASDAQ100'] });
const BASE = baseInput({ years: 5 });

describe('computeScenarioDiff', () => {
  it('두 allocation 시나리오의 최종액·세금 차이를 target − baseline으로 낸다', () => {
    const baseline = runScenario(
      BASE,
      { kind: 'allocation', label: 'A', allocations: [{ accountId: 'ISA', exposure: 'NASDAQ100_1X', weight: 1 }] },
      DATASET,
    );
    const target = runScenario(
      BASE,
      { kind: 'allocation', label: 'B', allocations: [{ accountId: 'DIRECT_US', exposure: 'NASDAQ100_1X', weight: 1 }] },
      DATASET,
    );
    const diff = computeScenarioDiff(baseline, target);
    expect(diff).not.toBeNull();
    if (diff === null) return;
    if (baseline.kind !== 'allocation' || target.kind !== 'allocation') throw new Error('unexpected kind');
    expect(diff.finalAfterTaxDiff).toBeCloseTo(
      target.result.finalAfterTax - baseline.result.finalAfterTax,
      6,
    );
    expect(diff.totalTaxDiff).toBeCloseTo(target.result.totalTax - baseline.result.totalTax, 6);
  });

  it('한쪽이 blocked면 null을 반환한다', () => {
    const baseline = runScenario(
      BASE,
      { kind: 'allocation', label: 'A', allocations: [{ accountId: 'ISA', exposure: 'NASDAQ100_1X', weight: 1 }] },
      DATASET,
    );
    const blocked = runScenario(
      BASE,
      { kind: 'allocation', label: 'C', allocations: [{ accountId: 'ISA', exposure: 'NASDAQ100_3X', weight: 1 }] },
      DATASET,
    );
    expect(computeScenarioDiff(baseline, blocked)).toBeNull();
  });
});
