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
import { ACCOUNT_COLORS } from '../../lib/chart/colors';
import { formatKrwHuman } from '../../lib/format';
import type { AccountId } from '../../lib/data/types';

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
        <YAxis tickFormatter={(value: number) => formatKrwHuman(value)} />
        <Tooltip
          formatter={(value) => (typeof value === 'number' ? formatKrwHuman(value) : '')}
        />
        <Legend formatter={(value: string) => (isAccountId(value) ? labels[value] : value)} />
        {accountIds.map((accountId) => (
          <Area
            key={accountId}
            type="monotone"
            dataKey={accountId}
            stackId="1"
            name={accountId}
            stroke={ACCOUNT_COLORS[accountId]}
            fill={ACCOUNT_COLORS[accountId]}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
