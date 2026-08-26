'use client';

import { useBacktestDataBounds } from '../../hooks/use-backtest-data-bounds';
import { maxBacktestYears, MAX_BACKTEST_YEARS } from '../../lib/sim/backtest-bounds';
import type { SimulationInputBase } from '../../lib/sim/types';
import { Label } from '../ui/label';
import { Slider } from '../ui/slider';

/**
 * backtest 모드(과거 백테스트) 전용 "기간(년)" 슬라이더.
 *
 * 고정 상수(MAX_BACKTEST_YEARS)를 max로 쓰면, 시작 시점에 따라 실제로는
 * 더 짧은 기간만 가능한데도 슬라이더가 그보다 긴 값을 누르게 해준다. 그래서
 * 현재 startMonth 기준으로 매번 실제 상한을 다시 계산해 max로 쓴다 —
 * BacktestStartPicker가 시작 시점 프리셋을 고를 때 쓰는 것과 같은 SPY 기준 bounds다.
 *
 * 상한을 넘는 years를 URL에 되쓰지 않는다. 예전에는 useEffect가 setInput으로
 * 클램프한 값을 써넣었는데, 그러면 (1) 슬라이더 드래그 한 틱마다 커밋이 두 번
 * 일어나고 (2) 사용자가 고른 기간이 영구히 손실된다(30년 → 시작월 이동으로 6년으로
 * 덮어써짐 → 시작월을 되돌려도 30년이 돌아오지 않음). 지금은 URL이 원래 값을
 * 유지하고, 표시는 파생값으로 클램프하며, 실제 계산은 simulate()가 effectiveYears로
 * 줄이면서 BACKTEST_YEARS_CLAMPED 경고를 낸다(engine.ts) — 그 경고는
 * ExposureSummaryCard의 WarningsBanner에 표시된다.
 */
export function BacktestYearsInput({
  input,
  setInput,
}: {
  input: SimulationInputBase;
  setInput: (input: SimulationInputBase) => void;
}) {
  const bounds = useBacktestDataBounds();
  const maxYears =
    bounds.status === 'ready'
      ? Math.max(1, maxBacktestYears(input.startMonth, bounds.lastAvailableDate))
      : MAX_BACKTEST_YEARS;

  // 표시·슬라이더 위치 모두 이 파생값 하나를 쓴다. 예전에는 레이블만 원본
  // input.years를 찍어 슬라이더 위치와 숫자가 어긋나 보이는 버그가 있었다.
  const displayedYears = Math.min(input.years, maxYears);

  return (
    <Label className="flex flex-col gap-1">
      기간(년): {displayedYears}
      <Slider
        min={1}
        max={maxYears}
        value={[displayedYears]}
        onValueChange={([v]) => setInput({ ...input, years: v })}
      />
    </Label>
  );
}
