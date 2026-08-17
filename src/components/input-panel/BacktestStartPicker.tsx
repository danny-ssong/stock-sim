'use client';

import { useMemo } from 'react';
import { findLastCorrectionPeak } from '../../lib/sim/drawdown';
import { maxBacktestYears } from '../../lib/sim/backtest-bounds';
import { HISTORICAL_HIGH_PRESETS, YEARS_AGO_PRESETS, subtractYears } from '../../lib/backtest/presets';
import { useBacktestDataBounds } from '../../hooks/use-backtest-data-bounds';
import type { SimulationInput } from '../../lib/sim/types';

/** "조정"의 통상적 정의(고점 대비 -10%)를 임계치로 쓴다 */
const CORRECTION_THRESHOLD = 0.1;

const PRESET_BUTTON_CLASS =
  'rounded border px-2 py-1 text-xs hover:bg-zinc-100 disabled:opacity-40 disabled:hover:bg-transparent dark:hover:bg-zinc-800';

export function BacktestStartPicker({
  input,
  setInput,
}: {
  input: SimulationInput;
  setInput: (input: SimulationInput) => void;
}) {
  const bounds = useBacktestDataBounds();

  const recentCorrection = useMemo(() => {
    if (bounds.status !== 'ready') return null;
    return findLastCorrectionPeak(bounds.dates, bounds.spy, CORRECTION_THRESHOLD);
  }, [bounds]);

  const applyStart = (date: string) => {
    setInput({
      ...input,
      returnSource:
        input.returnSource.type === 'historicalPath'
          ? { ...input.returnSource, from: date }
          : {
              type: 'historicalPath',
              from: date,
              to: bounds.status === 'ready' ? bounds.lastAvailableDate : date,
              tileMode: 'repeat',
            },
    });
  };

  const availableYears =
    bounds.status === 'ready' ? maxBacktestYears(input.startMonth, bounds.lastAvailableDate) : null;

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium">시작 시점</legend>

      <div className="flex flex-wrap gap-2">
        {YEARS_AGO_PRESETS.map((years) => (
          <button
            key={years}
            type="button"
            disabled={bounds.status !== 'ready'}
            className={PRESET_BUTTON_CLASS}
            onClick={() =>
              bounds.status === 'ready' && applyStart(subtractYears(bounds.lastAvailableDate, years))
            }
          >
            {years}년 전
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {HISTORICAL_HIGH_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className={PRESET_BUTTON_CLASS}
            onClick={() => applyStart(preset.date)}
          >
            {preset.label}
          </button>
        ))}
        {recentCorrection !== null && (
          <button type="button" className={PRESET_BUTTON_CLASS} onClick={() => applyStart(recentCorrection.date)}>
            최근 조정 전고점
          </button>
        )}
      </div>

      {availableYears !== null && (
        <p className="text-xs text-zinc-500">
          이 시작 시점부터는 최대 {availableYears}년까지 데이터가 있습니다.
        </p>
      )}
    </fieldset>
  );
}
