'use client';

import { useMemo } from 'react';
import { productIdsForExposures } from '../lib/data/catalog';
import { simulate } from '../lib/sim/engine';
import { seekContribution } from '../lib/sim/goal-seek';
import type { SimulationInput, SimulationResult, SimulationWarning } from '../lib/sim/types';
import { useDataset } from './use-dataset';

export type FutureSimulationState =
  | { status: 'loading' }
  | { status: 'dataset-error'; message: string }
  | { status: 'blocked'; blockers: SimulationWarning[] }
  | { status: 'goal-unreachable'; maxAchievable: number }
  | { status: 'ready'; input: SimulationInput; result: SimulationResult };

/**
 * 탭 1(미래 설계) 결과를 계산한다.
 *
 * target이 있으면 seekContribution으로 납입 스케줄을 먼저 역산하고, 그 스케줄로
 * 다시 simulate를 돌려 전체 SimulationResult(원장·세금 내역)를 얻는다 —
 * seekContribution 자체는 finalAfterTax와 스케줄만 반환하고 차트·세금
 * 브레이크다운에 필요한 원장은 담지 않기 때문이다. 상태가 'ready'일 때 반환하는
 * input은 목표 모드에서는 원본 input이 아니라 역산된 contribution을 반영한
 * effectiveInput이다 — 호출부는 이 input을 결과 요약에 그대로 쓰면 된다.
 */
export function useFutureSimulationResult(
  input: SimulationInput,
  target: number | null,
): FutureSimulationState {
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

    if (target === null) {
      const outcome = simulate(input, dataset);
      if (!outcome.ok) return { status: 'blocked', blockers: outcome.blockers };
      return { status: 'ready', input, result: outcome.result };
    }

    const seek = seekContribution({ input, dataset, target });
    if (!seek.reachable) {
      // maxFactor 0(또는 낮은 배수)에서도 계산이 성립하지 않았다면 목표가 너무 높은
      // 게 아니라 배분 자체가 거부된 것이다 — 원본 input으로 한 번 더 확인해
      // 진짜 거부 사유를 보여준다(§13.2, 경고를 조용히 삼키지 않는다).
      const baseline = simulate(input, dataset);
      if (!baseline.ok) return { status: 'blocked', blockers: baseline.blockers };
      return { status: 'goal-unreachable', maxAchievable: seek.maxAchievable };
    }

    const effectiveInput: SimulationInput = { ...input, contribution: seek.schedule };
    const outcome = simulate(effectiveInput, dataset);
    if (!outcome.ok) return { status: 'blocked', blockers: outcome.blockers };
    return { status: 'ready', input: effectiveInput, result: outcome.result };
  }, [datasetState, input, target]);
}
