'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import type { PortfolioIndexPoint } from '../../lib/sim/drawdown';
import type { IndexExposure } from '../../lib/data/types';
import { exposureColor } from '../../lib/chart/colors';

const SimLineChart = dynamic(() => import('./SimLineChart'), {
  ssr: false,
  loading: () => <div className="h-[320px] w-full animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />,
});

/** 스펙 §6 — 기본은 선형, 필요하면 로그로 전환할 수 있게 토글을 남긴다.
 *  상품 하나만 볼 때는 실제 달러 가격을 그대로 보여준다(원화 환산 없음) —
 *  단일 상품이라 축 단위가 섞일 일이 없고, 상품이 실제 거래되는 통화 그대로가
 *  가장 직관적이다. 실제 종가가 없는(합성 구간뿐인) 상품일 때만 시작=1
 *  지수로 대체한다. 여러 상품을 나란히 비교할 때(CompareResultsView)는
 *  단위가 갈리므로 항상 지수를 쓴다 — 그건 이 컴포넌트가 아니라 거기서 처리한다. */
export function BacktestValueChart({
  portfolioIndex,
  exposure,
  caption,
}: {
  portfolioIndex: PortfolioIndexPoint[];
  /** 선 색을 정한다 — 이 차트가 무슨 상품을 그리는지 스스로 알아야
   *  비교 화면과 같은 색이 나온다(colors.ts) */
  exposure: IndexExposure;
  /** 축의 성격을 설명하는 한 줄. 호출 맥락(미래 설계·과거 검증)마다 의미가 달라 호출자가 정한다. */
  caption?: string;
}) {
  const [scale, setScale] = useState<'linear' | 'log'>('linear');
  const hasActualPrice = portfolioIndex.some((point) => point.priceUsd !== null);

  // portfolioIndex는 최대 수십 년치 일별 포인트라, memo 없이는 scale 토글 같은
  // 이 컴포넌트 자체의 리렌더에도 매번 전체 배열을 다시 map한다. portfolioIndex는
  // simulate() 결과의 일부라 그 결과가 안 바뀌면 identity도 안정적이다(결과 훅들이
  // simulate()를 useMemo로 감싼다) — 그 identity에 앵커를 건다.
  const data = useMemo(
    () =>
      portfolioIndex.map((point) => ({
        x: point.date,
        value: point.priceUsd ?? point.level,
        isSynthetic: point.isSynthetic,
      })),
    [portfolioIndex],
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{hasActualPrice ? '상품 가격 추이(USD)' : '상품 가격 추이(시작=1)'}</h3>
        <button type="button" className="text-xs text-zinc-500 underline" onClick={() => setScale((s) => (s === 'linear' ? 'log' : 'linear'))}>
          {scale === 'linear' ? '로그 스케일로 보기' : '선형 스케일로 보기'}
        </button>
      </div>
      {hasActualPrice && caption !== undefined && <p className="text-xs text-zinc-500">{caption}</p>}
      <SimLineChart
        data={data}
        series={[{ key: 'value', name: hasActualPrice ? '상품 가격(USD)' : '평가 지수', color: exposureColor(exposure) }]}
        scale={scale}
      />
    </div>
  );
}
