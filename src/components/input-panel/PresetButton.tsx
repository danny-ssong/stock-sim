'use client';

const PRESET_BUTTON_CLASS =
  'rounded border px-2 py-1 text-xs hover:bg-zinc-100 disabled:opacity-40 disabled:hover:bg-transparent dark:hover:bg-zinc-800';
/** ReturnSourceToggle의 radio 버튼과 같은 "선택됨" 시각 관용구 — 배경색 반전으로 표시한다. */
const PRESET_BUTTON_ACTIVE_CLASS =
  'border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-900 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-100';

/** 시작 시점 프리셋 버튼 하나. BacktestStartPicker(탭 2)·HistoricalPeakPresetButtons
 *  (탭 1)가 "현재 선택된 달과 일치하는가"를 판정하는 로직과 버튼 마크업을 공유한다. */
export function PresetButton({
  label,
  resolvedDate,
  currentMonth,
  disabled,
  onSelect,
}: {
  label: string;
  resolvedDate: string | null;
  currentMonth: string;
  disabled?: boolean;
  onSelect: (date: string) => void;
}) {
  const isActive = resolvedDate !== null && resolvedDate.slice(0, 7) === currentMonth;
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={isActive}
      className={`${PRESET_BUTTON_CLASS} ${isActive ? PRESET_BUTTON_ACTIVE_CLASS : ''}`}
      onClick={() => resolvedDate !== null && onSelect(resolvedDate)}
    >
      {label}
    </button>
  );
}
