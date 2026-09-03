'use client';

import { useBacktestDataBounds } from '../../hooks/use-backtest-data-bounds';
import { useHistoricalPeakPresets } from '../../hooks/use-historical-peak-presets';
import { useSimulationQueryContext } from '../../hooks/use-simulation-query-context';
import { backtestYearsCap } from '../../lib/sim/backtest-bounds';
import { YEARS_AGO_PRESETS, backtestStartForYears } from '../../lib/backtest/presets';
import type { SimulationInputBase } from '../../lib/sim/types';
import { PresetButton } from './PresetButton';

export function BacktestStartPicker({
  input,
  setInput,
}: {
  input: SimulationInputBase;
  setInput: (input: SimulationInputBase) => void;
}) {
  const bounds = useBacktestDataBounds();
  const { today } = useSimulationQueryContext();
  const peakPresets = useHistoricalPeakPresets();
  const recentCorrection = peakPresets.status === 'ready' ? peakPresets.recentCorrection : null;

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
      // 경우 insufficient-data 상태로 착지한다. 호출부(아래 JSX)가 이미 각
      // 프리셋의 실제 maxBacktestYears로만 넘기므로 여기서는 범위 밖 값이 들어오는
      // 걸 막는 안전망일 뿐이다 — 정상 경로에서 이 clamp가 값을 바꾸는 일은 없다.
      ...(years !== undefined
        ? { years: Math.max(1, Math.min(backtestYearsCap(today), years)) }
        : {}),
    });
  };

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium">시작 시점</legend>
      <p className="text-xs text-zinc-500">현재 시작: {input.startMonth}</p>

      <div className="flex flex-wrap gap-2">
        {YEARS_AGO_PRESETS.map((years) => {
          // "N년 전"은 "N년 전부터 지금까지"다 — 마지막 달을 고정하고 거꾸로 세야
          // 구간이 데이터 끝에서 끝난다(backtestStartForYears 주석 참고).
          const resolvedDate =
            bounds.status === 'ready'
              ? backtestStartForYears(bounds.lastAvailableDate, years)
              : null;
          return (
            <PresetButton
              key={years}
              label={`${years}년 전`}
              resolvedDate={resolvedDate}
              currentMonth={input.startMonth}
              disabled={bounds.status !== 'ready'}
              onSelect={(date) => applyStart(date, years)}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {peakPresets.status === 'ready' &&
          peakPresets.presets.map((preset) => (
            <PresetButton
              key={preset.label}
              label={preset.label}
              resolvedDate={preset.date}
              currentMonth={input.startMonth}
              disabled={preset.years < 1}
              onSelect={(date) => applyStart(date, preset.years)}
            />
          ))}
        {recentCorrection !== null && (
          <PresetButton
            label={recentCorrection.label}
            resolvedDate={recentCorrection.date}
            currentMonth={input.startMonth}
            onSelect={(date) => applyStart(date, recentCorrection.years)}
          />
        )}
      </div>
    </fieldset>
  );
}
