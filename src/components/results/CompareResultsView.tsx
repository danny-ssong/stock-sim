'use client';

import { useMemo } from 'react';
import { useCompareSimulationResult } from '../../hooks/use-compare-simulation-result';
import { scenarioColor } from '../../lib/chart/colors';
import { exposureLabel } from '../../lib/data/labels';
import type { IndexExposure } from '../../lib/data/types';
import { formatKrwHuman } from '../../lib/format';
import { buildAssetSeries } from '../../lib/sim/asset-series';
import type { ExposureOutcome } from '../../lib/sim/compare';
import type { SimulationInputBase } from '../../lib/sim/types';
import { ExposureSummaryCard } from './ExposureSummaryCard';
import SimLineChart, { type SimLineChartSeries } from './SimLineChart';

type ReadyOutcome = Extract<ExposureOutcome, { kind: 'ready' }>;

/** SimLineChart가 요구하는 wide 포맷 — 한 행이 한 날짜, 노출마다 s{idx} 열이 붙는다. */
type ChartRow = { x: string } & Record<string, string | number | null>;

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
 */
export function CompareResultsView({
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
  const { readyOutcomes, priceData, assetData } = useMemo(() => {
    const ready = state.status === 'ready' ? state.outcomes.filter((o) => o.kind === 'ready') : [];
    return { readyOutcomes: ready, priceData: buildPriceRows(ready), assetData: buildAssetRows(ready) };
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

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      {state.status === 'loading' && <p className="text-zinc-500">데이터를 불러오는 중입니다…</p>}
      {state.status === 'dataset-error' && <p className="text-red-600">{state.message}</p>}
      {state.status === 'insufficient-data' && (
        <p className="text-amber-600">
          선택한 시작 시점부터는 계산할 수 있는 데이터가 부족합니다. 왼쪽에서 시작 시점을 더
          최근으로 옮기거나 기간을 {state.maxYears}년 이하로 줄여주세요.
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
                <SimLineChart data={priceData} series={chartSeries} scale="linear" />
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">내 자산 추이 비교</h3>
                <SimLineChart
                  data={assetData}
                  series={assetChartSeries}
                  scale="linear"
                  valueFormatter={formatKrwHuman}
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
