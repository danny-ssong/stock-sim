'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { findSyntheticRanges } from '../../lib/chart/synthetic-ranges';

type Point = { date: string; level: number; syntheticLevel: number | null; isSynthetic: boolean };

const HATCH_PATTERN_ID = 'backtest-synthetic-hatch';

export default function LogScaleLineChart({ data }: { data: Point[] }) {
  const syntheticRanges = findSyntheticRanges(
    data.map((point) => ({ label: point.date, isSynthetic: point.isSynthetic })),
  );

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data}>
        <defs>
          <pattern id={HATCH_PATTERN_ID} width={6} height={6} patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <line x1={0} y1={0} x2={0} y2={6} stroke="#f59e0b" strokeWidth={2} />
          </pattern>
        </defs>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" minTickGap={40} />
        <YAxis
          scale="log"
          domain={['auto', 'auto']}
          allowDataOverflow
          tickFormatter={(value: number) => value.toFixed(2)}
        />
        <Tooltip
          formatter={(value, name) => {
            if (typeof value !== 'number') return '';
            return [value.toFixed(3), name === 'syntheticLevel' ? '합성 구간' : '평가 지수(시작=1)'];
          }}
        />
        {syntheticRanges.map((range) => (
          <ReferenceArea
            key={`${range.x1}-${range.x2}`}
            x1={range.x1}
            x2={range.x2}
            fill={`url(#${HATCH_PATTERN_ID})`}
            fillOpacity={0.5}
            ifOverflow="visible"
          />
        ))}
        <Line type="monotone" dataKey="level" stroke="#2563eb" dot={false} isAnimationActive={false} />
        <Line
          type="monotone"
          dataKey="syntheticLevel"
          stroke="#2563eb"
          strokeDasharray="4 4"
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
