'use client';

import type { SimulationInputBase } from '../../lib/sim/types';

type Mode = SimulationInputBase['mode'];

const MODES: readonly { value: Mode; label: string; hint: string }[] = [
  { value: 'backtest', label: '과거로 검증', hint: '실제 과거 구간에 넣었다면 얼마가 됐을지 계산합니다.' },
  { value: 'future', label: '미래로 설계', hint: '지금부터 넣으면 얼마가 될지 계산합니다.' },
];

const OPTION_CLASS = 'flex-1 rounded-md px-3 py-2 text-sm transition-colors';
const ACTIVE_CLASS = 'bg-zinc-900 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900';
const INACTIVE_CLASS =
  'text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-700';

/**
 * 시점 축. 탭 바를 대신하지만 탭이 아니다 — 두 상태가 같은 화면의 입력값이라
 * 라우트가 아니라 쿼리 파라미터 하나(mode)를 바꾼다. 두 선택지를 항상 나란히
 * 보여주므로 탭 라벨과 정보량이 같고, 아래 한 줄이 각 모드가 답하는 질문을 말한다.
 *
 * role은 tablist가 아니라 radiogroup이다 — 연결된 tabpanel이 없고, 실제 의미가
 * "둘 중 하나를 고르는 입력"이기 때문이다.
 */
export function ModeToggle({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (mode: Mode) => void;
}) {
  const active = MODES.find((option) => option.value === mode) ?? MODES[0];

  return (
    <div className="flex flex-col gap-2">
      <div
        role="radiogroup"
        aria-label="시점"
        className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800"
      >
        {MODES.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={option.value === mode}
            className={`${OPTION_CLASS} ${option.value === mode ? ACTIVE_CLASS : INACTIVE_CLASS}`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-zinc-500">{active.hint}</p>
    </div>
  );
}
