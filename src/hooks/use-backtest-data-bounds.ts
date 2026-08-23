'use client';

import { useDataset } from './use-dataset';

export type BacktestDataBounds =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; dates: string[]; lastAvailableDate: string; spy: Float64Array };

/**
 * 백테스트 모드 시작 시점 프리셋(N년 전·최근 조정 전고점)과 기간 상한 계산에
 * 쓰는 벤치마크 데이터셋.
 *
 * 항상 SPY를 기준으로 삼는다 — 사용자가 실제로 고른 노출과 무관하게 둬야
 * "최근 조정 전고점" 같은 프리셋 날짜가 노출을 바꿀 때마다 흔들리지 않는다.
 * BacktestStartPicker(backtest 모드)뿐 아니라 useHistoricalPeakPresets를 거쳐
 * ReturnSourceToggle → HistoricalPeakPresetButtons(future 모드)에서도 호출된다 —
 * 두 모드 모두 SPY 요청이 나간다. useDataset의 모듈 스코프 캐시가 중복 요청을
 * 막으므로 두 훅이 각자 호출해도 네트워크는 한 번만 나간다.
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
