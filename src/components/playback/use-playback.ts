'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type PlaybackStatus = 'idle' | 'playing' | 'finished';

/** 데이터 기간과 무관한 고정 재생 시간. 10년이든 30년이든 같다 */
export const PLAYBACK_DURATION_MS = 12_000;

/** 재생이 끝난 뒤 마지막 프레임을 보여주는 시간. 이후 정적 차트로 돌아간다 */
export const RESTORE_DELAY_MS = 3_000;

export type UsePlaybackOptions = {
  /**
   * 프레임마다 호출된다. 여기서 canvas와 DOM ref를 직접 갱신한다 —
   * 이 콜백 안에서 setState를 부르면 재생 내내 리렌더가 일어나 이 설계의 전제가 깨진다.
   */
  onFrame: (progress: number) => void;
  durationMs?: number;
  /** 생략하면 완료 후 마지막 프레임을 그대로 둔다(숏츠 탭) */
  restoreDelayMs?: number;
  /** 정적 차트로 돌아갈 시점을 알린다(인라인 전용) */
  onRestore?: () => void;
};

/**
 * 재생 루프. rAF 콜백이 진행도를 계산해 onFrame으로 넘긴다.
 *
 * **재생 중에는 리렌더가 일어나지 않는다.** status가 바뀌는 순간(재생 시작 / 완료 /
 * 복구)에만 setState를 부르므로 재생 한 번에 최대 3회다. 프레임마다 setState를 하면
 * canvas를 써도 React 비용이 그대로 남아, 이 구조를 택한 이유가 사라진다.
 *
 * onFrame은 start를 부른 시점의 것을 재생이 끝날 때까지 쓴다 — 재생 중에 입력이
 * 바뀌면 어차피 처음부터 다시 재생해야 하므로, 최신 클로저를 좇기 위해 ref를
 * 렌더 중에 쓰는 편법보다 이쪽이 안전하고 읽기 쉽다.
 */
export function usePlayback({
  onFrame,
  durationMs = PLAYBACK_DURATION_MS,
  restoreDelayMs,
  onRestore,
}: UsePlaybackOptions): {
  status: PlaybackStatus;
  start: () => void;
  stop: () => void;
  seek: (progress: number) => void;
} {
  const [status, setStatus] = useState<PlaybackStatus>('idle');
  const rafRef = useRef<number | null>(null);

  const cancelLoop = useCallback(() => {
    if (rafRef.current === null) return;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const start = useCallback(() => {
    cancelLoop();
    setStatus('playing');

    let startedAt: number | null = null;
    let finishedAt: number | null = null;

    const tick = (now: number) => {
      if (startedAt === null) startedAt = now;

      if (finishedAt === null) {
        const progress = Math.min((now - startedAt) / durationMs, 1);
        onFrame(progress);
        if (progress >= 1) {
          finishedAt = now;
          setStatus('finished');
        }
      } else if (restoreDelayMs === undefined) {
        // 숏츠 탭: 마지막 프레임을 그대로 두고 루프를 끝낸다
        cancelLoop();
        return;
      } else if (now - finishedAt >= restoreDelayMs) {
        cancelLoop();
        setStatus('idle');
        onRestore?.();
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [cancelLoop, durationMs, onFrame, restoreDelayMs, onRestore]);

  const stop = useCallback(() => {
    cancelLoop();
    setStatus('idle');
    onRestore?.();
  }, [cancelLoop, onRestore]);

  /** 스크럽. 재생을 멈추고 그 지점을 그린다. 다시 재생하면 처음부터다 */
  const seek = useCallback(
    (progress: number) => {
      cancelLoop();
      setStatus('playing');
      onFrame(Math.min(Math.max(progress, 0), 1));
    },
    [cancelLoop, onFrame],
  );

  // 이 플랜에서 유일한 useEffect다. 언마운트될 때 루프를 정리하는 것 외에 하는 일이 없다 —
  // 재생 시작은 이벤트 핸들러(start)가 직접 하므로 effect로 동기화할 상태가 없다.
  useEffect(() => cancelLoop, [cancelLoop]);

  return { status, start, stop, seek };
}
