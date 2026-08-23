'use client';

import { Label } from '../ui/label';
import { Slider } from '../ui/slider';

/**
 * "라벨 + 현재값 + 슬라이더"를 한 단위로 묶는다.
 *
 * value는 도메인 단위 원시값(원, 퍼센트 수치)을 그대로 받고 표시 단위
 * 변환은 formatValue 하나가 전담한다 — 변환이 JSX에 흩어지면 같은 계산이
 * 표시부와 onChange에 두 번 나타나 어긋나기 쉽다.
 */
export function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  disabled,
  formatValue,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  formatValue: (value: number) => string;
}) {
  return (
    <Label className="flex flex-col items-stretch gap-2">
      <span className="text-sm">
        {label}: <span className="font-medium tabular-nums">{formatValue(value)}</span>
      </span>
      <Slider
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        value={[value]}
        onValueChange={([next]) => onChange(next)}
      />
    </Label>
  );
}
