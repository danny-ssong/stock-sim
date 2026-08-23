'use client';

import { useMemo } from 'react';
import { productIdsForExposures } from '../lib/data/catalog';
import { backtestYearsShortfall } from '../lib/sim/backtest-bounds';
import { simulate } from '../lib/sim/engine';
import type { SimulationInput, SimulationResult, SimulationWarning } from '../lib/sim/types';
import { useDataset } from './use-dataset';

export type BacktestSimulationState =
  | { status: 'loading' }
  | { status: 'dataset-error'; message: string }
  | { status: 'blocked'; blockers: SimulationWarning[] }
  /** startMonth + years 조합이 데이터 범위를 넘어선다 — buildBacktestCalendar가
   *  던질 크래시를 simulate() 호출 전에 막는다. */
  | { status: 'insufficient-data'; maxYears: number }
  | { status: 'ready'; input: SimulationInput; result: SimulationResult };

/**
 * backtest 모드(과거 백테스트) 결과를 계산한다. 목표금액 역산이 없는 만큼
 * useFutureSimulationResult보다 단순하다 — simulate()를 그대로 호출한다.
 */
export function useBacktestSimulationResult(input: SimulationInput): BacktestSimulationState {
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
    const { dataset } = datasetState;

    const shortfall = backtestYearsShortfall(input, dataset.dates);
    if (shortfall !== null) return { status: 'insufficient-data', maxYears: shortfall };

    const outcome = simulate(input, dataset);
    if (!outcome.ok) return { status: 'blocked', blockers: outcome.blockers };
    return { status: 'ready', input, result: outcome.result };
  }, [datasetState, input]);
}
