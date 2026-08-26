'use client';

import { useMemo } from 'react';
import { buildHistoricalPeakPresets, type HistoricalPeakPreset } from '../lib/backtest/presets';
import { useBacktestDataBounds } from './use-backtest-data-bounds';

export type HistoricalPeakPresetsState =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ready';
      lastAvailableDate: string;
      presets: HistoricalPeakPreset[];
      recentCorrection: HistoricalPeakPreset | null;
    };

/**
 * 전고점 계열 시작 시점 프리셋(데이터 시작·역사적 전고점·최근 조정 전고점).
 * BacktestStartPicker와 HistoricalPeakPresetButtons가 공유한다.
 */
export function useHistoricalPeakPresets(): HistoricalPeakPresetsState {
  const bounds = useBacktestDataBounds();

  // buildHistoricalPeakPresets 안의 findLastCorrectionPeak가 SPY 전체 일별
  // 시계열(수십 년치)을 선형 스캔한다 — bounds가 안정적인 지금(use-backtest-data-bounds.ts
  // 참고)에서만 이 memo가 실제로 적중해 이 스캔을 렌더마다 반복하지 않는다.
  return useMemo((): HistoricalPeakPresetsState => {
    if (bounds.status === 'loading') return { status: 'loading' };
    if (bounds.status === 'error') return { status: 'error' };

    const { presets, recentCorrection } = buildHistoricalPeakPresets({
      dates: bounds.dates,
      spy: bounds.spy,
      lastAvailableDate: bounds.lastAvailableDate,
    });

    return { status: 'ready', lastAvailableDate: bounds.lastAvailableDate, presets, recentCorrection };
  }, [bounds]);
}
