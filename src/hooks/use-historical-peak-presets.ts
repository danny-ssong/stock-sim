'use client';

import { useMemo } from 'react';
import { buildHistoricalPeakPresets, type HistoricalPeakPreset } from '../lib/backtest/presets';
import type { IndexExposure } from '../lib/data/types';
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
 * 전고점 계열 시작 시점 프리셋(상장 시점·역사적 전고점·최근 조정 전고점).
 * BacktestStartPicker(탭 2)와 HistoricalPeakPresetButtons(탭 1)가 공유한다.
 */
export function useHistoricalPeakPresets(exposure: IndexExposure): HistoricalPeakPresetsState {
  const bounds = useBacktestDataBounds();

  return useMemo(() => {
    if (bounds.status === 'loading') return { status: 'loading' };
    if (bounds.status === 'error') return { status: 'error' };

    const { presets, recentCorrection } = buildHistoricalPeakPresets({
      exposure,
      dates: bounds.dates,
      spy: bounds.spy,
      lastAvailableDate: bounds.lastAvailableDate,
    });

    return { status: 'ready', lastAvailableDate: bounds.lastAvailableDate, presets, recentCorrection };
  }, [bounds, exposure]);
}
