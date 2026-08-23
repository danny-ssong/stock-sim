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

/** 탭 1(미래 설계) 결과를 계산한다. */
export function useFutureSimulationResult(input: SimulationInput): FutureSimulationState {
  const productIds = useMemo(
    () => productIdsForExposures([input.exposure]),
    [input.exposure],
  );
  const datasetState = useDataset(productIds);

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
