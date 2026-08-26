'use client';

import { useMemo } from 'react';
import { productIdsForExposures } from '../lib/data/catalog';
import { hasBacktestRange } from '../lib/sim/backtest-bounds';
import { simulate } from '../lib/sim/engine';
import type { SimulationInput, SimulationResult, SimulationWarning } from '../lib/sim/types';
import { useDataset } from './use-dataset';

export type BacktestSimulationState =
  | { status: 'loading' }
  | { status: 'dataset-error'; message: string }
  | { status: 'blocked'; blockers: SimulationWarning[] }
  /** startMonth 조합 자체가 계산 불가다 — buildBacktestCalendar가 던질 크래시를
   *  simulate() 호출 전에 막는다. 기간이 긴 것은 여기가 아니라 엔진이 처리한다. */
  | { status: 'insufficient-data' }
  | { status: 'ready'; input: SimulationInput; result: SimulationResult };

/**
 * backtest 모드(과거 백테스트) 결과를 계산한다. 목표금액 역산이 없는 만큼
 * useFutureSimulationResult보다 단순하다 — simulate()를 그대로 호출한다.
 */
export function useBacktestSimulationResult(input: SimulationInput): BacktestSimulationState {
  // useDataset은 productIds의 내용(정렬·join한 키)만 보고 반응하므로 배열 identity를
  // 안정화할 이유가 없다.
  const datasetState = useDataset(productIdsForExposures([input.exposure]));

  return useMemo(() => {
    if (datasetState.status === 'loading') return { status: 'loading' };
    if (datasetState.status === 'error') {
      return { status: 'dataset-error', message: datasetState.message };
    }
    const { dataset } = datasetState;

    if (!hasBacktestRange(input, dataset.dates)) return { status: 'insufficient-data' };

    const outcome = simulate(input, dataset);
    if (!outcome.ok) return { status: 'blocked', blockers: outcome.blockers };
    return { status: 'ready', input, result: outcome.result };
  }, [datasetState, input]);
}
