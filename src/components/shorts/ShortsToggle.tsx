'use client';

import type { PlaybackView } from '../../lib/url/schema';

/**
 * 표현 축 전환. 입력 조건이 아니라 "같은 결과를 어떻게 볼 것인가"라서 입력 패널이
 * 아니라 결과 영역 위에 둔다 — ModeToggle(시점)과 역할이 다르다.
 */
export function ShortsToggle({
  view,
  onChange,
}: {
  view: PlaybackView;
  onChange: (view: PlaybackView) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(view === 'shorts' ? 'default' : 'shorts')}
      className="self-start rounded-md border px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
    >
      {view === 'shorts' ? '← 비교 화면으로' : '숏츠로 보기'}
    </button>
  );
}
