'use client';

import { useSimulationInputState } from '../../hooks/use-simulation-input';
import { useSimulationQueryContext } from '../../hooks/use-simulation-query-context';
import { useBacktestSimulationResult } from '../../hooks/use-backtest-simulation-result';
import { AssetChart } from './AssetChart';
import { BacktestValueChart } from './BacktestValueChart';
import { LeverageRiskNotice } from './LeverageRiskNotice';
import { MddPanel } from './MddPanel';
import { ResultSummary } from './ResultSummary';
import { TaxBreakdown } from './TaxBreakdown';
import { WarningsBanner } from './WarningsBanner';

/**
 * 탭 2(과거 백테스트) 결과 화면.
 */
export function BacktestResultsView() {
  const context = useSimulationQueryContext('backtest');
  const { input } = useSimulationInputState(context);
  const state = useBacktestSimulationResult(input);

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
      {state.status === 'insufficient-data' && (
        <p className="text-amber-600">
          선택한 시작 시점부터는 계산할 수 있는 데이터가 부족합니다. 왼쪽에서 시작 시점을 더 최근으로
          조정해주세요.
        </p>
      )}
      {state.status === 'ready' && (
        <>
          <WarningsBanner warnings={state.result.warnings} syntheticRatio={state.result.syntheticRatio} />
          <LeverageRiskNotice
            exposure={state.input.exposure}
            portfolioIndex={state.result.portfolioIndex}
            isHistoricalPath
          />
          <ResultSummary input={state.input} result={state.result} showTaxDetail={false} />
          <MddPanel portfolioIndex={state.result.portfolioIndex} />
          <BacktestValueChart portfolioIndex={state.result.portfolioIndex} />
          <AssetChart ledger={state.result.ledger} years={state.input.years} />
          <TaxBreakdown result={state.result} />
        </>
      )}
    </div>
  );
}
