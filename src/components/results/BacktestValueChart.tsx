'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import type { PortfolioIndexPoint } from '../../lib/sim/drawdown';
import { scenarioColor } from '../../lib/chart/colors';

const SimLineChart = dynamic(() => import('./SimLineChart'), {
  ssr: false,
  loading: () => <div className="h-[320px] w-full animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />,
});

/** 스펙 §6 — 기본은 선형, 필요하면 로그로 전환할 수 있게 토글을 남긴다.
 *  실제 종가 유무와 무관하게 항상 시작=1 지수 포인트로 표시한다 — 상품마다
 *  단위(원화 실가/무차원 지수)가 갈리면 여러 상품을 나란히 볼 때 축이 뒤섞인다. */
export function BacktestValueChart({
  portfolioIndex,
}: {
  portfolioIndex: PortfolioIndexPoint[];
}) {
  const [scale, setScale] = useState<'linear' | 'log'>('linear');

  const data = useMemo(
    () =>
      portfolioIndex.map((point) => ({
        x: point.date,
        value: point.level,
        isSynthetic: point.isSynthetic,
      })),
    [portfolioIndex],
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">상품 가격 추이(시작=1)</h3>
        <button type="button" className="text-xs text-zinc-500 underline" onClick={() => setScale((s) => (s === 'linear' ? 'log' : 'linear'))}>
          {scale === 'linear' ? '로그 스케일로 보기' : '선형 스케일로 보기'}
        </button>
      </div>
      <SimLineChart
        data={data}
        series={[{ key: 'value', name: '평가 지수', color: scenarioColor(0) }]}
        scale={scale}
      />
    </div>
  );
}
