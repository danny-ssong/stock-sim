'use client';

import { useFutureSimulationResult } from '../../hooks/use-simulation-result';
import type { SimulationInput } from '../../lib/sim/types';
import { AssetChart } from './AssetChart';
import { BacktestValueChart } from './BacktestValueChart';
import { ExposureSummaryCard } from './ExposureSummaryCard';
import { FoodBasketBadge } from './FoodBasketBadge';
import { LeverageRiskNotice } from './LeverageRiskNotice';

/** 상품 하나 × 미래 설계 결과. 입력은 ResultsView가 URL에서 읽어 내려준다. */
export function FutureResultsView({ input }: { input: SimulationInput }) {
  const state = useFutureSimulationResult(input);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      {state.status === 'loading' && <p className="text-zinc-500">데이터를 불러오는 중입니다…</p>}
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
          <LeverageRiskNotice
            exposure={state.input.exposure}
            portfolioIndex={state.result.portfolioIndex}
            isHistoricalPath={state.input.returnSource.type === 'historicalPath'}
          />
          <ExposureSummaryCard
            outcome={{ kind: 'ready', exposure: state.input.exposure, result: state.result }}
          />
          {/* 상품 가격 추이를 자산 추이보다 위에 둔다 — 두 차트가 같은 x축(날짜·연도
              틱)을 쓰므로, 원인(가격이 어떻게 움직였나)을 먼저 보여준 뒤 그 결과(내
              돈이 어떻게 됐나)를 아래에 이어 붙이는 순서가 더 읽기 쉽다. */}
          <BacktestValueChart portfolioIndex={state.result.portfolioIndex} />
          <AssetChart ledger={state.result.ledger} />
          <FoodBasketBadge
            finalAfterTax={state.result.finalAfterTax}
            years={state.input.years}
            startMonth={state.input.startMonth}
          />
          <p className="text-xs text-zinc-500">
            세금 계산은 참고용이며 실제 신고는 세무 전문가와 상의해야 합니다.
          </p>
        </>
      )}
    </div>
  );
}
