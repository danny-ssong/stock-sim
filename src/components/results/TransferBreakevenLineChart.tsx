'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatKrwHuman } from '../../lib/format';

type Point = { month: number; transfer: number; hold: number };

export default function TransferBreakevenLineChart({
  data,
  transferMonth,
  breakEvenMonth,
}: {
  data: Point[];
  transferMonth: number;
  breakEvenMonth: number | null;
}) {
  const breakEvenPoint = data.find((p) => p.month === breakEvenMonth);

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" label={{ value: '개월', position: 'insideBottom', offset: -4 }} />
        <YAxis tickFormatter={(value: number) => formatKrwHuman(value)} />
        <Tooltip
          formatter={(value, name) => [
            typeof value === 'number' ? formatKrwHuman(value) : '',
            name === 'transfer' ? '이전' : '유지',
          ]}
          labelFormatter={(month) => `${month}개월`}
        />
        <ReferenceLine x={transferMonth} stroke="#a1a1aa" strokeDasharray="4 4" label="이전 시점" />
        {breakEvenPoint && (
          <ReferenceDot
            x={breakEvenPoint.month}
            y={breakEvenPoint.transfer}
            r={5}
            fill="#16a34a"
            stroke="none"
            label={{ value: '역전', position: 'top' }}
          />
        )}
        <Line type="monotone" dataKey="hold" name="hold" stroke="#2563eb" dot={false} isAnimationActive={false} />
        <Line
          type="monotone"
          dataKey="transfer"
          name="transfer"
          stroke="#d97706"
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
