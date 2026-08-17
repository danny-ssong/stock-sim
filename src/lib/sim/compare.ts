import { simulate } from './engine';
import { compareTransfer, type TransferComparison } from './transfer';
import type { Allocation, SimulationInput, SimulationResult, SimulationWarning } from './types';
import type { Dataset } from '../data/dataset';
import type { IndexExposure } from '../data/types';

/**
 * 탭 3 시나리오는 두 종류뿐이다(§8).
 *  - allocation: 계좌×노출×비중 조합. simulate()를 그대로 호출한다.
 *  - transfer: 해외직투로 담다가 N년차에 전액 ISA로 이전. compareTransfer()가
 *    "이전 vs 유지" 두 곡선을 이미 함께 계산하므로 이 시나리오 자체가 손익분기
 *    비교다. compareTransfer는 전액 이전 + 해외직투 단일 계좌만 지원하므로
 *    accountId·weight를 사용자가 고를 필요가 없다 — exposure만 고른다.
 */
export type ScenarioConfig =
  | { kind: 'allocation'; label: string; allocations: Allocation[] }
  | { kind: 'transfer'; label: string; exposure: IndexExposure; transferYear: number };

export type ScenarioOutcome =
  | { kind: 'allocation'; config: ScenarioConfig; input: SimulationInput; result: SimulationResult }
  | { kind: 'transfer'; config: ScenarioConfig; comparison: TransferComparison }
  | { kind: 'blocked'; config: ScenarioConfig; blockers: SimulationWarning[] };

const MONTHS_PER_YEAR = 12;

/** 공유 입력(초기원금·납입액·연봉·기간·수익률소스·환율가정 등)에 시나리오별
 *  배분만 얹어 실행한다. mode는 항상 'future'로 고정한다(§5.1.1 — 탭 3은
 *  미래 시뮬레이션이다). transferEvents는 allocation 시나리오에서 항상 비운다 —
 *  simulate()는 transferEvents가 있으면 무조건 거부한다(engine.ts). */
export function runScenario(
  baseInput: SimulationInput,
  scenario: ScenarioConfig,
  dataset: Dataset,
): ScenarioOutcome {
  if (scenario.kind === 'allocation') {
    const input: SimulationInput = {
      ...baseInput,
      mode: 'future',
      transferEvents: [],
      allocations: scenario.allocations,
    };
    const outcome = simulate(input, dataset);
    if (!outcome.ok) return { kind: 'blocked', config: scenario, blockers: outcome.blockers };
    return { kind: 'allocation', config: scenario, input, result: outcome.result };
  }

  const input: SimulationInput = {
    ...baseInput,
    mode: 'future',
    allocations: [{ accountId: 'DIRECT_US', exposure: scenario.exposure, weight: 1 }],
    transferEvents: [
      {
        atMonth: scenario.transferYear * MONTHS_PER_YEAR,
        from: 'DIRECT_US',
        to: 'ISA',
        amount: 'all',
      },
    ],
  };
  const comparison = compareTransfer({ input, dataset });
  if ('blocked' in comparison) {
    return { kind: 'blocked', config: scenario, blockers: comparison.blocked };
  }
  return { kind: 'transfer', config: scenario, comparison };
}

/** 시나리오 카드·차이 요약 카드가 공통으로 쓰는 "최종 세후 금액" 접근자.
 *  transfer 시나리오는 이전 후 2구간 최종액에 ISA 한도 밖 대기 현금을 더한
 *  값이 "이전했다면 지금 손에 쥔 금액"이다(transfer.ts의 finalDifference와
 *  같은 정의 — without.finalAfterTax + finalDifference와 동치). */
export function scenarioFinalAfterTax(outcome: ScenarioOutcome): number | null {
  if (outcome.kind === 'allocation') return outcome.result.finalAfterTax;
  if (outcome.kind === 'transfer') {
    const { comparison } = outcome;
    return comparison.withTransfer[1].finalAfterTax + comparison.idleCash;
  }
  return null;
}

/** transfer 시나리오의 총 세금은 두 구간(이전 전·이전 후)의 totalTax 합이다 —
 *  1구간의 즉시 양도소득세(immediateTax)는 이미 firstLeg.totalTax에 포함돼
 *  있으므로 따로 더하면 이중 계산이 된다(transfer.ts 참조). */
export function scenarioTotalTax(outcome: ScenarioOutcome): number | null {
  if (outcome.kind === 'allocation') return outcome.result.totalTax;
  if (outcome.kind === 'transfer') {
    const { comparison } = outcome;
    return comparison.withTransfer[0].totalTax + comparison.withTransfer[1].totalTax;
  }
  return null;
}

/** 데이터셋 로딩 대상을 모은다. transfer 시나리오는 이전받는 쪽(ISA)의 상품도
 *  compareTransfer의 2구간 시뮬에 필요하므로 두 계좌 몫을 모두 담는다. */
export function allocationsForProductIds(scenarios: ScenarioConfig[]): Allocation[] {
  return scenarios.flatMap((scenario) => {
    if (scenario.kind === 'allocation') return scenario.allocations;
    return [
      { accountId: 'DIRECT_US', exposure: scenario.exposure, weight: 1 },
      { accountId: 'ISA', exposure: scenario.exposure, weight: 1 },
    ];
  });
}
