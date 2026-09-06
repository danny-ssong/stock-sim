'use client';

import type { RefObject } from 'react';
import type { PlaybackStatus } from './use-playback';

/** 재생 삼각형. 아직 한 번도 재생하지 않은 상태(idle)에서 쓴다 */
function PlayIcon({ compact }: { compact: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={compact ? 'size-4' : 'size-5'}
    >
      <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.3-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" />
    </svg>
  );
}

/** 처음부터 다시 감는 화살표. 이미 재생했던 상태에서 쓴다 — 같은 삼각형을 쓰면
 *  "이어서 재생"으로 읽히는데, 이 재생은 언제나 처음부터 다시 시작한다 */
function ReplayIcon({ compact }: { compact: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={compact ? 'size-4' : 'size-5'}
    >
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  );
}

/**
 * 재생을 시작하는 버튼. 스크럽 막대와 분리돼 있는 이유는 트랜스포트가 둘을 서로 다른
 * 조건으로 렌더하기 때문이다 — 버튼은 항상 있고, 스크럽은 그릴 canvas가 생긴 뒤에만 있다.
 */
export function PlayButton({
  status,
  onStart,
  compact = false,
}: {
  status: PlaybackStatus;
  onStart: () => void;
  /** 버튼을 한 단계 작게 그릴지. 숏츠 카드처럼 폭이 좁은 화면에서만 호출자가 true를 넘긴다 */
  compact?: boolean;
}) {
  // 아이콘만 남으므로 접근성 이름은 aria-label이 진다 — 상태에 따라 실제로 하는 일이
  // 다르지 않지만(언제나 처음부터), 아이콘이 달라지는 만큼 이름도 맞춘다
  const name = status === 'idle' ? '재생' : '처음부터 다시 재생';
  return (
    <button
      type="button"
      onClick={onStart}
      aria-label={name}
      title={name}
      className={`grid shrink-0 place-items-center rounded-full bg-zinc-900 text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 ${compact ? 'size-8' : 'size-10'}`}
    >
      {status === 'idle' ? <PlayIcon compact={compact} /> : <ReplayIcon compact={compact} />}
    </button>
  );
}

/**
 * 재생 위치를 끄는 막대.
 *
 * 그릴 canvas가 없는 동안에는 호출자가 아예 렌더하지 않는다 — 이전에는 disabled로
 * 두었는데, 평소에 쓸 수 없는 컨트롤이 상시 자리를 차지했다.
 *
 * 값은 재생 루프가 ref로 직접 갱신한다(use-playback-display.ts).
 */
export function PlaybackScrubber({
  onSeek,
  sliderRef,
}: {
  onSeek: (progress: number) => void;
  sliderRef: RefObject<HTMLInputElement | null>;
}) {
  return (
    <input
      ref={sliderRef}
      type="range"
      min={0}
      max={1}
      step={0.001}
      defaultValue={0}
      aria-label="재생 위치"
      className="flex-1"
      onChange={(event) => onSeek(Number(event.target.value))}
    />
  );
}
