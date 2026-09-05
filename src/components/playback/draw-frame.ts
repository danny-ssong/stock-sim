import { niceTicks, type AxisDomain } from '../../lib/playback/axis-domain';
import type { PlaybackFrame, PlaybackPoint, TimeTick } from '../../lib/playback/timeline';

export type PlaybackSeriesStyle = {
  key: string;
  name: string;
  color: string;
  /** 원금처럼 "값 라인이 아닌 기준선"은 점선으로 그리고 영역을 채우지 않는다 */
  dashed?: boolean;
  filled?: boolean;
};

export type PlaybackTheme = {
  background: string;
  grid: string;
  axisText: string;
};

export const LIGHT_THEME: PlaybackTheme = {
  background: '#ffffff',
  grid: '#e4e4e7',
  axisText: '#71717a',
};

/** 숏츠 화면 전용. 앱 테마와 무관하게 고정한다 — 영상 포맷의 임팩트가 여기서 나온다 */
export const DARK_THEME: PlaybackTheme = {
  background: '#09090b',
  grid: '#27272a',
  axisText: '#a1a1aa',
};

export type PlaybackLayout = {
  /** CSS 픽셀 기준. backing store 배율(dpr)은 호출자가 ctx.scale로 이미 걸어 둔다 */
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
};

/**
 * 왼쪽 96px은 정적 차트의 Y축 폭(SHARED_Y_AXIS_WIDTH)과 같다 — 재생이 끝나고 정적
 * 차트로 돌아갈 때 플롯 영역의 좌측 시작점이 어긋나지 않게 한다.
 * 오른쪽 108px은 끝점 라벨(종목명 / 수익률 · 금액)이 들어갈 자리다.
 */
export const DEFAULT_PADDING: PlaybackLayout['padding'] = {
  top: 16,
  right: 108,
  bottom: 28,
  left: 96,
};

export type DrawFrameArgs = {
  frame: PlaybackFrame;
  /** 이 프레임의 x 범위. to는 현재 시점이라 프레임마다 넓어진다 */
  xRange: { from: number; to: number };
  yDomain: AxisDomain;
  series: readonly PlaybackSeriesStyle[];
  /** 전체 구간 기준으로 미리 만들어 둔 라벨 후보. 현재 시점 이하만 그린다 */
  ticks: readonly TimeTick[];
  layout: PlaybackLayout;
  theme: PlaybackTheme;
  /** 축 라벨과 끝점 라벨의 금액 표기 */
  valueFormatter: (value: number) => string;
  /** 끝점 라벨에 함께 띄울 수익률. 그 프레임의 마지막 점을 받아 그 시점 기준으로 계산한다 —
   *  최종 수익률과 현재 평가액을 나란히 붙이면 한 라벨이 서로 다른 두 시점을 말하게 된다. */
  changeRateOf?: (key: string, point: PlaybackPoint) => number | null;
};

const FONT_STACK =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/** '#2563eb' → 'rgba(37, 99, 235, alpha)'. 시리즈 색은 모두 6자리 hex다(lib/chart/colors.ts) */
function withAlpha(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  if (!Number.isFinite(value)) return hex;
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** 끝점 라벨 한 덩어리. 겹침을 풀기 위해 y를 나중에 옮긴다 */
type EndLabel = { name: string; detail: string; color: string; y: number };

/** 라벨이 세로로 겹치지 않도록 아래로 밀어낸다. 최소 간격만 지키는 단순한 방식이다 */
function spreadLabels(labels: EndLabel[], minGap: number, bottom: number): EndLabel[] {
  const sorted = [...labels].sort((a, b) => a.y - b.y);
  for (let i = 1; i < sorted.length; i += 1) {
    const gap = sorted[i].y - sorted[i - 1].y;
    if (gap < minGap) sorted[i].y = sorted[i - 1].y + minGap;
  }
  // 아래로만 밀면 마지막 라벨이 차트 밖으로 나갈 수 있어, 넘친 만큼 전체를 위로 당긴다
  const overflow = sorted.length > 0 ? sorted[sorted.length - 1].y - bottom : 0;
  if (overflow > 0) for (const label of sorted) label.y -= overflow;
  return sorted;
}

function formatRate(rate: number): string {
  const sign = rate >= 0 ? '+' : '';
  return `${sign}${(rate * 100).toFixed(1)}%`;
}

/**
 * 한 프레임을 통째로 그린다.
 *
 * 다운샘플하지 않고 원본 점을 그대로 그린다 — canvas는 30년 일별 7,500개 lineTo를
 * 프레임당 수 ms에 처리한다. 다운샘플러(lib/chart/downsample.ts)가 필요했던 것은
 * recharts의 SVG DOM 비용 때문이지 데이터 자체 때문이 아니었다.
 */
export function drawPlaybackFrame(ctx: CanvasRenderingContext2D, args: DrawFrameArgs): void {
  const { frame, xRange, yDomain, series, ticks, layout, theme, valueFormatter, changeRateOf } = args;
  const { width, height, padding } = layout;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  if (plotWidth <= 0 || plotHeight <= 0) return;

  const xSpan = Math.max(xRange.to - xRange.from, 1);
  const ySpan = Math.max(yDomain.max - yDomain.min, Number.EPSILON);
  const xAt = (time: number) => padding.left + ((time - xRange.from) / xSpan) * plotWidth;
  const yAt = (value: number) =>
    padding.top + plotHeight - ((value - yDomain.min) / ySpan) * plotHeight;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, width, height);

  // ── Y 눈금과 가로 그리드
  ctx.font = `12px ${FONT_STACK}`;
  ctx.lineWidth = 1;
  for (const value of niceTicks(yDomain.min, yDomain.max, 5)) {
    // 0.5를 더해 1px 선이 두 픽셀에 걸쳐 흐려지는 것을 막는다
    const y = Math.round(yAt(value)) + 0.5;
    ctx.strokeStyle = theme.grid;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();

    ctx.fillStyle = theme.axisText;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(valueFormatter(value), padding.left - 8, y);
  }

  // ── X 라벨. 후보는 전체 구간 기준으로 고정이고 현재 시점 이하만 나타난다
  ctx.fillStyle = theme.axisText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const tick of ticks) {
    if (tick.time < xRange.from || tick.time > xRange.to) continue;
    ctx.fillText(tick.label, xAt(tick.time), height - padding.bottom + 8);
  }

  // ── 시리즈
  const endLabels: EndLabel[] = [];
  const baselineY = yAt(Math.max(yDomain.min, 0));

  for (const style of series) {
    const visible = frame.visible.find((one) => one.key === style.key);
    if (visible === undefined || visible.count === 0) continue;
    const { points, count } = visible;

    if (style.filled === true) {
      ctx.beginPath();
      ctx.moveTo(xAt(points[0].time), baselineY);
      for (let i = 0; i < count; i += 1) ctx.lineTo(xAt(points[i].time), yAt(points[i].value));
      ctx.lineTo(xAt(points[count - 1].time), baselineY);
      ctx.closePath();
      const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + plotHeight);
      gradient.addColorStop(0, withAlpha(style.color, 0.3));
      gradient.addColorStop(1, withAlpha(style.color, 0));
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    ctx.beginPath();
    ctx.moveTo(xAt(points[0].time), yAt(points[0].value));
    for (let i = 1; i < count; i += 1) ctx.lineTo(xAt(points[i].time), yAt(points[i].value));
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.dashed === true ? 1.5 : 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.setLineDash(style.dashed === true ? [5, 5] : []);
    ctx.stroke();
    ctx.setLineDash([]);

    const last = points[count - 1];
    const rate = changeRateOf?.(style.key, last) ?? null;
    endLabels.push({
      name: style.name,
      detail: rate === null ? valueFormatter(last.value) : `${formatRate(rate)} · ${valueFormatter(last.value)}`,
      color: style.color,
      y: yAt(last.value),
    });
  }

  // ── 끝점 라벨. 선 끝을 따라다니는 이 라벨이 이 차트의 핵심 연출이다
  const labelX = width - padding.right + 10;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (const label of spreadLabels(endLabels, 32, height - padding.bottom)) {
    ctx.fillStyle = label.color;
    ctx.font = `bold 13px ${FONT_STACK}`;
    ctx.fillText(label.name, labelX, label.y - 8);
    ctx.font = `12px ${FONT_STACK}`;
    ctx.fillText(label.detail, labelX, label.y + 8);
  }
}
