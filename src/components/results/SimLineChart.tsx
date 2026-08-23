'use client';

import {
  CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { findSyntheticRanges } from '../../lib/chart/synthetic-ranges';

export type SimLineChartSeries = { key: string; name: string; color: string };
type Point = { x: string; isSynthetic?: boolean } & Record<string, number | string | boolean | null | undefined>;

const HATCH_PATTERN_ID = 'sim-line-chart-synthetic-hatch';

/**
 * 노출 1개짜리 단일 시리즈 차트(상품 가격·평가액)와 노출 여러 개짜리 비교
 * 오버레이가 함께 쓰는 라인 차트다. series가 1개면 기존 LogScaleLineChart처럼
 * 합성 구간을 해칭으로 표시하고, 여러 개면 노출별 색상 구분이 우선이라 해칭은
 * 생략한다 — 여러 노출의 합성 구간이 겹치면 해칭만으로는 어느 노출인지
 * 구분할 수 없기 때문이다.
 */
export default function SimLineChart({
  data,
  series,
  scale = 'linear',
  valueFormatter,
}: {
  data: Point[];
  series: SimLineChartSeries[];
  scale?: 'linear' | 'log';
  /** 툴팁·Y축 값을 사람이 읽기 좋은 문자열로 바꾼다. 생략하면 소수 표기를 쓴다. */
  valueFormatter?: (value: number) => string;
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
        <YAxis
          scale={scale}
          domain={scale === 'log' ? ['auto', 'auto'] : undefined}
          allowDataOverflow
          tickFormatter={(v: number) => (valueFormatter ? valueFormatter(v) : v.toFixed(2))}
        />
        <Tooltip
          formatter={(value, name) =>
            typeof value === 'number' ? [valueFormatter ? valueFormatter(value) : value.toFixed(3), name] : ['', name]
          }
        />
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
