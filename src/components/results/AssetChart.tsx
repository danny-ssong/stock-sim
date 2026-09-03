'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { dateAxisProps } from '../../lib/chart/x-axis';
import { buildAssetSeries } from '../../lib/sim/asset-series';
import { formatKrwHuman } from '../../lib/format';
import type { Ledger } from '../../lib/sim/types';

const CONTRIBUTED_LABEL = '원금';
const MARKET_VALUE_LABEL = '평가금';

function labelFor(name: string): string {
  return name === 'contributed' ? CONTRIBUTED_LABEL : MARKET_VALUE_LABEL;
}

function AssetChartInner({ ledger }: { ledger: Ledger }) {
  const data = useMemo(() => buildAssetSeries(ledger), [ledger]);
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        {/* 위에 놓인 상품 가격 차트(SimLineChart)와 같은 틱 규칙을 쓴다 — 해상도는
            월별로 다르지만 덮는 기간이 같아 두 축의 연도 라벨이 같은 자리에 선다. */}
        <XAxis dataKey="date" minTickGap={40} {...dateAxisProps(data.map((row) => row.date))} />
        {/* width="auto"는 렌더된 틱 라벨을 실측해 축 너비를 맞춘다. 고정 width(기본 60)로는
            "80.00억"처럼 단위가 붙어 길어진 라벨이 SVG 왼쪽 경계에서 잘린다. */}
        <YAxis width="auto" tickFormatter={(v: number) => formatKrwHuman(v)} />
        <Tooltip
          formatter={(value, name) =>
            typeof value === 'number' ? [formatKrwHuman(value), labelFor(String(name))] : ['', labelFor(String(name))]
          }
        />
        <Legend formatter={(name) => labelFor(name)} />
        {/* 애니메이션을 끄는 이유는 SimLineChart와 같다 — 입력 슬라이더를 드래그하면
            틱마다 애니메이션이 재시작되고, 그 동안 rAF가 매 프레임 path를 다시 그려
            드래그가 끝날 때까지 리렌더가 멈추지 않는다. */}
        <Area type="monotone" dataKey="marketValue" name="marketValue" stroke="#2563eb" fill="#2563eb" fillOpacity={0.3} isAnimationActive={false} />
        <Line type="monotone" dataKey="contributed" name="contributed" stroke="#71717a" strokeDasharray="4 4" dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Recharts는 번들이 커서 클라이언트에서만 지연 로딩한다(스펙 §10). */
const DynamicAssetChart = dynamic(() => Promise.resolve(AssetChartInner), {
  ssr: false,
  loading: () => <div className="h-[280px] w-full animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />,
});

export function AssetChart({ ledger }: { ledger: Ledger }) {
  return (
    <div className="flex flex-col gap-2 pl-2">
      <h3 className="text-sm font-medium">내 자산 추이</h3>
      <DynamicAssetChart ledger={ledger} />
    </div>
  );
}
