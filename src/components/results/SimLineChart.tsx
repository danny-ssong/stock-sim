'use client';

import { useMemo } from 'react';
import {
  CartesianGrid, Legend, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { downsampleByKeys } from '../../lib/chart/downsample';
import { findSyntheticRanges } from '../../lib/chart/synthetic-ranges';

export type SimLineChartSeries = {
  key: string;
  name: string;
  color: string;
  /** true면 점선으로 그린다 — 원금처럼 "값 라인이 아닌 기준선" 시리즈에 쓴다. */
  dashed?: boolean;
};
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
  // series는 호출자가 렌더마다 인라인으로 만들어 identity가 매번 바뀐다 —
  // 의존성에 그대로 쓰면 memo가 한 번도 적중하지 않으므로 key 목록을 문자열로 굳힌다.
  const seriesKeys = series.map((s) => s.key).join(',');
  const rendered = useMemo(
    () => downsampleByKeys(data, seriesKeys.split(',')),
    [data, seriesKeys],
  );

  // 합성 구간은 반드시 다운샘플 '이후' 배열로 계산한다 — x축이 카테고리 축이라
  // ReferenceArea의 x1/x2가 축에 실제로 남아 있는 라벨이어야 하는데, 원본 기준으로
  // 잡으면 그 경계 날짜가 솎여 나갔을 때 해칭이 그려지지 않는다.
  // 대가로 경계가 최대 한 버킷만큼 밀릴 수 있다(29년 기준 한 달 남짓, 1px 미만).
  const syntheticRanges =
    series.length === 1
      ? findSyntheticRanges(rendered.map((point) => ({ label: point.x, isSynthetic: point.isSynthetic === true })))
      : [];

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={rendered}>
        <defs>
          <pattern id={HATCH_PATTERN_ID} width={6} height={6} patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <line x1={0} y1={0} x2={0} y2={6} stroke="#f59e0b" strokeWidth={2} />
          </pattern>
        </defs>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="x" minTickGap={40} />
        {/* width="auto"는 렌더된 틱 라벨을 실측해 축 너비를 맞춘다. 고정 width(기본 60)로는
            "400.00억"처럼 단위가 붙어 길어진 라벨이 SVG 왼쪽 경계에서 잘린다. */}
        <YAxis
          scale={scale}
          domain={scale === 'log' ? ['auto', 'auto'] : undefined}
          allowDataOverflow
          width="auto"
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
        {/* 노출이 1개면 제목만으로 무엇을 보는지 명확하니 legend는 생략하고,
            2개 이상 겹칠 때만(비교 모드) 어떤 색이 어느 상품인지 표시한다. */}
        {series.length > 1 && <Legend />}
        {/* 곡선 보간(monotone)을 쓰지 않는다 — 다운샘플러가 버킷의 최고·최저를 번갈아
            남기므로, 스플라인을 씌우면 실제로 없던 곡률이 생겨 등락이 실제보다
            부드러워 보인다. 일별 가격은 애초에 매끄러운 함수도 아니다. */}
        {series.map((s) => (
          <Line
            key={s.key}
            type="linear"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeDasharray={s.dashed ? '4 4' : undefined}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
