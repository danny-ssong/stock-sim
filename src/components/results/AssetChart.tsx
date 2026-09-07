'use client';

import dynamic from 'next/dynamic';
import { useMemo, type RefObject } from 'react';
import { Area, AreaChart, CartesianGrid, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CONTRIBUTED_COLOR, exposureColor } from '../../lib/chart/colors';
import { downsampleByKeys } from '../../lib/chart/downsample';
import { dateAxisProps } from '../../lib/chart/x-axis';
import { SHARED_Y_AXIS_WIDTH } from '../../lib/chart/y-axis';
import type { IndexExposure } from '../../lib/data/types';
import { formatKrwHuman } from '../../lib/format';
import type { DailyAssetPoint } from '../../lib/sim/types';

const CONTRIBUTED_LABEL = '원금';
const MARKET_VALUE_LABEL = '평가금';

/** 정적 차트·로딩 자리표시자·재생 캔버스가 모두 이 높이를 쓴다 — 셋이 같은 자리를
 *  차지해야 무엇이 그려지든 아래 내용이 위아래로 튀지 않는다. */
const CHART_HEIGHT = 280;

function labelFor(name: string): string {
  return name === 'contributed' ? CONTRIBUTED_LABEL : MARKET_VALUE_LABEL;
}

function AssetChartInner({
  dailyAssetSeries,
  exposure,
}: {
  dailyAssetSeries: DailyAssetPoint[];
  exposure: IndexExposure;
}) {
  // dailyAssetSeries는 상품 가격과 같은 일별 해상도라 최대 수십 년치 수천 포인트다 —
  // 위에 놓인 상품 가격 차트(SimLineChart)와 같은 극값 보존 다운샘플링을 걸지 않으면
  // SVG path가 그만큼 커져 렌더 비용이 늘어난다(lib/chart/downsample.ts).
  const data = useMemo(
    () => downsampleByKeys(dailyAssetSeries, ['contributed', 'marketValue']),
    [dailyAssetSeries],
  );
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        {/* 위에 놓인 상품 가격 차트(SimLineChart)와 같은 틱 규칙을 쓴다 — 둘 다 일별
            해상도지만 다운샘플링을 각자 독립적으로 걸기 때문에 남는 점 집합은 다를 수
            있다. 그래도 덮는 기간이 같으므로 두 축의 연도 라벨은 같은 자리에 선다. */}
        <XAxis dataKey="date" minTickGap={40} {...dateAxisProps(data.map((row) => row.date))} />
        {/* 폭을 위 차트와 공유해 플롯 영역의 좌측 시작점을 맞춘다 — 실측(width="auto")에
            맡기면 라벨 길이 차이만큼 축이 어긋난다(y-axis.ts). */}
        <YAxis width={SHARED_Y_AXIS_WIDTH} tickFormatter={(v: number) => formatKrwHuman(v)} />
        <Tooltip
          formatter={(value, name) =>
            typeof value === 'number' ? [formatKrwHuman(value), labelFor(String(name))] : ['', labelFor(String(name))]
          }
        />
        <Legend formatter={(name) => labelFor(name)} />
        {/* 애니메이션을 끄는 이유는 SimLineChart와 같다 — 입력 슬라이더를 드래그하면
            틱마다 애니메이션이 재시작되고, 그 동안 rAF가 매 프레임 path를 다시 그려
            드래그가 끝날 때까지 리렌더가 멈추지 않는다. */}
        <Area type="monotone" dataKey="marketValue" name="marketValue" stroke={exposureColor(exposure)} fill={exposureColor(exposure)} fillOpacity={0.3} isAnimationActive={false} />
        <Line type="monotone" dataKey="contributed" name="contributed" stroke={CONTRIBUTED_COLOR} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Recharts는 번들이 커서 클라이언트에서만 지연 로딩한다(스펙 §10). */
const DynamicAssetChart = dynamic(() => Promise.resolve(AssetChartInner), {
  ssr: false,
  loading: () => (
    <div
      className="w-full animate-pulse rounded bg-zinc-100 dark:bg-zinc-900"
      style={{ height: CHART_HEIGHT }}
    />
  ),
});

export function AssetChart({
  dailyAssetSeries,
  exposure,
  playbackCanvasRef = null,
}: {
  dailyAssetSeries: DailyAssetPoint[];
  exposure: IndexExposure;
  /**
   * 재생 중이면 플롯 자리에 이 ref를 단 canvas를 대신 그린다. null이면 정적 차트다.
   *
   * 교대를 호출자가 아니라 이 컴포넌트가 맡는 이유는 제목과 pl-2를 두 상태가 함께
   * 써야 하기 때문이다 — 호출자가 통째로 갈아 끼우면 재생을 시작하는 순간 제목이
   * 사라지고(아래 내용이 위로 튄다) 플롯이 8px 왼쪽으로 밀린다.
   */
  playbackCanvasRef?: RefObject<HTMLCanvasElement | null> | null;
}) {
  return (
    <div className="flex flex-col gap-2 pl-2">
      <h3 className="text-sm font-medium">내 자산 추이</h3>
      {playbackCanvasRef === null ? (
        <DynamicAssetChart dailyAssetSeries={dailyAssetSeries} exposure={exposure} />
      ) : (
        <canvas ref={playbackCanvasRef} className="w-full" style={{ height: CHART_HEIGHT }} />
      )}
    </div>
  );
}
