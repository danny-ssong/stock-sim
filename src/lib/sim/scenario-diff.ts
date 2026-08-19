import type { ScenarioOutcome } from './compare';
import { computeDrawdown } from './drawdown';

export type ScenarioDiff = {
  finalAfterTaxDiff: number;
  totalTaxDiff: number;
  /** target MDD − baseline MDD(둘 다 0~1 비율). computeDrawdown이 null이면(빈/평탄 시계열) 0으로 취급한다 */
  maxDrawdownDiff: number;
};

/** 어느 한쪽이라도 blocked면 비교가 성립하지 않으므로 null을 반환한다. */
export function computeScenarioDiff(
  baseline: ScenarioOutcome,
  target: ScenarioOutcome,
): ScenarioDiff | null {
  if (baseline.kind !== 'ready' || target.kind !== 'ready') return null;

  const baselineDrawdown = computeDrawdown(baseline.result.portfolioIndex)?.maxDrawdown ?? 0;
  const targetDrawdown = computeDrawdown(target.result.portfolioIndex)?.maxDrawdown ?? 0;

  return {
    finalAfterTaxDiff: target.result.finalAfterTax - baseline.result.finalAfterTax,
    totalTaxDiff: target.result.totalTax - baseline.result.totalTax,
    maxDrawdownDiff: targetDrawdown - baselineDrawdown,
  };
}
