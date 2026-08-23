'use client';

import { useBacktestDataBounds } from '../../hooks/use-backtest-data-bounds';
import { YEARS_AGO_PRESETS, subtractYears } from '../../lib/backtest/presets';
import { PresetButton } from './PresetButton';

/**
 * 과거 흐름 재생(historicalPath) 구간을 "최근 N년"으로 한 번에 맞추는 프리셋 줄.
 * BacktestStartPicker의 "N년 전" 프리셋과 같은 목록(YEARS_AGO_PRESETS)을 쓰지만,
 * 여기서는 기간(years) 슬라이더가 아니라 재생 구간(from/to) 자체가 "최근 N년"이라는
 * 뜻이라 to도 항상 최신 데이터 날짜로 맞춘다 — HistoricalPeakPresetButtons와 동일한
 * onSelectRange 계약을 쓴다.
 */
export function RecentYearsPresetButtons({
  from,
  onSelectRange,
}: {
  from: string;
  onSelectRange: (from: string, to: string) => void;
}) {
  const bounds = useBacktestDataBounds();
  const currentMonth = from.slice(0, 7);

  return (
    <div className="flex flex-wrap gap-2">
      {YEARS_AGO_PRESETS.map((years) => {
        const resolvedDate =
          bounds.status === 'ready' ? subtractYears(bounds.lastAvailableDate, years) : null;
        return (
          <PresetButton
            key={years}
            label={`최근 ${years}년`}
            resolvedDate={resolvedDate}
            currentMonth={currentMonth}
            disabled={bounds.status !== 'ready'}
            onSelect={(date) =>
              onSelectRange(date, bounds.status === 'ready' ? bounds.lastAvailableDate : date)
            }
          />
        );
      })}
    </div>
  );
}
