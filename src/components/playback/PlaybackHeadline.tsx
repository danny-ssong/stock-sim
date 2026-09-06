'use client';

import type { RefObject } from 'react';

/**
 * 재생 중인 시점과 진행도. 조작 요소가 아니라 **그림의 일부**라서 재생 버튼과
 * 분리돼 있다 — 숏츠 카드는 이 둘만 담고 버튼은 카드 밖에 둔다(ShortsView).
 *
 * 내용은 재생 루프가 ref로 직접 갱신한다(use-playback-display.ts). 이 컴포넌트는
 * 자리와 모양만 정한다.
 */
export function PlaybackHeadline({
  headlineRef,
  progressRef,
  large = false,
}: {
  headlineRef: RefObject<HTMLParagraphElement | null>;
  progressRef: RefObject<HTMLDivElement | null>;
  /** 숏츠 화면은 날짜를 크게 쓴다 */
  large?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      {/* 공백 하나를 자식으로 둔다 — 첫 프레임이 오기 전에도 줄 높이를 차지해야
          재생을 시작하거나 끝낼 때 아래 요소들이 밀려 올라오지 않는다 */}
      <p
        ref={headlineRef}
        className={`text-center font-medium tabular-nums ${large ? 'text-3xl' : 'text-sm'}`}
      >
        {' '}
      </p>

      <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
        <div ref={progressRef} className="h-full w-0 rounded-full bg-amber-400" />
      </div>
    </div>
  );
}
