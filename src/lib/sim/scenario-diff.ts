import type { ScenarioOutcome } from './compare';

export type ScenarioDiff = { finalAfterTaxDiff: number; totalTaxDiff: number };

/** 어느 한쪽이라도 blocked면 비교가 성립하지 않으므로 null을 반환한다. */
export function computeScenarioDiff(
  baseline: ScenarioOutcome,
  target: ScenarioOutcome,
): ScenarioDiff | null {
  if (baseline.kind !== 'ready' || target.kind !== 'ready') return null;

  return {
    finalAfterTaxDiff: target.result.finalAfterTax - baseline.result.finalAfterTax,
    totalTaxDiff: target.result.totalTax - baseline.result.totalTax,
  };
}
