'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { buildAssetSeries } from '../../lib/sim/asset-series';
import { formatKrwHuman } from '../../lib/format';
import type { Ledger } from '../../lib/sim/types';

function AssetChartInner({ ledger, years }: { ledger: Ledger; years: number }) {
  const data = useMemo(
    () => buildAssetSeries(ledger, years).map((row) => ({ ...row, yearIndex: row.yearIndex + 1 })),
    [ledger, years],
  );

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="yearIndex" label={{ value: '연차', position: 'insideBottom', offset: -4 }} />
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

export function AssetChart({ ledger, years }: { ledger: Ledger; years: number }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">내 자산 추이</h3>
      <DynamicAssetChart ledger={ledger} years={years} />
    </div>
  );
}
