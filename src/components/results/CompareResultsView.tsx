'use client';

import { memo, useMemo } from 'react';
import { useCompareSimulationResult } from '../../hooks/use-compare-simulation-result';
import { CONTRIBUTED_COLOR, exposureColor } from '../../lib/chart/colors';
import { exposureLabel } from '../../lib/data/labels';
import type { IndexExposure } from '../../lib/data/types';
import { formatKrwHuman } from '../../lib/format';
import type { ExposureOutcome } from '../../lib/sim/compare';
import type { SimulationInputBase } from '../../lib/sim/types';
import type { PlaybackView } from '../../lib/url/schema';
import { LIGHT_THEME } from '../playback/draw-frame';
import { PlaybackTransport } from '../playback/PlaybackTransport';
import { buildAssetPlayback, buildPricePlayback } from '../playback/series';
import { useChartPlayback } from '../playback/use-chart-playback';
import { RESTORE_DELAY_MS } from '../playback/use-playback';
import { ExposureSummaryTable } from './ExposureSummaryTable';
import { ResultsToolbar } from './ResultsToolbar';
import SimLineChart, { type SimLineChartSeries } from './SimLineChart';

type ReadyOutcome = Extract<ExposureOutcome, { kind: 'ready' }>;

/** SimLineChart가 요구하는 wide 포맷 — 한 행이 한 날짜, 노출마다 s{idx} 열이 붙는다. */
type ChartRow = { x: string } & Record<string, string | number | null>;

/** 정적 차트와 같은 높이 — 재생 캔버스와 교대할 때 레이아웃이 튀지 않게 한다(SimLineChart의 ResponsiveContainer) */
const CHART_HEIGHT = 320;

/** 가격 축은 배수 표기다(level은 시작을 1로 정규화한 값) */
const PRICE_FORMATTER = (value: number) => `${value.toFixed(2)}x`;

function buildPriceRows(outcomes: ReadyOutcome[]): ChartRow[] {
  if (outcomes.length === 0) return [];
  const base = outcomes[0].result.portfolioIndex;
  return base.map((point, i) => {
    const row: ChartRow = { x: point.date };
    outcomes.forEach((outcome, idx) => {
      row[`s${idx}`] = outcome.result.portfolioIndex[i]?.level ?? null;
    });
    return row;
  });
}

/** 원금(contributed)은 노출과 무관하게 같으므로 첫 번째 시리즈에서만 뽑는다. */
function buildAssetRows(outcomes: ReadyOutcome[]): ChartRow[] {
  if (outcomes.length === 0) return [];
  const seriesPerOutcome = outcomes.map((outcome) => outcome.result.dailyAssetSeries);
  return seriesPerOutcome[0].map((point, i) => {
    const row: ChartRow = { x: point.date, contributed: point.contributed };
    seriesPerOutcome.forEach((series, idx) => {
      row[`s${idx}`] = series[i]?.marketValue ?? null;
    });
    return row;
  });
}

/**
 * 상품을 2개 이상 골랐을 때의 결과 화면.
 *
 * base.mode를 그대로 넘기므로 과거 검증과 미래 설계 양쪽에서 동작한다 — 탭 시절
 * 'future'가 하드코딩돼 막혀 있던 "과거 × 비교" 조합이 이 화면으로 열린다.
 *
 * 식품 바구니는 단일 전제 지표라 여기서는 보여주지 않는다. 대신 각 카드가
 * 세후 금액(세금 내역은 툴팁)·MDD·손실 구간을 싣는다.
 *
 * memo를 씌우는 이유는 FutureResultsView와 같다 — 드래그의 urgent 패스에서는
 * base·exposures가 둘 다 ResultsView의 deferred 값이라 identity가 그대로다.
 */
export const CompareResultsView = memo(function CompareResultsView({
  base,
  exposures,
  view,
  onViewChange,
}: {
  base: SimulationInputBase;
  exposures: IndexExposure[];
  view: PlaybackView;
  onViewChange: (view: PlaybackView) => void;
}) {
  const state = useCompareSimulationResult(base, exposures);

  // buildPriceRows/buildAssetRows는 노출 개수 × 최대 수십 년치 일별 포인트를 순회해
  // wide-format 배열을 새로 만든다 — memo 없이는 이 컴포넌트가 리렌더될 때마다(예:
  // 부모의 다른 입력 변경으로 인한 리렌더) 다시 실행된다. state는 useCompareSimulationResult가
  // simulate() 자체를 useMemo로 감싼 결과라 결과가 안 바뀌면 identity가 안정적이다 —
  // 그 identity에 앵커를 걸어야 이 memo가 실제로 적중한다(readyOutcomes를 인라인
  // .filter()로 새로 만들면 매번 새 배열이라 적중하지 않는다).
  //
  // 재생 트랙(가격·자산 번들)도 여기서 함께 만든다 — buildAssetPlayback이
  // buildAssetSeries를 outcome마다 다시 도는 이상, 이 메모가 없으면 idle 상태
  // (canvas가 마운트되지 않아 결과를 쓰지도 않는 상태)에서도 매 리렌더마다 같은
  // 원장을 다시 훑게 된다. tracks 배열까지 여기서 만드는 이유는 identity 때문이다 —
  // 매 렌더 새 배열을 넘기면 useChartPlayback 안의 틱·bounds 메모가 매번 무효화된다.
  const { readyOutcomes, priceData, assetData, tracks } = useMemo(() => {
    const ready = state.status === 'ready' ? state.outcomes.filter((o) => o.kind === 'ready') : [];
    return {
      readyOutcomes: ready,
      priceData: buildPriceRows(ready),
      assetData: buildAssetRows(ready),
      tracks: [
        { bundle: buildPricePlayback(ready), valueFormatter: PRICE_FORMATTER },
        { bundle: buildAssetPlayback(ready), valueFormatter: formatKrwHuman },
      ],
    };
  }, [state]);

  const chartSeries = readyOutcomes.map((outcome, idx) => ({
    // key는 buildPriceRows/buildAssetRows가 만드는 열 이름(s0, s1…)과 짝이라 인덱스로 둔다.
    // 색만 노출에서 파생시킨다 — 위치 기반이면 blocked가 섞일 때 요약과 어긋난다(colors.ts).
    key: `s${idx}`,
    name: exposureLabel(outcome.exposure),
    color: exposureColor(outcome.exposure),
  }));

  // 노출이 몇 개든 납입 계획(초기 원금·월 납입액)은 동일하므로 원금은 첫 번째
  // 결과에서만 뽑는다. 목록 맨 위(범례 첫 항목)에 둬서, 몇 개를 비교하든 "내가
  // 넣은 돈"이 항상 기준선으로 먼저 보이게 한다.
  const assetChartSeries: SimLineChartSeries[] = [
    { key: 'contributed', name: '원금', color: CONTRIBUTED_COLOR, dashed: true },
    ...chartSeries,
  ];

  // ── 재생 배선 ───────────────────────────────────────────────────────────
  //
  // 두 canvas가 같은 bounds를 쓰도록 하는 일은 useChartPlayback이 맡는다 —
  // 두 차트가 같은 시점에서 함께 멈추는 근거이고, 화면마다 다시 세우면 한 곳만
  // 빠뜨려도 조용히 어긋난다.
  const playback = useChartPlayback({
    tracks,
    theme: LIGHT_THEME,
    restoreDelayMs: RESTORE_DELAY_MS,
  });
  const { canvasRefs, showsCanvas } = playback;
  // tracks와 같은 순서다. 이름을 붙여 두면 JSX에서 canvasRefs[1]이 어느 차트인지
  // 세어 보지 않아도 된다.
  const [priceCanvasRef, assetCanvasRef] = canvasRefs;

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      <ResultsToolbar view={view} onViewChange={onViewChange} />
      {state.status === 'loading' && <p className="text-zinc-500">데이터를 불러오는 중입니다…</p>}
      {state.status === 'dataset-error' && <p className="text-red-600">{state.message}</p>}
      {state.status === 'insufficient-data' && (
        <p className="text-amber-600">
          선택한 시작 시점부터는 계산할 수 있는 데이터가 1년치도 없습니다. 왼쪽에서 시작
          시점을 더 최근으로 옮겨주세요.
        </p>
      )}

      {state.status === 'ready' && (
        <>
          <ExposureSummaryTable outcomes={state.outcomes} base={base} />

          {chartSeries.length > 0 && (
            <>
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">상품 가격 비교</h3>
                {showsCanvas ? (
                  <canvas ref={priceCanvasRef} className="w-full" style={{ height: CHART_HEIGHT }} />
                ) : (
                  <SimLineChart data={priceData} series={chartSeries} scale="linear" />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">내 자산 추이 비교</h3>
                {showsCanvas ? (
                  <canvas ref={assetCanvasRef} className="w-full" style={{ height: CHART_HEIGHT }} />
                ) : (
                  <SimLineChart
                    data={assetData}
                    series={assetChartSeries}
                    scale="linear"
                    valueFormatter={formatKrwHuman}
                  />
                )}
              </div>
              {/* 두 차트를 함께 굴리는 컨트롤이라 둘 아래에 한 번만 둔다 */}
              <PlaybackTransport playback={playback} />
            </>
          )}
        </>
      )}
    </div>
  );
});
