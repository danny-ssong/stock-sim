import type { PlaybackFrame } from './timeline';

export type AxisDomain = { min: number; max: number };

/** 최대값 위에 남길 여백. 선이 차트 천장에 닿아 잘려 보이지 않게 한다 */
export const HEADROOM = 1.08;

/**
 * 한 프레임에 도메인이 목표로 다가가는 비율.
 *
 * 1로 두면 신고가가 나올 때마다 축이 즉시 튀어 덜컥거린다. 0.15면 약 15프레임
 * (60fps에서 0.25초)에 걸쳐 따라잡아, 선이 매끄럽게 자라는 것처럼 보인다.
 */
export const EASE_FACTOR = 0.15;

/** 보이는 점이 하나도 없을 때 쓰는 도메인. 0으로 나누는 것을 막는다 */
const FALLBACK: AxisDomain = { min: 0, max: 1 };

/**
 * 지금 보이는 점들이 요구하는 도메인.
 *
 * 0을 항상 포함한다 — 이 차트는 "넣은 돈 대비 얼마"를 보는 것이고 원금 라인이 함께
 * 그려지므로 0 기준이 의미를 갖는다. 가격 차트도 시작을 1로 정규화한 레벨이라
 * (PortfolioIndexPoint.level) 0 기준이 "몇 배가 됐나"를 그대로 보여준다.
 */
export function targetDomain(frame: PlaybackFrame): AxisDomain {
  let min = 0;
  let max = 0;
  let seen = false;

  for (const series of frame.visible) {
    for (let i = 0; i < series.count; i += 1) {
      const { value } = series.points[i];
      if (!Number.isFinite(value)) continue;
      if (!seen) {
        seen = true;
        min = Math.min(0, value);
        max = Math.max(0, value);
        continue;
      }
      if (value < min) min = value;
      if (value > max) max = value;
    }
  }

  if (!seen) return FALLBACK;

  const paddedMax = max > 0 ? max * HEADROOM : max;
  const paddedMin = min < 0 ? min * HEADROOM : min;
  // 모든 값이 0이면 높이가 0인 도메인이 나와 좌표 변환이 0으로 나눈다
  return paddedMax > paddedMin ? { min: paddedMin, max: paddedMax } : { min: paddedMin, max: paddedMin + 1 };
}

/** 이전 도메인에서 목표 도메인으로 factor(0~1)만큼 이동한 도메인 */
export function easeDomain(previous: AxisDomain, target: AxisDomain, factor: number): AxisDomain {
  return {
    min: previous.min + (target.min - previous.min) * factor,
    max: previous.max + (target.max - previous.max) * factor,
  };
}

/**
 * 사람이 읽기 좋은 눈금 값을 고른다 — 간격을 1·2·5 × 10^n 중에서 고른다.
 *
 * 도메인이 매 프레임 바뀌므로 눈금도 매 프레임 다시 고른다. 그래도 이 계열을 쓰면
 * 도메인이 조금 움직이는 동안 눈금 값이 유지되어 축이 깜빡이지 않는다.
 */
export function niceTicks(min: number, max: number, targetCount: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min || targetCount < 1) return [min];

  const rawStep = (max - min) / targetCount;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;

  const ticks: number[] = [];
  // 누적 덧셈은 오차가 쌓이므로 곱셈으로 만든다 — 0.1 + 0.2 류의 찌꺼기를 막는다
  const firstIndex = Math.ceil(min / step);
  const lastIndex = Math.floor(max / step);
  for (let i = firstIndex; i <= lastIndex; i += 1) ticks.push(i * step);
  return ticks.length > 0 ? ticks : [min];
}
