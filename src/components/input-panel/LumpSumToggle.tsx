'use client';

import type { SimulationInputBase } from '../../lib/sim/types';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';

const DEFAULT_MONTHLY_BASE = 500_000;
const DEFAULT_MONTHLY_GROWTH = 0.05;

/**
 * "거치식"을 별도 상태로 두지 않고 contribution이 완전히 0인지로 판정한다 —
 * base·growthRate·anchors가 전부 비어 있으면 정의상 추가 납입이 없으므로
 * 사용자가 어떻게 그 상태에 도달했든 "거치식"으로 보여주는 게 정확하다.
 */
export function isLumpSum(input: SimulationInputBase): boolean {
  return (
    input.contribution.base === 0 &&
    input.contribution.growthRate === 0 &&
    Object.keys(input.contribution.anchors).length === 0
  );
}

export function LumpSumToggle({
  input,
  setInput,
}: {
  input: SimulationInputBase;
  setInput: (input: SimulationInputBase) => void;
}) {
  const lumpSum = isLumpSum(input);

  return (
    <Label className="flex items-center gap-2">
      <Switch
        checked={lumpSum}
        onCheckedChange={(checked) =>
          setInput({
            ...input,
            contribution: checked
              ? { base: 0, growthRate: 0, anchors: {} }
              : { base: DEFAULT_MONTHLY_BASE, growthRate: DEFAULT_MONTHLY_GROWTH, anchors: {} },
          })
        }
      />
      거치식(초기 원금만 투입, 추가 납입 없음)
    </Label>
  );
}
