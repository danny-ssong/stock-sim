'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import type { TransferComparison } from '../../lib/sim/transfer';

const TransferBreakevenLineChart = dynamic(() => import('./TransferBreakevenLineChart'), {
  ssr: false,
  loading: () => (
    <div className="h-[320px] w-full animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
  ),
});

/** §8 "ISA 이전 시나리오는 손익분기 그래프로 표시 — 두 곡선의 교차점을 마커로
 *  강조". transferCurve/holdCurve는 compareTransfer가 이미 계산해 반환한다
 *  (transfer.ts Task 2). */
export function TransferBreakevenChart({
  comparison,
  transferYear,
}: {
  comparison: TransferComparison;
  transferYear: number;
}) {
  const data = useMemo(() => {
    const length = Math.min(comparison.transferCurve.length, comparison.holdCurve.length);
    return Array.from({ length }, (_, month) => ({
      month,
      transfer: comparison.transferCurve[month],
      hold: comparison.holdCurve[month],
    }));
  }, [comparison]);

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">이전 vs 유지 — 손익분기</h3>
      <TransferBreakevenLineChart
        data={data}
        transferMonth={transferYear * 12}
        breakEvenMonth={comparison.breakEvenMonth}
      />
      {comparison.breakEvenMonth === null && (
        <p className="text-sm text-amber-600">
          시뮬레이션 기간 안에서는 이전한 쪽이 유지한 쪽을 역전하지 못했습니다.
        </p>
      )}
    </div>
  );
}
