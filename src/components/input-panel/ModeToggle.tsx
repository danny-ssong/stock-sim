'use client';

import type { SimulationInputBase } from '../../lib/sim/types';

type Mode = SimulationInputBase['mode'];

const MODES: readonly { value: Mode; label: string }[] = [
  { value: 'backtest', label: '과거 테스트' },
  { value: 'future', label: '미래 설계' },
];

const OPTION_CLASS = 'flex-1 rounded-md px-3 py-2 text-sm transition-colors';
const ACTIVE_CLASS = 'bg-zinc-900 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900';
const INACTIVE_CLASS =
  'text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-700';

/**
 * 시점 축. 탭 바를 대신하지만 탭이 아니다 — 두 상태가 같은 화면의 입력값이라
 * 라우트가 아니라 쿼리 파라미터 하나(mode)를 바꾼다.
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
  return (
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
  );
}
