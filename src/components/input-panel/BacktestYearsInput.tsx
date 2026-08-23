'use client';

import { useBacktestDataBounds } from '../../hooks/use-backtest-data-bounds';
import { maxBacktestYears, MAX_BACKTEST_YEARS } from '../../lib/sim/backtest-bounds';
import type { SimulationInput } from '../../lib/sim/types';
import { Label } from '../ui/label';
import { Slider } from '../ui/slider';

/**
 * 탭 2(과거 백테스트) 전용 "기간(년)" 슬라이더.
 *
 * 고정 상수(MAX_BACKTEST_YEARS)를 max로 쓰면, 시작 시점에 따라 실제로는
 * 더 짧은 기간만 가능한데도 슬라이더가 그보다 긴 값을 누르게 해줘 insufficient-data로
 * 튕겨나가는 UX가 생긴다. 그래서 현재 startMonth 기준으로 매번 실제 상한을
 * 다시 계산해 max로 쓴다 — BacktestStartPicker가 시작 시점 프리셋을 고를 때
 * 쓰는 것과 같은 SPY 기준 bounds다.
 */
export function BacktestYearsInput({
  input,
  setInput,
}: {
  input: SimulationInput;
  setInput: (input: SimulationInput) => void;
}) {
  const bounds = useBacktestDataBounds();
  const maxYears =
    bounds.status === 'ready'
      ? Math.max(1, maxBacktestYears(input.startMonth, bounds.lastAvailableDate))
      : MAX_BACKTEST_YEARS;

  return (
    <Label className="flex flex-col gap-1">
      기간(년): {input.years}
      <Slider
        min={1}
        max={maxYears}
        value={[Math.min(input.years, maxYears)]}
        onValueChange={([v]) => setInput({ ...input, years: v })}
      />
    </Label>
  );
}
