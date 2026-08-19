'use client';

import { useMemo } from 'react';
import { productIdsForExposures } from '../lib/data/catalog';
import {
  productExposuresForScenarios,
  runScenario,
  type ScenarioConfig,
  type ScenarioOutcome,
} from '../lib/sim/compare';
import type { SimulationInput } from '../lib/sim/types';
import { useDataset } from './use-dataset';

export type CompareSimulationState =
  | { status: 'loading' }
  | { status: 'dataset-error'; message: string }
  | { status: 'ready'; outcomes: ScenarioOutcome[] };

/**
 * 탭 3(시나리오 비교) 결과를 계산한다. 시나리오별로 담을 수 없는 조합이 섞여
 * 있어도 그 시나리오만 blocked로 표시하고 나머지는 그대로 비교한다 — 하나가
 * 막혔다고 전체 화면을 에러로 덮으면 §8이 요구하는 "나란히 비교"가 깨진다.
 */
export function useCompareSimulationResult(
  baseInput: SimulationInput,
  scenarios: ScenarioConfig[],
): CompareSimulationState {
  const productIds = useMemo(
    () => productIdsForExposures(productExposuresForScenarios(scenarios)),
    [scenarios],
  );
  const datasetState = useDataset(productIds);

  return useMemo(() => {
    if (datasetState.status === 'loading') return { status: 'loading' };
    if (datasetState.status === 'error') {
      return { status: 'dataset-error', message: datasetState.message };
    }
    const outcomes = scenarios.map((scenario) =>
      runScenario(baseInput, scenario, datasetState.dataset),
    );
    return { status: 'ready', outcomes };
  }, [datasetState, baseInput, scenarios]);
}
