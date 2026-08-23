'use client';

import { useMemo } from 'react';
import { useCompareSimulationResult } from '../../hooks/use-compare-simulation-result';
import { scenarioColor } from '../../lib/chart/colors';
import { exposureLabel } from '../../lib/data/labels';
import type { IndexExposure } from '../../lib/data/types';
import { formatKrwHuman } from '../../lib/format';
import { buildAssetSeries } from '../../lib/sim/asset-series';
import type { SimulationInputBase } from '../../lib/sim/types';
import { ExposureSummaryCard } from './ExposureSummaryCard';
import SimLineChart from './SimLineChart';

/**
 * 상품을 2개 이상 골랐을 때의 결과 화면.
 *
 * base.mode를 그대로 넘기므로 과거 검증과 미래 설계 양쪽에서 동작한다 — 탭 시절
 * 'future'가 하드코딩돼 막혀 있던 "과거 × 비교" 조합이 이 화면으로 열린다.
 *
 * 세금 상세·식품 바구니는 단일 전제 지표라 여기서는 보여주지 않는다. 대신 각
 * 카드가 세후 금액·MDD·적자 구간을 싣는다.
 */
export function CompareResultsView({
  base,
  exposures,
}: {
  base: SimulationInputBase;
  exposures: IndexExposure[];
}) {
  const state = useCompareSimulationResult(base, exposures);

  const readyOutcomes = useMemo(
    () => (state.status === 'ready' ? state.outcomes.filter((o) => o.kind === 'ready') : []),
    [state],
  );

  const priceData = useMemo(() => {
    if (readyOutcomes.length === 0) return [];
    const length = readyOutcomes[0].result.portfolioIndex.length;
    return Array.from({ length }, (_, i) => {
      const row: { x: string } & Record<string, string | number | null> = {
        x: readyOutcomes[0].result.portfolioIndex[i].date,
      };
      readyOutcomes.forEach((outcome, idx) => {
        row[`s${idx}`] = outcome.result.portfolioIndex[i]?.level ?? null;
      });
      return row;
    });
  }, [readyOutcomes]);

  const assetData = useMemo(() => {
    if (readyOutcomes.length === 0) return [];
    const seriesPerOutcome = readyOutcomes.map((o) => buildAssetSeries(o.result.ledger));
    const length = seriesPerOutcome[0]?.length ?? 0;
    return Array.from({ length }, (_, i) => {
      const row: { x: string } & Record<string, string | number | null> = {
        x: seriesPerOutcome[0][i].date,
      };
      seriesPerOutcome.forEach((series, idx) => {
        row[`s${idx}`] = series[i]?.marketValue ?? null;
      });
      return row;
    });
  }, [readyOutcomes]);

  const chartSeries = readyOutcomes.map((outcome, idx) => ({
    key: `s${idx}`,
    name: exposureLabel(outcome.exposure),
    color: scenarioColor(idx),
  }));

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
                  series={chartSeries}
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
