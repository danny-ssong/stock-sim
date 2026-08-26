'use client';

import { useMemo } from 'react';
import { productIdsForExposures } from '../lib/data/catalog';
import type { IndexExposure } from '../lib/data/types';
import { backtestYearsShortfall } from '../lib/sim/backtest-bounds';
import { runExposure, type ExposureOutcome } from '../lib/sim/compare';
import type { SimulationInputBase } from '../lib/sim/types';
import { useDataset } from './use-dataset';

export type CompareSimulationState =
  | { status: 'loading' }
  | { status: 'dataset-error'; message: string }
  /** 백테스트 모드에서 startMonth + years가 데이터 범위를 넘어선다 */
  | { status: 'insufficient-data'; maxYears: number }
  | { status: 'ready'; outcomes: ExposureOutcome[] };

/**
 * 노출 여러 개의 결과를 나란히 계산한다.
 *
 * 담을 수 없는 조합이 섞여 있어도 그 노출만 blocked로 표시하고 나머지는 그대로
 * 비교한다 — 하나가 막혔다고 전체 화면을 에러로 덮으면 "나란히 비교"가 깨진다.
 * 반면 데이터 부족(insufficient-data)은 모든 노출에 동시에 걸리는 전역 조건이라
 * (같은 startMonth·years를 공유한다) 화면 전체를 대체한다.
 */
export function useCompareSimulationResult(
  base: SimulationInputBase,
  exposures: IndexExposure[],
): CompareSimulationState {
  // useDataset은 productIds의 내용(정렬·join한 키)만 보고 반응하므로 배열 identity를
  // 안정화할 이유가 없다.
  const datasetState = useDataset(productIdsForExposures(exposures));

  return useMemo(() => {
    if (datasetState.status === 'loading') return { status: 'loading' };
    if (datasetState.status === 'error') {
      return { status: 'dataset-error', message: datasetState.message };
    }
    const { dataset } = datasetState;

    const shortfall = backtestYearsShortfall(base, dataset.dates);
    if (shortfall !== null) return { status: 'insufficient-data', maxYears: shortfall };

    return {
      status: 'ready',
      outcomes: exposures.map((exposure) => runExposure(base, exposure, dataset)),
    };
  }, [datasetState, base, exposures]);
}
