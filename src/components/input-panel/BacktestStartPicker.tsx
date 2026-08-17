'use client';

import { useMemo } from 'react';
import { findLastCorrectionPeak } from '../../lib/sim/drawdown';
import { maxBacktestYears } from '../../lib/sim/backtest-bounds';
import { HISTORICAL_HIGH_PRESETS, YEARS_AGO_PRESETS, subtractYears } from '../../lib/backtest/presets';
import { useBacktestDataBounds } from '../../hooks/use-backtest-data-bounds';
import type { SimulationInput } from '../../lib/sim/types';

/** "조정"의 통상적 정의(고점 대비 -10%)를 임계치로 쓴다 */
const CORRECTION_THRESHOLD = 0.1;

const MAX_YEARS = 30;

const PRESET_BUTTON_CLASS =
  'rounded border px-2 py-1 text-xs hover:bg-zinc-100 disabled:opacity-40 disabled:hover:bg-transparent dark:hover:bg-zinc-800';
/** ReturnSourceToggle의 radio 버튼과 같은 "선택됨" 시각 관용구 — 배경색 반전으로 표시한다. */
const PRESET_BUTTON_ACTIVE_CLASS = 'border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-900 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-100';

/** 시작 시점 프리셋 버튼 하나. 세 그룹(N년 전·역사적 전고점·최근 조정 전고점)이
 *  "현재 선택된 시작월과 일치하는가"를 판정하는 로직과 버튼 마크업을 반복하므로 공유한다. */
function PresetButton({
  label,
  resolvedDate,
  currentStartMonth,
  disabled,
  onSelect,
}: {
  label: string;
  resolvedDate: string | null;
  currentStartMonth: string;
  disabled?: boolean;
  onSelect: (date: string) => void;
}) {
  const isActive = resolvedDate !== null && resolvedDate.slice(0, 7) === currentStartMonth;
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={isActive}
      className={`${PRESET_BUTTON_CLASS} ${isActive ? PRESET_BUTTON_ACTIVE_CLASS : ''}`}
      onClick={() => resolvedDate !== null && onSelect(resolvedDate)}
    >
      {label}
    </button>
  );
}

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

  const applyStart = (date: string, years?: number) => {
    setInput({
      ...input,
      // returnSource.from을 바꾸는 것이 곧 백테스트 시작월을 바꾸는 방법이다 —
      // url/schema.ts가 백테스트 모드에서 input.startMonth를 from 쿼리 파라미터로부터
      // 파생시키므로(§D3), 이 컴포넌트만 봐서는 이 연결이 드러나지 않는다.
      returnSource:
        input.returnSource.type === 'historicalPath'
          ? { ...input.returnSource, from: date }
          : {
              type: 'historicalPath',
              from: date,
              to: bounds.status === 'ready' ? bounds.lastAvailableDate : date,
              tileMode: 'repeat',
            },
      // years가 함께 오면 그 시작 시점 기준 기간도 같이 갱신한다 — 그렇지 않으면
      // "10년 전" 프리셋을 눌러도 이전에 설정돼 있던 기간이 그대로 남아 대부분의
      // 경우 insufficient-data 상태로 착지한다.
      ...(years !== undefined ? { years: Math.max(1, Math.min(MAX_YEARS, years)) } : {}),
    });
  };

  const availableYears =
    bounds.status === 'ready' ? maxBacktestYears(input.startMonth, bounds.lastAvailableDate) : null;

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium">시작 시점</legend>
      <p className="text-xs text-zinc-500">현재 시작: {input.startMonth}</p>

      <div className="flex flex-wrap gap-2">
        {YEARS_AGO_PRESETS.map((years) => {
          const resolvedDate =
            bounds.status === 'ready' ? subtractYears(bounds.lastAvailableDate, years) : null;
          return (
            <PresetButton
              key={years}
              label={`${years}년 전`}
              resolvedDate={resolvedDate}
              currentStartMonth={input.startMonth}
              disabled={bounds.status !== 'ready'}
              onSelect={(date) => applyStart(date, years)}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {HISTORICAL_HIGH_PRESETS.map((preset) => (
          <PresetButton
            key={preset.label}
            label={preset.label}
            resolvedDate={preset.date}
            currentStartMonth={input.startMonth}
            disabled={bounds.status !== 'ready'}
            onSelect={(date) =>
              bounds.status === 'ready' &&
              applyStart(date, maxBacktestYears(date.slice(0, 7), bounds.lastAvailableDate))
            }
          />
        ))}
        {recentCorrection !== null && bounds.status === 'ready' && (
          <PresetButton
            label="최근 조정 전고점"
            resolvedDate={recentCorrection.date}
            currentStartMonth={input.startMonth}
            onSelect={(date) =>
              applyStart(date, maxBacktestYears(date.slice(0, 7), bounds.lastAvailableDate))
            }
          />
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
