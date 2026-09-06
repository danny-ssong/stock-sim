'use client';

import { memo, useMemo } from 'react';
import { useCompareSimulationResult } from '../../hooks/use-compare-simulation-result';
import { scenarioColor } from '../../lib/chart/colors';
import { exposureLabel } from '../../lib/data/labels';
import type { IndexExposure } from '../../lib/data/types';
import { formatKrwHuman } from '../../lib/format';
import { buildTimeTicks, timelineBounds, toDateString } from '../../lib/playback/timeline';
import { buildAssetSeries } from '../../lib/sim/asset-series';
import type { ExposureOutcome } from '../../lib/sim/compare';
import type { SimulationInputBase } from '../../lib/sim/types';
import { LIGHT_THEME } from '../playback/draw-frame';
import { PlaybackHeadline } from '../playback/PlaybackHeadline';
import { PlaybackScrubber } from '../playback/PlaybackScrubber';
import { usePlaybackDisplay } from '../playback/use-playback-display';
import { buildAssetPlayback, buildPricePlayback } from '../playback/series';
import { PLAYBACK_DURATION_MS, RESTORE_DELAY_MS, usePlayback } from '../playback/use-playback';
import { usePlaybackCanvas } from '../playback/use-playback-canvas';
import { ExposureSummaryCard } from './ExposureSummaryCard';
import SimLineChart, { type SimLineChartSeries } from './SimLineChart';

type ReadyOutcome = Extract<ExposureOutcome, { kind: 'ready' }>;

/** SimLineChart가 요구하는 wide 포맷 — 한 행이 한 날짜, 노출마다 s{idx} 열이 붙는다. */
type ChartRow = { x: string } & Record<string, string | number | null>;

/** 정적 차트와 같은 높이 — 재생 캔버스와 교대할 때 레이아웃이 튀지 않게 한다(SimLineChart의 ResponsiveContainer) */
const CHART_HEIGHT = 320;

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
  const seriesPerOutcome = outcomes.map((outcome) => buildAssetSeries(outcome.result.ledger));
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
}: {
  base: SimulationInputBase;
  exposures: IndexExposure[];
}) {
  const state = useCompareSimulationResult(base, exposures);

  // buildPriceRows/buildAssetRows는 노출 개수 × 최대 수십 년치 일별 포인트를 순회해
  // wide-format 배열을 새로 만든다 — memo 없이는 이 컴포넌트가 리렌더될 때마다(예:
  // 부모의 다른 입력 변경으로 인한 리렌더) 다시 실행된다. state는 useCompareSimulationResult가
  // simulate() 자체를 useMemo로 감싼 결과라 결과가 안 바뀌면 identity가 안정적이다 —
  // 그 identity에 앵커를 걸어야 이 memo가 실제로 적중한다(readyOutcomes를 인라인
  // .filter()로 새로 만들면 매번 새 배열이라 적중하지 않는다).
  //
  // 재생 배선(price/asset 번들, 두 축의 틱, 공유 bounds)도 여기서 함께 만든다 —
  // buildAssetPlayback이 buildAssetSeries를 outcome마다 다시 도는 이상, 이 메모가
  // 없으면 idle 상태(canvas가 마운트되지 않아 결과를 쓰지도 않는 상태)에서도 매
  // 리렌더마다 같은 원장을 다시 훑게 된다.
  const { readyOutcomes, priceData, assetData, price, asset, priceTicks, assetTicks, bounds } = useMemo(() => {
    const ready = state.status === 'ready' ? state.outcomes.filter((o) => o.kind === 'ready') : [];
    const price = buildPricePlayback(ready);
    const asset = buildAssetPlayback(ready);
    // 두 canvas가 같은 bounds를 써야 progress가 같은 시점을 가리킨다(§A/§F) — 합집합을
    // 한 번만 계산해 둘에 나눠 준다. null(그릴 점이 없음)이면 캔버스가 애초에 마운트되지
    // 않으므로(아래 chartSeries.length === 0 분기) 여기 폴백은 타입을 맞추는 용도일 뿐이다.
    const unionBounds = timelineBounds([...price.series, ...asset.series]);
    return {
      readyOutcomes: ready,
      priceData: buildPriceRows(ready),
      assetData: buildAssetRows(ready),
      price,
      asset,
      priceTicks: buildTimeTicks(price.dates),
      assetTicks: buildTimeTicks(asset.dates),
      bounds: unionBounds ?? { from: 0, to: 0 },
    };
  }, [state]);

  const chartSeries = readyOutcomes.map((outcome, idx) => ({
    key: `s${idx}`,
    name: exposureLabel(outcome.exposure),
    color: scenarioColor(idx),
  }));

  // 노출이 몇 개든 납입 계획(초기 원금·월 납입액)은 동일하므로 원금은 첫 번째
  // 결과에서만 뽑는다. 목록 맨 위(범례 첫 항목)에 둬서, 몇 개를 비교하든 "내가
  // 넣은 돈"이 항상 기준선으로 먼저 보이게 한다.
  const assetChartSeries: SimLineChartSeries[] = [
    { key: 'contributed', name: '원금', color: '#71717a', dashed: true },
    ...chartSeries,
  ];

  // ── 재생 배선 ───────────────────────────────────────────────────────────
  //
  // 별도의 렌더 프롭 컴포넌트(예: ComparePlayback)로 뽑지 않고 이 컴포넌트에 직접
  // 둔 이유는 호출부가 여기 하나뿐이기 때문이다 — 재사용 지점이 없는 상태에서
  // children 콜백을 끼우면 간접 참조만 하나 늘고 읽기는 더 어려워진다. 재생을
  // 붙일 화면이 두 번째로 생기면(예: 숏츠 화면과 로직을 공유해야 할 때) 그때
  // 이 블록을 훅이나 컴포넌트로 추출한다.
  //
  // 진행도가 날짜 기준이고 두 canvas가 같은 bounds(위 useMemo에서 합집합으로 계산)를
  // 쓰므로, 해상도가 다른 두 차트(가격 일별 / 자산 월별)가 같은 시점에서 함께 멈춘다.
  const priceCanvas = usePlaybackCanvas({
    series: price.series,
    styles: price.styles,
    ticks: priceTicks,
    bounds,
    theme: LIGHT_THEME,
    valueFormatter: (value) => `${value.toFixed(2)}x`,
    changeRateOf: price.changeRateOf,
  });
  const assetCanvas = usePlaybackCanvas({
    series: asset.series,
    styles: asset.styles,
    ticks: assetTicks,
    bounds,
    theme: LIGHT_THEME,
    valueFormatter: formatKrwHuman,
    changeRateOf: asset.changeRateOf,
  });

  const display = usePlaybackDisplay();

  const {
    status: playbackStatus,
    start: startPlayback,
    seek: seekPlayback,
  } = usePlayback({
    durationMs: PLAYBACK_DURATION_MS,
    restoreDelayMs: RESTORE_DELAY_MS,
    onFrame: (progress) => {
      priceCanvas.drawAt(progress);
      assetCanvas.drawAt(progress);
      const time = bounds.from + (bounds.to - bounds.from) * progress;
      display.update(progress, toDateString(time));
    },
    // 정적 차트로 돌아가면 헤드라인·진행바도 초기 상태로 되돌린다. 빈 문자열이 아니라
    // 공백을 넘기는 이유는 PlaybackHeadline이 처음 렌더할 때 넣어 둔 것과 같은 값이라야
    // 문단 높이가 유지되기 때문이다 — ''를 넣으면 자식이 사라져 한 줄만큼 화면이 튄다.
    onRestore: () => display.update(0, ' '),
  });

  // idle이 아니면(재생 중이거나 방금 끝나 마지막 프레임을 유지하는 중이면) canvas가,
  // idle이면 정적(recharts) 차트가 자리를 차지한다 — 툴팁이 필요한 평소에는 canvas를
  // 마운트하지 않고, 재생 중에는 정적 차트를 마운트하지 않는다. 'finished'도 포함하는
  // 이름이라야 하므로 '재생 중'을 뜻하는 isPlaying이 아니라 showsCanvas로 부른다.
  const showsCanvas = playbackStatus !== 'idle';

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {state.outcomes.map((outcome) => (
              <ExposureSummaryCard key={outcome.exposure} outcome={outcome} />
            ))}
          </div>

          {chartSeries.length > 0 && (
            <>
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">상품 가격 비교</h3>
                {showsCanvas ? (
                  <canvas ref={priceCanvas.canvasRef} className="w-full" style={{ height: CHART_HEIGHT }} />
                ) : (
                  <SimLineChart data={priceData} series={chartSeries} scale="linear" />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">내 자산 추이 비교</h3>
                {showsCanvas ? (
                  <canvas ref={assetCanvas.canvasRef} className="w-full" style={{ height: CHART_HEIGHT }} />
                ) : (
                  <SimLineChart
                    data={assetData}
                    series={assetChartSeries}
                    scale="linear"
                    valueFormatter={formatKrwHuman}
                  />
                )}
              </div>
              {/* 인라인 화면은 헤드라인과 조작 UI를 나란히 쌓아 예전과 같은 모습을
                  유지한다 — 둘을 떼어 놓아야 하는 것은 숏츠 카드뿐이다(ShortsView) */}
              <PlaybackHeadline
                headlineRef={display.headlineRef}
                progressRef={display.progressRef}
              />
              <PlaybackScrubber
                status={playbackStatus}
                onStart={startPlayback}
                onSeek={seekPlayback}
                sliderRef={display.sliderRef}
                // 재생 전에는 canvas가 아직 마운트되지 않아 스크럽해도 그릴 대상이 없다 —
                // 끌리기는 하는데 화면은 그대로인 상태를 만들지 않으려고 아예 막는다.
                scrubDisabled={playbackStatus === 'idle'}
              />
            </>
          )}
        </>
      )}
    </div>
  );
});
