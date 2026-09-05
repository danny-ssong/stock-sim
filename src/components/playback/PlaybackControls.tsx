'use client';

import { useImperativeHandle, useRef, type RefObject } from 'react';
import type { PlaybackStatus } from './use-playback';

/**
 * 재생 루프가 프레임마다 부르는 갱신 창구.
 *
 * 부모가 useRef로 만들어 handleRef로 내려주고, 이 컴포넌트가 렌더 시점에 채운다.
 * 헤드라인과 진행바는 프레임마다 바뀌지만 state로 올리면 초당 수십 번 리렌더된다 —
 * DOM을 직접 만지는 것이 이 화면에서는 정확한 도구다.
 */
export type PlaybackControlsHandle = { update: (progress: number, date: string) => void };

/** 'YYYY-MM-DD' → '2017.08.23'. 참고 영상과 같은 표기다 */
function formatHeadline(date: string): string {
  return date.replaceAll('-', '.');
}

export function PlaybackControls({
  status,
  onStart,
  onSeek,
  handleRef,
  large = false,
  scrubDisabled = false,
}: {
  status: PlaybackStatus;
  onStart: () => void;
  onSeek: (progress: number) => void;
  handleRef: RefObject<PlaybackControlsHandle | null>;
  /** 숏츠 화면은 헤드라인을 크게 쓴다 */
  large?: boolean;
  /** 스크럽 막대를 비활성화할지. 그릴 canvas가 아직 없는 화면(예: 인라인 비교의
   *  idle 상태)에서만 호출자가 true를 넘긴다 — 이 컴포넌트 자신은 canvas 마운트
   *  여부를 모르므로 스스로 판단하지 않는다 */
  scrubDisabled?: boolean;
}) {
  const headlineRef = useRef<HTMLParagraphElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const sliderRef = useRef<HTMLInputElement | null>(null);

  // handleRef는 부모가 재생 루프에서 읽을 창구일 뿐이고 이 컴포넌트의 출력에 영향을 주지
  // 않는다. 렌더 함수 본문에서 직접 `handleRef.current = ...`로 대입하면(브리프 원안)
  // react-hooks/refs 규칙이 "렌더 중 ref 쓰기"로 막는다 — useImperativeHandle은 정확히
  // 이 용도(부모가 만든 ref에 자식이 명령형 API를 채워 넣는 것)를 위한 React 내장 훅이고,
  // 대입은 React 내부 커밋 단계에서 일어나므로 렌더 순수성 규칙에 걸리지 않는다.
  // deps를 []로 둬 최초 커밋에서 한 번만 만든다 — update 클로저는 호출 시점에 내부 ref를
  // 다시 읽으므로 매 렌더 새로 만들 필요가 없다.
  useImperativeHandle(
    handleRef,
    () => ({
      update: (progress, date) => {
        if (headlineRef.current !== null) headlineRef.current.textContent = formatHeadline(date);
        if (barRef.current !== null) barRef.current.style.width = `${progress * 100}%`;
        if (sliderRef.current !== null) sliderRef.current.value = String(progress);
      },
    }),
    [],
  );

  return (
    <div className="flex flex-col gap-2">
      <p
        ref={(node) => {
          headlineRef.current = node;
        }}
        className={`text-center font-medium tabular-nums ${large ? 'text-2xl' : 'text-sm'}`}
      >
        {' '}
      </p>

      <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
        <div
          ref={(node) => {
            barRef.current = node;
          }}
          className="h-full w-0 rounded-full bg-amber-400"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onStart}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          {status === 'idle' ? '재생' : '다시 재생'}
        </button>
        <input
          ref={(node) => {
            sliderRef.current = node;
          }}
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
    </div>
  );
}
