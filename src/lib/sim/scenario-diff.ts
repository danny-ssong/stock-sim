import { scenarioFinalAfterTax, scenarioTotalTax, type ScenarioOutcome } from './compare';

export type ScenarioDiff = { finalAfterTaxDiff: number; totalTaxDiff: number };

/** §8 "차이 요약 카드: 추천안 대비 세금 +XX만원 / 최종 −XX만원". 어느 한쪽이라도
 *  blocked(계산 불가)면 비교 자체가 성립하지 않으므로 null을 반환한다 — 조용히
 *  0으로 채우면 "차이 없음"으로 오해할 수 있다(§13, 경고를 삼키지 않는다). */
export function computeScenarioDiff(
  baseline: ScenarioOutcome,
  target: ScenarioOutcome,
): ScenarioDiff | null {
  const baselineFinal = scenarioFinalAfterTax(baseline);
  const targetFinal = scenarioFinalAfterTax(target);
  const baselineTax = scenarioTotalTax(baseline);
  const targetTax = scenarioTotalTax(target);

  if (baselineFinal === null || targetFinal === null || baselineTax === null || targetTax === null) {
    return null;
  }

  return {
    finalAfterTaxDiff: targetFinal - baselineFinal,
    totalTaxDiff: targetTax - baselineTax,
  };
}
