'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import type { PortfolioIndexPoint } from '../../lib/sim/drawdown';
import { scenarioColor } from '../../lib/chart/colors';
import { formatKrwPrice } from '../../lib/format';

const SimLineChart = dynamic(() => import('./SimLineChart'), {
  ssr: false,
  loading: () => <div className="h-[320px] w-full animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />,
});

/** 스펙 §6 — 기본은 선형, 필요하면 로그로 전환할 수 있게 토글을 남긴다. */
export function BacktestValueChart({
  portfolioIndex,
  caption,
}: {
  portfolioIndex: PortfolioIndexPoint[];
  /** 축의 성격을 설명하는 한 줄. 탭마다 의미가 달라 호출자가 정한다. */
  caption?: string;
}) {
  const [scale, setScale] = useState<'linear' | 'log'>('linear');
  const hasActualPrice = portfolioIndex.some((point) => point.priceKrw !== null);

  const data = useMemo(
    () =>
      portfolioIndex.map((point) => ({
        x: point.date,
        value: point.priceKrw ?? point.level,
        isSynthetic: point.isSynthetic,
      })),
    [portfolioIndex],
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{hasActualPrice ? '상품 가격 추이' : '상품 가격 추이(시작=1)'}</h3>
        <button type="button" className="text-xs text-zinc-500 underline" onClick={() => setScale((s) => (s === 'linear' ? 'log' : 'linear'))}>
          {scale === 'linear' ? '로그 스케일로 보기' : '선형 스케일로 보기'}
        </button>
      </div>
      {hasActualPrice && caption !== undefined && <p className="text-xs text-zinc-500">{caption}</p>}
      <SimLineChart
        data={data}
        series={[{ key: 'value', name: hasActualPrice ? '상품 가격' : '평가 지수', color: scenarioColor(0) }]}
        scale={scale}
        valueFormatter={hasActualPrice ? formatKrwPrice : undefined}
      />
    </div>
  );
}
