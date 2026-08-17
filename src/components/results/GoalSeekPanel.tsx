'use client';

import { Input } from '../ui/input';
import { Label } from '../ui/label';
import type { SimulationInput } from '../../lib/sim/types';

/**
 * 목표금액을 고정하면 월 납입액은 역산 결과를 읽기 전용으로 보여준다.
 * 반대로 목표금액이 없으면 월 납입액을 직접 입력해 순방향으로 계산한다.
 * 스펙 §8 "둘 중 하나를 고정하면 나머지가 자동 계산"을 두 필드의
 * disabled 상태로 표현한다 — 두 값을 동시에 편집 가능하게 두면
 * 어느 쪽이 진짜 입력인지 애매해진다.
 */
export function GoalSeekPanel({
  input,
  target,
  setInput,
  setTarget,
  computedBase,
}: {
  input: SimulationInput;
  target: number | null;
  setInput: (input: SimulationInput) => void;
  setTarget: (target: number | null) => void;
  /** 목표 모드에서 역산으로 나온 월 납입액(1년차, KRW). 아직 계산 전이면 null */
  computedBase: number | null;
}) {
  const isGoalMode = target !== null;

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
      <Label className="flex flex-col gap-1">
        목표금액(세후 명목, 만원)
        <Input
          type="number"
          placeholder="예: 30000"
          value={target === null ? '' : Math.round(target / 10_000)}
          onChange={(e) => {
            const raw = e.target.value;
            setTarget(raw === '' ? null : Number(raw) * 10_000);
          }}
        />
      </Label>
      <span className="pb-2 text-zinc-400" aria-hidden>
        ⇄
      </span>
      <Label className="flex flex-col gap-1">
        월 납입액(만원, 1년차)
        <Input
          type="number"
          disabled={isGoalMode}
          value={
            isGoalMode
              ? computedBase === null
                ? ''
                : Math.round(computedBase / 10_000)
              : Math.round(input.contribution.base / 10_000)
          }
          onChange={(e) =>
            setInput({
              ...input,
              contribution: { ...input.contribution, base: Number(e.target.value) * 10_000 },
            })
          }
        />
      </Label>
      {isGoalMode && (
        <button
          type="button"
          className="pb-2 text-sm text-zinc-500 underline"
          onClick={() => setTarget(null)}
        >
          직접 입력으로 전환
        </button>
      )}
      <p className="w-full text-xs text-zinc-500">
        둘 중 하나를 고정하면 나머지가 자동 계산됩니다.
      </p>
    </div>
  );
}
