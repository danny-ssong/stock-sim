'use client';

import { useMemo } from 'react';
import { productIdsForExposures } from '../lib/data/catalog';
import { simulate } from '../lib/sim/engine';
import type { SimulationInput, SimulationResult, SimulationWarning } from '../lib/sim/types';
import { useDataset } from './use-dataset';

export type FutureSimulationState =
  | { status: 'loading' }
  | { status: 'dataset-error'; message: string }
  | { status: 'blocked'; blockers: SimulationWarning[] }
  | { status: 'ready'; input: SimulationInput; result: SimulationResult };

/** future 모드(미래 설계) 결과를 계산한다. */
export function useFutureSimulationResult(input: SimulationInput): FutureSimulationState {
  // useDataset은 productIds의 내용(정렬·join한 키)만 보고 반응하므로 배열 identity를
  // 안정화할 이유가 없다.
  const datasetState = useDataset(productIdsForExposures([input.exposure]));

  return useMemo(() => {
    if (datasetState.status === 'loading') return { status: 'loading' };
    if (datasetState.status === 'error') {
      return { status: 'dataset-error', message: datasetState.message };
    }

    const outcome = simulate(input, datasetState.dataset);
    if (!outcome.ok) return { status: 'blocked', blockers: outcome.blockers };
    return { status: 'ready', input, result: outcome.result };
  }, [datasetState, input]);
}
