'use client';

import { startTransition, useEffect } from 'react';
import { useBacktestDataBounds } from '../../hooks/use-backtest-data-bounds';
import { maxBacktestYears, MAX_BACKTEST_YEARS } from '../../lib/sim/backtest-bounds';
import type { SimulationInputBase } from '../../lib/sim/types';
import { Label } from '../ui/label';
import { Slider } from '../ui/slider';

/**
 * backtest 모드(과거 백테스트) 전용 "기간(년)" 슬라이더.
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
  input: SimulationInputBase;
  setInput: (input: SimulationInputBase) => void;
}) {
  const bounds = useBacktestDataBounds();
  const maxYears =
    bounds.status === 'ready'
      ? Math.max(1, maxBacktestYears(input.startMonth, bounds.lastAvailableDate))
      : MAX_BACKTEST_YEARS;

  // maxYears가 현재 years보다 작아지면(시작월 변경, 모드 전환 등으로) 상태 자체를
  // 줄여준다 — 그렇지 않으면 슬라이더 thumb만 시각적으로 클램프되고 실제 years는
  // 그대로 남아 "데이터 부족" 메시지가 재클릭 전까지 사라지지 않는다.
  //
  // startTransition으로 감싸는 이유: 이 보정은 트리거가 된 렌더(예: 시작 시점 변경)와
  // 같은 커밋에서 즉시 일어날 필요가 없다 — engine.ts가 범위를 벗어난 years를 이미
  // effectiveYears로 자체 클램프하고 경고를 내므로 simulate() 결과 자체는 이 보정
  // 없이도 정확하다. 그래서 이 setInput을 저우선순위로 두면, 그 트리거가 된 변경의
  // "urgent" 렌더를 가로막지 않고 뒤따라 조용히 URL/표시값만 맞춰준다.
  useEffect(() => {
    if (input.years > maxYears) {
      startTransition(() => {
        setInput({ ...input, years: maxYears });
      });
    }
  }, [input, maxYears, setInput]);

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
