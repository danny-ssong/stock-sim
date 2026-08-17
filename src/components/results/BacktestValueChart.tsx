'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import type { PortfolioIndexPoint } from '../../lib/sim/drawdown';

/** Recharts는 번들이 커서 결과 화면을 처음 그릴 때는 필요 없다 — 클라이언트에서만
 * 지연 로딩한다(스펙 §10 "렌더링 비용"). ContributionChart.tsx와 같은 패턴이다. */
const LogScaleLineChart = dynamic(() => import('./LogScaleLineChart'), {
  ssr: false,
  loading: () => (
    <div className="h-[320px] w-full animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
  ),
});

export function BacktestValueChart({ portfolioIndex }: { portfolioIndex: PortfolioIndexPoint[] }) {
  const data = useMemo(
    () =>
      portfolioIndex.map((point) => ({
        date: point.date,
        level: point.level,
        syntheticLevel: point.isSynthetic ? point.level : null,
        isSynthetic: point.isSynthetic,
      })),
    [portfolioIndex],
  );

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">평가액 추이(로그 스케일, 배분 가중 지수 · 시작=1)</h3>
      <LogScaleLineChart data={data} />
    </div>
  );
}
