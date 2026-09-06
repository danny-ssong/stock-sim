'use client';

import type { ChartPlayback } from './use-chart-playback';
import { PlaybackScrubber, PlayButton } from './PlaybackScrubber';

/**
 * 재생 조작 한 줄. **차트 바로 위에 둔다** — 날짜 헤드라인은 애니메이션의 "지금
 * 어디를 보고 있는지"라서 자기가 가리키는 canvas 옆에 있어야 한다. 차트 아래에
 * 두면 320px짜리 차트 두 개 너머라 눈이 왕복해야 한다.
 *
 * 높이를 h-10으로 고정하고 헤드라인 폭도 고정하는 이유: 진행바와 스크럽이 재생
 * 중에만 나타나는데, 높이가 내용에 따라 변하면 등장·퇴장마다 아래 차트가 밀린다.
 * 고정해 두면 idle에서 못 쓰는 슬라이더를 상시 노출하지 않아도 레이아웃이 안정적이다.
 */
export function PlaybackTransport({ playback }: { playback: ChartPlayback }) {
  const { status, start, seek, display, showsCanvas } = playback;
  // display를 통째로 JSX에 넘기면(display.progressRef처럼 프로퍼티로 바로 접근하면)
  // react-hooks/refs가 렌더 중 ref 접근으로 오탐한다 — 반환값을 즉시 구조분해해
  // 두어야 규칙이 조용하다(use-chart-playback.ts의 계약과 같은 이유).
  const { headlineRef, progressRef, sliderRef } = display;

  return (
    <div className="flex h-10 items-center gap-3">
      <PlayButton status={status} onStart={start} />

      <p ref={headlineRef} className="w-24 shrink-0 text-sm font-medium tabular-nums" />

      {showsCanvas ? (
        <>
          <div className="h-1 w-24 shrink-0 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
            <div ref={progressRef} className="h-full w-0 rounded-full bg-amber-400" />
          </div>
          <PlaybackScrubber onSeek={seek} sliderRef={sliderRef} />
        </>
      ) : (
        <span className="text-xs text-zinc-400">재생하면 기간을 따라 그려집니다</span>
      )}
    </div>
  );
}
