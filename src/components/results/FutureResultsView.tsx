'use client';

import { useSimulationInputState } from '../../hooks/use-simulation-input';
import { useSimulationQueryContext } from '../../hooks/use-simulation-query-context';
import { useFutureSimulationResult } from '../../hooks/use-simulation-result';
import { AssetChart } from './AssetChart';
import { BacktestValueChart } from './BacktestValueChart';
import { FoodBasketBadge } from './FoodBasketBadge';
import { LeverageRiskNotice } from './LeverageRiskNotice';
import { ResultSummary } from './ResultSummary';
import { TaxBreakdown } from './TaxBreakdown';
import { WarningsBanner } from './WarningsBanner';

/**
 * InputPanel도 독립적으로 useSimulationInputState를 호출한다(같은 훅을 두 번
 * 인스턴스화). nuqs가 URL을 단일 진실 소스로 동기화하므로 두 인스턴스는
 * 자동으로 같은 값을 본다.
 */
export function FutureResultsView() {
  const context = useSimulationQueryContext('future');
  const { input } = useSimulationInputState(context);
  const state = useFutureSimulationResult(input);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      {state.status === 'loading' && (
        <p className="text-zinc-500">데이터를 불러오는 중입니다…</p>
      )}
      {state.status === 'dataset-error' && <p className="text-red-600">{state.message}</p>}
      {state.status === 'blocked' && (
        <ul className="text-sm text-red-600">
          {state.blockers.length === 0 ? (
            <li>이 조합으로는 시뮬레이션을 계산할 수 없습니다.</li>
          ) : (
            state.blockers.map((blocker, i) => (
              <li key={`${blocker.code}-${i}`}>{blocker.message}</li>
            ))
          )}
        </ul>
      )}
      {state.status === 'ready' && (
        <>
          <WarningsBanner
            warnings={state.result.warnings}
            syntheticRatio={state.result.syntheticRatio}
          />
          {state.result.labels.path !== null && (
            <p className="text-xs text-zinc-500">{state.result.labels.path}</p>
          )}
          <LeverageRiskNotice
            exposure={state.input.exposure}
            portfolioIndex={state.result.portfolioIndex}
            isHistoricalPath={state.input.returnSource.type === 'historicalPath'}
          />
          <ResultSummary input={state.input} result={state.result} />
          <FoodBasketBadge
            finalAfterTax={state.result.finalAfterTax}
            years={state.input.years}
            startMonth={state.input.startMonth}
          />
          <BacktestValueChart portfolioIndex={state.result.portfolioIndex} />
          <AssetChart ledger={state.result.ledger} />
          <TaxBreakdown result={state.result} />
        </>
      )}
    </div>
  );
}
