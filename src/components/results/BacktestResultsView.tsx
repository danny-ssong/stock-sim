'use client';

import { useSimulationInputState } from '../../hooks/use-simulation-input';
import { useSimulationQueryContext } from '../../hooks/use-simulation-query-context';
import { useBacktestSimulationResult } from '../../hooks/use-backtest-simulation-result';
import { BacktestValueChart } from './BacktestValueChart';
import { ContributionChart } from './ContributionChart';
import { LeverageRiskNotice } from './LeverageRiskNotice';
import { MddPanel } from './MddPanel';
import { ResultSummary } from './ResultSummary';
import { TaxBreakdown } from './TaxBreakdown';
import { WarningsBanner } from './WarningsBanner';

/**
 * 탭 2(과거 백테스트) 결과 화면. FutureResultsView와 달리 목표금액 역산이
 * 없으므로 GoalSeekPanel을 쓰지 않는다 — InputPanel의 isGoalMode도
 * mode === 'future'로 한정돼 있어(M17류 예방) 여기서 target을 신경 쓸 필요가 없다.
 */
export function BacktestResultsView() {
  const context = useSimulationQueryContext('backtest');
  const { query } = useSimulationInputState(context);
  const state = useBacktestSimulationResult(query.input);

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
          선택한 시작 시점부터는 데이터가 최대 {state.maxYears}년치만 있습니다. 왼쪽에서 기간을{' '}
          {state.maxYears}년 이하로 줄여주세요.
        </p>
      )}
      {state.status === 'ready' && (
        <>
          <WarningsBanner warnings={state.result.warnings} syntheticRatio={state.result.syntheticRatio} />
          <LeverageRiskNotice allocations={state.input.allocations} portfolioIndex={state.result.portfolioIndex} />
          <ResultSummary input={state.input} result={state.result} />
          <MddPanel portfolioIndex={state.result.portfolioIndex} />
          <BacktestValueChart portfolioIndex={state.result.portfolioIndex} />
          <ContributionChart ledger={state.result.ledger} years={state.input.years} />
          <TaxBreakdown result={state.result} />
        </>
      )}
    </div>
  );
}
