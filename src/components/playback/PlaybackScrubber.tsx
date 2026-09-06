'use client';

import type { RefObject } from 'react';
import type { PlaybackStatus } from './use-playback';

/** 재생 삼각형. 아직 한 번도 재생하지 않은 상태(idle)에서 쓴다 */
function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-5">
      <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.3-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" />
    </svg>
  );
}

/** 처음부터 다시 감는 화살표. 이미 재생했던 상태에서 쓴다 — 같은 삼각형을 쓰면
 *  "이어서 재생"으로 읽히는데, 이 재생은 언제나 처음부터 다시 시작한다 */
function ReplayIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="size-5"
    >
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  );
}

/**
 * 재생을 조작하는 UI. 그림이 아니라 도구라서 헤드라인(PlaybackHeadline)과 분리돼
 * 있다 — 숏츠 화면은 이걸 9:16 카드 **밖**에 두어, 카드를 그대로 캡처하면 조작
 * 요소가 섞이지 않게 한다.
 *
 * 스크럽 막대의 값은 재생 루프가 ref로 직접 갱신한다(use-playback-display.ts).
 */
export function PlaybackScrubber({
  status,
  onStart,
  onSeek,
  sliderRef,
  scrubDisabled = false,
}: {
  status: PlaybackStatus;
  onStart: () => void;
  onSeek: (progress: number) => void;
  sliderRef: RefObject<HTMLInputElement | null>;
  /** 스크럽 막대를 비활성화할지. 그릴 canvas가 아직 없는 화면(예: 인라인 비교의
   *  idle 상태)에서만 호출자가 true를 넘긴다 — 이 컴포넌트 자신은 canvas 마운트
   *  여부를 모르므로 스스로 판단하지 않는다 */
  scrubDisabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      {/* 아이콘만 남기므로 접근성 이름은 aria-label이 진다 — 상태에 따라 실제로
          하는 일이 다르지 않지만(언제나 처음부터), 아이콘이 달라지는 만큼 이름도 맞춘다 */}
      <button
        type="button"
        onClick={onStart}
        aria-label={status === 'idle' ? '재생' : '처음부터 다시 재생'}
        title={status === 'idle' ? '재생' : '처음부터 다시 재생'}
        className="grid size-10 shrink-0 place-items-center rounded-full bg-zinc-900 text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {status === 'idle' ? <PlayIcon /> : <ReplayIcon />}
      </button>
      <input
        ref={sliderRef}
        type="range"
        min={0}
        max={1}
        step={0.001}
        defaultValue={0}
        aria-label="재생 위치"
        disabled={scrubDisabled}
        className="flex-1 disabled:cursor-not-allowed disabled:opacity-40"
        onChange={(event) => onSeek(Number(event.target.value))}
      />
    </div>
  );
}
