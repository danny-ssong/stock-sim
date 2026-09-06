'use client';

const OPTION_CLASS = 'flex-1 rounded-md px-3 py-2 text-sm transition-colors';
const ACTIVE_CLASS = 'bg-zinc-900 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900';
const INACTIVE_CLASS =
  'text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-700';

export type SegmentedOption<T extends string> = { value: T; label: string };

/**
 * 두세 개 중 하나를 고르는 입력. 시점 축(ModeToggle)과 표현 축(ResultsToolbar)이
 * 같은 화면에 놓이므로 모양이 갈리면 안 된다 — 상수를 공유하는 대신 컴포넌트를
 * 공유해, role="radiogroup" + aria-checked 배선도 한 번만 쓴다.
 *
 * role이 tablist가 아니라 radiogroup인 이유: 연결된 tabpanel이 없고, 실제 의미가
 * "둘 중 하나를 고르는 입력"이기 때문이다.
 */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  /** 스크린리더가 읽을 그룹 이름 */
  label: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          className={`${OPTION_CLASS} ${option.value === value ? ACTIVE_CLASS : INACTIVE_CLASS}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
