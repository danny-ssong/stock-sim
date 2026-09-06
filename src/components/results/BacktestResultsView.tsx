'use client';

import { memo } from 'react';
import { useBacktestSimulationResult } from '../../hooks/use-backtest-simulation-result';
import type { SimulationInput } from '../../lib/sim/types';
import type { PlaybackView } from '../../lib/url/schema';
import { AssetChart } from './AssetChart';
import { BacktestValueChart } from './BacktestValueChart';
import { ExposureSummaryHero } from './ExposureSummaryHero';
import { ResultsToolbar } from './ResultsToolbar';

/** 상품 하나 × 과거 검증 결과. 입력은 ResultsView가 URL에서 읽어 내려준다.
 *  memo를 씌우는 이유는 FutureResultsView와 같다 — 드래그의 urgent 패스에서
 *  input identity가 그대로라, 그 패스의 차트 리렌더는 순수한 낭비다. */
export const BacktestResultsView = memo(function BacktestResultsView({
  input,
  view,
  onViewChange,
}: {
  input: SimulationInput;
  view: PlaybackView;
  onViewChange: (view: PlaybackView) => void;
}) {
  const state = useBacktestSimulationResult(input);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      <ResultsToolbar view={view} onViewChange={onViewChange} />
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
          선택한 시작 시점부터는 계산할 수 있는 데이터가 1년치도 없습니다. 왼쪽에서 시작
          시점을 더 최근으로 옮겨주세요.
        </p>
      )}
      {state.status === 'ready' && (
        <>
          <ExposureSummaryHero exposure={state.input.exposure} result={state.result} />
          {/* 상품 가격 추이를 자산 추이보다 위에 둔다(FutureResultsView와 동일) —
              두 차트가 같은 기간을 덮으므로, 원인(가격이 어떻게 움직였나)을 먼저
              보여준 뒤 결과(내 돈이 어떻게 됐나)를 이어 붙인다. 위는 일별,
              아래는 월별로 해상도는 다르지만 x축 틱은 공유한다
              (lib/chart/x-axis.ts dateAxisProps). */}
          <BacktestValueChart
            portfolioIndex={state.result.portfolioIndex}
            exposure={state.input.exposure}
          />
          <AssetChart ledger={state.result.ledger} exposure={state.input.exposure} />
        </>
      )}
    </div>
  );
});
