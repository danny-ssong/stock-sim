'use client';

import type { RefObject } from 'react';
import type { PlaybackStatus } from './use-playback';

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
      <button
        type="button"
        onClick={onStart}
        className="shrink-0 rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        {status === 'idle' ? '재생' : '다시 재생'}
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
