'use client';

import { useCallback, useRef, type RefObject } from 'react';
import {
  EASE_FACTOR,
  easeDomain,
  targetDomain,
  type AxisDomain,
} from '../../lib/playback/axis-domain';
import {
  frameAt,
  timelineBounds,
  type PlaybackSeries,
  type TimeTick,
} from '../../lib/playback/timeline';
import {
  DEFAULT_PADDING,
  drawPlaybackFrame,
  type PlaybackSeriesStyle,
  type PlaybackTheme,
} from './draw-frame';

/**
 * x축이 완전히 눌리지 않도록 보장하는 최소 폭. 전체 구간 대비 비율이다 —
 * progress 0에서는 보이는 구간의 길이가 0이라 좌표 변환이 0으로 나눈다.
 */
const MIN_X_SPAN_RATIO = 0.02;

export type PlaybackCanvasConfig = {
  series: readonly PlaybackSeries[];
  styles: readonly PlaybackSeriesStyle[];
  /** buildTimeTicks로 미리 만든 축 라벨 후보. 프레임마다 다시 만들지 않는다 */
  ticks: readonly TimeTick[];
  theme: PlaybackTheme;
  valueFormatter: (value: number) => string;
  changeRateOf?: (key: string) => number | null;
};

/**
 * canvas 하나를 굴리는 데 필요한 배선 — 크기 측정, DPR 보정, 도메인 보간 상태, draw 호출.
 *
 * 컴포넌트가 아니라 훅인 이유는 호출자가 canvas를 여러 개 가질 수 있기 때문이다
 * (비교 화면은 2개, 숏츠는 1개). 컴포넌트로 만들면 부모의 재생 루프가 자식의 draw를
 * 불러야 해서 useImperativeHandle이 필요해지는데, 훅이면 호출자가 drawAt을 그냥 들고 있으면 된다.
 *
 * 캔버스 크기는 draw 때마다 읽지 않고 첫 프레임에 한 번 읽어 캐시한다 — 매 프레임
 * getBoundingClientRect를 부르면 강제 레이아웃이 프레임마다 일어난다. 재생 도중
 * 창 크기를 바꾸는 경우는 다루지 않는다(재생을 다시 시작하면 새 크기로 잡힌다).
 */
export function usePlaybackCanvas(config: PlaybackCanvasConfig): {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  drawAt: (progress: number) => void;
} {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const domainRef = useRef<AxisDomain | null>(null);
  const sizeRef = useRef<{ width: number; height: number } | null>(null);

  const { series, styles, ticks, theme, valueFormatter, changeRateOf } = config;

  const drawAt = useCallback(
    (progress: number) => {
      const canvas = canvasRef.current;
      if (canvas === null) return;
      const ctx = canvas.getContext('2d');
      if (ctx === null) return;

      const bounds = timelineBounds(series);
      if (bounds === null) return;

      if (progress <= 0) {
        // 새 재생이 시작됐다 — 크기와 도메인 캐시를 버리고 다시 잡는다
        sizeRef.current = null;
        domainRef.current = null;
      }

      if (sizeRef.current === null) {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;
        sizeRef.current = { width: rect.width, height: rect.height };
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      const size = sizeRef.current;

      const frame = frameAt(series, bounds, progress);
      const target = targetDomain(frame);
      // 첫 프레임은 보간할 이전 값이 없으므로 목표를 그대로 쓴다
      const domain =
        domainRef.current === null ? target : easeDomain(domainRef.current, target, EASE_FACTOR);
      domainRef.current = domain;

      const totalSpan = bounds.to - bounds.from;
      const xTo = Math.max(frame.time, bounds.from + totalSpan * MIN_X_SPAN_RATIO);

      drawPlaybackFrame(ctx, {
        frame,
        xRange: { from: bounds.from, to: xTo },
        yDomain: domain,
        series: styles,
        ticks,
        layout: { width: size.width, height: size.height, padding: DEFAULT_PADDING },
        theme,
        valueFormatter,
        changeRateOf,
      });
    },
    [series, styles, ticks, theme, valueFormatter, changeRateOf],
  );

  return { canvasRef, drawAt };
}
