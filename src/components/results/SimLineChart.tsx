'use client';

import {
  CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { findSyntheticRanges } from '../../lib/chart/synthetic-ranges';

export type SimLineChartSeries = { key: string; name: string; color: string };
type Point = { x: string; isSynthetic?: boolean } & Record<string, number | string | boolean | null | undefined>;

const HATCH_PATTERN_ID = 'sim-line-chart-synthetic-hatch';

/**
 * 탭 1·2의 단일 시나리오 차트(상품 가격·평가액)와 탭 3의 다중 시나리오 오버레이가
 * 함께 쓰는 라인 차트다. series가 1개면 기존 LogScaleLineChart처럼 합성 구간을
 * 해칭으로 표시하고, 여러 개면(탭 3) 시나리오별 색상 구분이 우선이라 해칭은
 * 생략한다 — 여러 시나리오의 합성 구간이 겹치면 해칭만으로는 어느 시나리오인지
 * 구분할 수 없기 때문이다.
 */
export default function SimLineChart({
  data,
  series,
  scale = 'linear',
}: {
  data: Point[];
  series: SimLineChartSeries[];
  scale?: 'linear' | 'log';
}) {
  const syntheticRanges =
    series.length === 1
      ? findSyntheticRanges(data.map((point) => ({ label: point.x, isSynthetic: point.isSynthetic === true })))
      : [];

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data}>
        <defs>
          <pattern id={HATCH_PATTERN_ID} width={6} height={6} patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <line x1={0} y1={0} x2={0} y2={6} stroke="#f59e0b" strokeWidth={2} />
          </pattern>
        </defs>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="x" minTickGap={40} />
        <YAxis scale={scale} domain={scale === 'log' ? ['auto', 'auto'] : undefined} allowDataOverflow tickFormatter={(v: number) => v.toFixed(2)} />
        <Tooltip formatter={(value, name) => (typeof value === 'number' ? [value.toFixed(3), name] : ['', name])} />
        {syntheticRanges.map((range) => (
          <ReferenceArea key={`${range.x1}-${range.x2}`} x1={range.x1} x2={range.x2} fill={`url(#${HATCH_PATTERN_ID})`} fillOpacity={0.5} ifOverflow="visible" />
        ))}
        {series.map((s) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} dot={false} isAnimationActive={false} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
