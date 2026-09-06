'use client';

import { useCallback, useRef, type RefObject } from 'react';

/**
 * 재생 루프가 프레임마다 갱신하는 DOM 조각들을 한 곳에서 소유한다.
 *
 * 헤드라인·진행바·스크럽 막대는 프레임마다 바뀌지만 state로 올리면 초당 수십 번
 * 리렌더된다 — canvas를 고른 이유가 통째로 사라진다. 그래서 DOM을 직접 만진다.
 *
 * 이 훅이 ref를 들고 update를 내주는 이유는 **조각들이 서로 다른 곳에 놓이기
 * 때문이다**. 숏츠 화면은 헤드라인·진행바를 9:16 카드 안에 두고(캡처하면 그대로
 * 완성된 그림이어야 한다) 재생 버튼·스크럽은 카드 밖에 둔다. 한 컴포넌트가 셋을
 * 모두 렌더하던 시절에는 이 배치가 불가능했다.
 */
export type PlaybackDisplay = {
  headlineRef: RefObject<HTMLParagraphElement | null>;
  progressRef: RefObject<HTMLDivElement | null>;
  sliderRef: RefObject<HTMLInputElement | null>;
  /** 재생 루프가 프레임마다 부른다. 붙어 있지 않은 조각은 조용히 건너뛴다 */
  update: (progress: number, date: string) => void;
};

/** 'YYYY-MM-DD' → '2017.08.23'. 참고 영상과 같은 표기다 */
function formatHeadline(date: string): string {
  return date.replaceAll('-', '.');
}

export function usePlaybackDisplay(): PlaybackDisplay {
  const headlineRef = useRef<HTMLParagraphElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const sliderRef = useRef<HTMLInputElement | null>(null);

  // 세 조각이 모두 화면에 있어야 하는 것은 아니다 — 호출자가 일부만 배치할 수 있으므로
  // 각각 null을 확인한다. deps가 비어 있어도 되는 이유는 ref 객체의 identity가
  // 렌더를 건너 안정적이고, .current는 호출 시점에 다시 읽기 때문이다.
  const update = useCallback((progress: number, date: string) => {
    if (headlineRef.current !== null) headlineRef.current.textContent = formatHeadline(date);
    if (progressRef.current !== null) progressRef.current.style.width = `${progress * 100}%`;
    if (sliderRef.current !== null) sliderRef.current.value = String(progress);
  }, []);

  return { headlineRef, progressRef, sliderRef, update };
}
