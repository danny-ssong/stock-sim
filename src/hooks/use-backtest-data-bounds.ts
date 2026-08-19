'use client';

import { useDataset } from './use-dataset';

export type BacktestDataBounds =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; dates: string[]; lastAvailableDate: string; spy: Float64Array };

/**
 * 탭 2 시작 시점 프리셋(N년 전·최근 조정 전고점)과 기간 상한 계산에 쓰는
 * 벤치마크 데이터셋.
 *
 * 항상 SPY를 기준으로 삼는다 — 사용자가 실제로 고른 노출과 무관하게 둬야
 * "최근 조정 전고점" 같은 프리셋 날짜가 노출을 바꿀 때마다 흔들리지 않는다.
 * 이 훅은 BacktestStartPicker(탭 2 전용 컴포넌트)에서만 호출한다 — 탭 1에서는
 * 이 컴포넌트 자체가 렌더되지 않으므로 불필요한 SPY 요청이 나가지 않는다.
 */
export function useBacktestDataBounds(): BacktestDataBounds {
  const datasetState = useDataset(['SPY']);

  if (datasetState.status === 'loading') return { status: 'loading' };
  if (datasetState.status === 'error') {
    return { status: 'error', message: datasetState.message };
  }

  const { dataset } = datasetState;
  return {
    status: 'ready',
    dates: dataset.dates,
    lastAvailableDate: dataset.dates[dataset.dates.length - 1],
    spy: dataset.seriesById.get('SPY') ?? new Float64Array(0),
  };
}
