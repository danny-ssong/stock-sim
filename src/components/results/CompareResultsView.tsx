'use client';

import { useMemo } from 'react';
import { useSimulationInputState } from '../../hooks/use-simulation-input';
import { useSimulationQueryContext } from '../../hooks/use-simulation-query-context';
import { useScenariosState } from '../../hooks/use-scenarios';
import { useCompareSimulationResult } from '../../hooks/use-compare-simulation-result';
import { computeScenarioDiff } from '../../lib/sim/scenario-diff';
import { buildAssetSeries } from '../../lib/sim/asset-series';
import { scenarioColor } from '../../lib/chart/colors';
import { ScenarioEditor } from '../input-panel/ScenarioEditor';
import { ScenarioSummaryCard } from './ScenarioSummaryCard';
import SimLineChart from './SimLineChart';

/**
 * 탭 3(시나리오 비교) 결과 화면. 공유 입력은 FutureResultsView·BacktestResultsView와
 * 같은 방식(useSimulationInputState 재호출, nuqs가 URL로 동기화)으로 가져오되,
 * 지수 노출만 시나리오별로 별도 관리한다(useScenariosState). 계좌가 하나뿐이라
 * 시나리오 간 차이는 노출 선택뿐이므로, 손익분기·계좌비교 UI 대신 상품 가격과
 * 내 자산 추이를 시나리오 색상으로 겹쳐 보여주는 오버레이 두 개로 비교한다.
 */
export function CompareResultsView() {
  const context = useSimulationQueryContext('future');
  const { query } = useSimulationInputState(context);
  const { scenarios, setScenarios } = useScenariosState();
  const state = useCompareSimulationResult(query.input, scenarios);

  const readyOutcomes = useMemo(
    () => (state.status === 'ready' ? state.outcomes.filter((o) => o.kind === 'ready') : []),
    [state],
  );

  const priceData = useMemo(() => {
    if (readyOutcomes.length === 0) return [];
    const length = readyOutcomes[0].result.portfolioIndex.length;
    return Array.from({ length }, (_, i) => {
      const row: { x: string } & Record<string, string | number> = {
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
    const seriesPerOutcome = readyOutcomes.map((o) => buildAssetSeries(o.result.ledger, query.input.years));
    return Array.from({ length: query.input.years }, (_, yearIndex) => {
      const row: { x: string } & Record<string, string | number> = { x: String(yearIndex + 1) };
      seriesPerOutcome.forEach((series, idx) => {
        row[`s${idx}`] = series[yearIndex]?.marketValue ?? null;
      });
      return row;
    });
  }, [readyOutcomes, query.input.years]);

  const chartSeries = readyOutcomes.map((outcome, idx) => ({
    key: `s${idx}`,
    name: outcome.config.label,
    color: scenarioColor(idx),
  }));

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      <ScenarioEditor scenarios={scenarios} onChange={setScenarios} />

      {state.status === 'loading' && <p className="text-zinc-500">데이터를 불러오는 중입니다…</p>}
      {state.status === 'dataset-error' && <p className="text-red-600">{state.message}</p>}

      {state.status === 'ready' && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {state.outcomes.map((outcome, index) => (
              <ScenarioSummaryCard
                key={index}
                outcome={outcome}
                diff={index === 0 ? null : computeScenarioDiff(state.outcomes[0], outcome)}
                baselineLabel={state.outcomes[0].config.label}
              />
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
                <SimLineChart data={assetData} series={chartSeries} scale="linear" />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
