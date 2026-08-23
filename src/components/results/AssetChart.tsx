'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatYearTick, januaryTicks, shouldShowYearOnlyTicks } from '../../lib/chart/x-axis';
import { buildAssetSeries } from '../../lib/sim/asset-series';
import { formatKrwHuman } from '../../lib/format';
import type { Ledger } from '../../lib/sim/types';

function AssetChartInner({ ledger }: { ledger: Ledger }) {
  const data = useMemo(() => buildAssetSeries(ledger), [ledger]);
  const xValues = data.map((row) => row.date);
  const yearOnly = shouldShowYearOnlyTicks(xValues.length);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          minTickGap={40}
          ticks={yearOnly ? januaryTicks(xValues) : undefined}
          tickFormatter={yearOnly ? formatYearTick : undefined}
        />
        <YAxis tickFormatter={(v: number) => formatKrwHuman(v)} />
        <Tooltip formatter={(value) => (typeof value === 'number' ? formatKrwHuman(value) : '')} />
        <Legend formatter={(name) => (name === 'contributed' ? '납입 누계' : '평가액')} />
        <Area type="monotone" dataKey="marketValue" name="marketValue" stroke="#2563eb" fill="#2563eb" fillOpacity={0.3} />
        <Line type="monotone" dataKey="contributed" name="contributed" stroke="#71717a" strokeDasharray="4 4" dot={false} />
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
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">내 자산 추이</h3>
      <DynamicAssetChart ledger={ledger} />
    </div>
  );
}
