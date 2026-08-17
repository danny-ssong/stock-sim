'use client';

import { useMemo } from 'react';
import { productIdsForAllocations } from '../lib/data/catalog';
import { maxBacktestYears } from '../lib/sim/backtest-bounds';
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
 * 탭 2(과거 백테스트) 결과를 계산한다. 목표금액 역산이 없는 만큼
 * useFutureSimulationResult보다 단순하다 — simulate()를 그대로 호출한다.
 */
export function useBacktestSimulationResult(input: SimulationInput): BacktestSimulationState {
  const productIds = useMemo(
    () => productIdsForAllocations(input.allocations),
    [input.allocations],
  );
  const datasetState = useDataset(productIds);

  return useMemo(() => {
    if (datasetState.status === 'loading') return { status: 'loading' };
    if (datasetState.status === 'error') {
      return { status: 'dataset-error', message: datasetState.message };
    }
    const { dataset } = datasetState;

    // schema.ts가 from을 BACKFILL_START로 클램프하지만, 데이터셋의 실제 첫 월이
    // 그보다 늦을 가능성(예: 특정 상품 조합의 backfill 범위)에 대비한 방어선이다 —
    // 이 경우도 buildBacktestCalendar 크래시를 막아야 하므로 같은 insufficient-data로
    // 처리한다(maxYears: 0은 "이 시작월부터는 계산 가능한 기간이 없다"는 정직한 답이다).
    const firstAvailableMonth = dataset.dates[0].slice(0, 7);
    if (input.startMonth < firstAvailableMonth) {
      return { status: 'insufficient-data', maxYears: 0 };
    }

    const lastAvailableDate = dataset.dates[dataset.dates.length - 1];
    const maxYears = maxBacktestYears(input.startMonth, lastAvailableDate);
    if (input.years > maxYears) return { status: 'insufficient-data', maxYears };

    const outcome = simulate(input, dataset);
    if (!outcome.ok) return { status: 'blocked', blockers: outcome.blockers };
    return { status: 'ready', input, result: outcome.result };
  }, [datasetState, input]);
}
