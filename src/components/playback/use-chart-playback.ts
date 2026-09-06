'use client';

import { useMemo, type RefObject } from 'react';
import {
  buildTimeTicks,
  timelineBounds,
  toDateString,
  type TimeTick,
} from '../../lib/playback/timeline';
import type { PlaybackTheme } from './draw-frame';
import { EMPTY_BUNDLE, type PlaybackBundle } from './series';
import { PLAYBACK_DURATION_MS, usePlayback, type PlaybackStatus } from './use-playback';
import { usePlaybackCanvas, type PlaybackCanvasConfig } from './use-playback-canvas';
import { usePlaybackDisplay, type PlaybackDisplay } from './use-playback-display';

export type ChartPlaybackTrack = {
  bundle: PlaybackBundle;
  valueFormatter: (value: number) => string;
};

/** 트랙이 없는 canvas 자리를 채우는 값들. 모듈 상수라 매 렌더 identity가 그대로다 */
const EMPTY_TICKS: readonly TimeTick[] = [];
const EMPTY_TRACK: ChartPlaybackTrack = { bundle: EMPTY_BUNDLE, valueFormatter: () => '' };

export type ChartPlayback = {
  /** bundle 순서와 같다. 호출자가 canvas에 그대로 붙인다 */
  canvasRefs: readonly RefObject<HTMLCanvasElement | null>[];
  status: PlaybackStatus;
  start: () => void;
  seek: (progress: number) => void;
  display: PlaybackDisplay;
  /**
   * idle이 아니면(재생 중이거나 방금 끝나 마지막 프레임을 유지하는 중이면) canvas가,
   * idle이면 정적 차트가 자리를 차지한다. 'finished'도 포함하는 이름이라야 하므로
   * '재생 중'을 뜻하는 isPlaying이 아니라 showsCanvas로 부른다.
   */
  showsCanvas: boolean;
};

/**
 * 차트 여러 개를 한 재생 컨트롤로 굴리는 배선.
 *
 * **bounds 합집합을 여기서 계산한다.** 진행도가 날짜 기준이므로 모든 canvas가 같은
 * bounds를 써야 해상도가 다른 차트들(가격 일별 / 자산 월별)이 같은 시점에서 함께
 * 멈춘다. 이 불변식을 호출자마다 다시 세우면 한 곳만 빠뜨려도 조용히 어긋난다.
 *
 * 훅이 컴포넌트가 아닌 이유는 usePlaybackCanvas와 같다 — 호출자가 canvas를 여러 개
 * 가질 수 있고, 그리기를 부모의 재생 루프가 직접 불러야 하기 때문이다.
 */
export function useChartPlayback({
  tracks,
  theme,
  restoreDelayMs,
  durationMs = PLAYBACK_DURATION_MS,
}: {
  /** 최대 2개까지 굴린다(아래 usePlaybackCanvas 고정 호출 참고). 3개째부터는 무시된다 */
  tracks: readonly ChartPlaybackTrack[];
  theme: PlaybackTheme;
  /** 넘기지 않으면 재생이 끝나도 마지막 프레임을 유지한다(숏츠 화면) */
  restoreDelayMs?: number;
  durationMs?: number;
}): ChartPlayback {
  // 틱과 bounds는 bundle이 안 바뀌면 다시 만들 이유가 없다. buildTimeTicks가 날짜
  // 배열을 통째로 훑고, 합집합은 모든 시리즈의 모든 점을 본다 — idle 상태(canvas가
  // 마운트조차 안 된 상태)의 리렌더에서도 매번 도는 것을 막는다.
  const { ticksPerTrack, bounds } = useMemo(() => {
    const allSeries = tracks.flatMap((track) => [...track.bundle.series]);
    return {
      ticksPerTrack: tracks.map((track) => buildTimeTicks(track.bundle.dates)),
      // null(그릴 점이 없음)이면 호출자가 애초에 canvas를 마운트하지 않으므로
      // 이 폴백은 타입을 맞추는 용도일 뿐이다.
      bounds: timelineBounds(allSeries) ?? { from: 0, to: 0 },
    };
  }, [tracks]);

  // 자리 하나의 canvas 설정. 트랙이 없으면 빈 번들로 채워, 그 자리 canvas가 마운트되든
  // 말든 그릴 점이 없게 만든다 — 호출자가 트랙을 하나만 넘겨도 훅 호출 수는 그대로다.
  const configAt = (index: number): PlaybackCanvasConfig => {
    const track = tracks.at(index) ?? EMPTY_TRACK;
    return {
      series: track.bundle.series,
      styles: track.bundle.styles,
      ticks: ticksPerTrack.at(index) ?? EMPTY_TICKS,
      bounds,
      theme,
      valueFormatter: track.valueFormatter,
      changeRateOf: track.bundle.changeRateOf,
    };
  };

  // **canvas는 정확히 2개를 고정 위치에서 부른다.** 훅 호출 수는 렌더마다 같아야 하므로
  // tracks 길이만큼 반복해 부를 수 없다 — 지금 호출자들이 필요로 하는 최대치(비교 화면의
  // 가격·자산 2개)를 상한으로 박고, 트랙이 없는 자리는 빈 번들로 채운다. 트랙이 3개
  // 이상 필요해지면 여기에 호출을 한 줄 더한다.
  //
  // 돌려줄 때는 넘어온 트랙 수만큼만 잘라, canvasRefs가 "bundle 순서와 같다"는 계약을
  // 지키게 한다(트랙 1개짜리 호출자가 쓰지 않을 ref를 받지 않는다).
  const canvasSlots = [usePlaybackCanvas(configAt(0)), usePlaybackCanvas(configAt(1))];
  const canvases = canvasSlots.slice(0, tracks.length);

  const display = usePlaybackDisplay();

  const onFrame = (progress: number) => {
    for (const canvas of canvases) canvas.drawAt(progress);
    const time = bounds.from + (bounds.to - bounds.from) * progress;
    display.update(progress, toDateString(time));
  };

  // 정적 차트로 돌아가면 헤드라인·진행바도 초기 상태로 되돌린다. 빈 문자열을 넘겨도
  // 되는 이유는 이 ref가 붙는 <p>가 트랜스포트의 고정 h-10 줄 안에 있어서다
  // (PlaybackTransport) — 줄 높이를 문단 내용이 지탱할 필요가 없다.
  const onRestore = () => display.update(0, '');

  // UsePlaybackOptions는 restoreDelayMs 유무로 갈리는 판별 유니온이라, 조건부 스프레드로
  // 만든 객체는 어느 쪽 arm에도 맞지 않는다. 삼항으로 완성된 arm 하나를 통째로 넘겨
  // 타입 단언 없이 좁힌다.
  const { status, start, seek } = usePlayback(
    restoreDelayMs === undefined
      ? { durationMs, onFrame }
      : { durationMs, onFrame, restoreDelayMs, onRestore },
  );

  return {
    canvasRefs: canvases.map((canvas) => canvas.canvasRef),
    status,
    start,
    seek,
    display,
    showsCanvas: status !== 'idle',
  };
}
