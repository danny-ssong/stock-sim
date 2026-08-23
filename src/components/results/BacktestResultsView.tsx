'use client';

import { useBacktestSimulationResult } from '../../hooks/use-backtest-simulation-result';
import type { SimulationInput } from '../../lib/sim/types';
import { AssetChart } from './AssetChart';
import { BacktestValueChart } from './BacktestValueChart';
import { LeverageRiskNotice } from './LeverageRiskNotice';
import { MddPanel } from './MddPanel';
import { ResultSummary } from './ResultSummary';
import { TaxBreakdown } from './TaxBreakdown';
import { WarningsBanner } from './WarningsBanner';

/** 상품 하나 × 과거 검증 결과. 입력은 ResultsView가 URL에서 읽어 내려준다. */
export function BacktestResultsView({ input }: { input: SimulationInput }) {
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
          선택한 시작 시점부터는 계산할 수 있는 데이터가 부족합니다. 왼쪽에서 시작 시점을 더
          최근으로 옮기거나 기간을 {state.maxYears}년 이하로 줄여주세요.
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
          {/* 사용자의 질문은 "내 돈이 어떻게 되나"이지 "상품 가격이 어떻게 되나"가
              아니다 — 자산 추이를 가격 추이보다 위에 둔다(FutureResultsView와 동일). */}
          <AssetChart ledger={state.result.ledger} years={state.input.years} />
          <BacktestValueChart portfolioIndex={state.result.portfolioIndex} />
          <TaxBreakdown result={state.result} />
        </>
      )}
    </div>
  );
}
