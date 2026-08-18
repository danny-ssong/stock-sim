'use client';

import { useSimulationInputState } from '../../hooks/use-simulation-input';
import { useSimulationQueryContext } from '../../hooks/use-simulation-query-context';
import { useScenariosState } from '../../hooks/use-scenarios';
import { useCompareSimulationResult } from '../../hooks/use-compare-simulation-result';
import { computeScenarioDiff } from '../../lib/sim/scenario-diff';
import { ScenarioEditor } from '../input-panel/ScenarioEditor';
import { ScenarioSummaryCard } from './ScenarioSummaryCard';
import { TransferBreakevenChart } from './TransferBreakevenChart';

/**
 * 탭 3(시나리오 비교) 결과 화면. 공유 입력은 FutureResultsView·BacktestResultsView와
 * 같은 방식(useSimulationInputState 재호출, nuqs가 URL로 동기화)으로 가져오되,
 * 계좌 배분·지수 노출만 시나리오별로 별도 관리한다(useScenariosState).
 */
export function CompareResultsView() {
  const context = useSimulationQueryContext('future');
  const { query } = useSimulationInputState(context);
  const { scenarios, setScenarios } = useScenariosState();
  const state = useCompareSimulationResult(query.input, scenarios);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      <ScenarioEditor scenarios={scenarios} onChange={setScenarios} years={query.input.years} />

      {state.status === 'loading' && (
        <p className="text-zinc-500">데이터를 불러오는 중입니다…</p>
      )}
      {state.status === 'dataset-error' && <p className="text-red-600">{state.message}</p>}

      {state.status === 'ready' && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {state.outcomes.map((outcome, index) => (
              <ScenarioSummaryCard
                key={index}
                outcome={outcome}
                diff={index === 0 ? null : computeScenarioDiff(state.outcomes[0], outcome)}
              />
            ))}
          </div>

          {state.outcomes.map((outcome, index) =>
            outcome.kind === 'transfer' && outcome.config.kind === 'transfer' ? (
              <TransferBreakevenChart
                key={index}
                comparison={outcome.comparison}
                transferYear={outcome.config.transferYear}
              />
            ) : null,
          )}
        </>
      )}
    </div>
  );
}
