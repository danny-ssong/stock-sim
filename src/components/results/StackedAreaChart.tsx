'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { isAccountId } from '../../lib/allocation';
import type { AccountId } from '../../lib/data/types';

const COLORS: Record<AccountId, string> = {
  DIRECT_US: '#2563eb',
  DOMESTIC_ETF: '#16a34a',
  ISA: '#d97706',
};

export default function StackedAreaChart({
  data,
  accountIds,
  labels,
}: {
  data: Array<{ yearIndex: number } & Partial<Record<AccountId, number>>>;
  accountIds: AccountId[];
  labels: Record<AccountId, string>;
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="yearIndex" label={{ value: '연차', position: 'insideBottom', offset: -4 }} />
        <YAxis tickFormatter={(value: number) => `${Math.round(value / 10_000_000)}천만`} />
        <Tooltip
          formatter={(value) => {
            if (typeof value !== 'number') return '';
            return `${Math.round(value / 10_000).toLocaleString('ko-KR')}만원`;
          }}
        />
        <Legend formatter={(value: string) => (isAccountId(value) ? labels[value] : value)} />
        {accountIds.map((accountId) => (
          <Area
            key={accountId}
            type="monotone"
            dataKey={accountId}
            stackId="1"
            name={accountId}
            stroke={COLORS[accountId]}
            fill={COLORS[accountId]}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
