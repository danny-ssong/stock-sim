import { simulate } from './engine';
import type { SimulationInput, SimulationResult, SimulationWarning } from './types';
import type { Dataset } from '../data/dataset';
import type { IndexExposure } from '../data/types';

/** 탭 3 시나리오 — 계좌가 하나뿐이라 노출만 바꿔 나란히 비교한다(스펙 §5). */
export type ScenarioConfig = { label: string; exposure: IndexExposure };

export type ScenarioOutcome =
  | { kind: 'ready'; config: ScenarioConfig; result: SimulationResult }
  | { kind: 'blocked'; config: ScenarioConfig; blockers: SimulationWarning[] };

export function runScenario(
  baseInput: SimulationInput,
  scenario: ScenarioConfig,
  dataset: Dataset,
): ScenarioOutcome {
  const input: SimulationInput = { ...baseInput, mode: 'future', exposure: scenario.exposure };
  const outcome = simulate(input, dataset);
  if (!outcome.ok) return { kind: 'blocked', config: scenario, blockers: outcome.blockers };
  return { kind: 'ready', config: scenario, result: outcome.result };
}

/** 데이터셋 로딩 대상을 모은다. */
export function productExposuresForScenarios(scenarios: ScenarioConfig[]): IndexExposure[] {
  return scenarios.map((s) => s.exposure);
}
