'use client';

import { memo } from 'react';
import { useFutureSimulationResult } from '../../hooks/use-simulation-result';
import type { SimulationInput } from '../../lib/sim/types';
import { AssetChart } from './AssetChart';
import { BacktestValueChart } from './BacktestValueChart';
import { ExposureSummaryHero } from './ExposureSummaryHero';
import { FoodBasketBadge } from './FoodBasketBadge';

/**
 * 상품 하나 × 미래 설계 결과. 입력은 ResultsView가 URL에서 읽어 내려준다.
 *
 * memo를 씌우는 이유는 슬라이더 드래그다. 드래그 한 틱은 렌더를 두 번 만든다 —
 * urgent 패스(ResultsView의 useDeferredValue가 아직 *이전* 값을 돌려주는 패스)와
 * 그 뒤의 transition 패스(새 값). urgent 패스에서 이 컴포넌트가 받는 input은
 * 직전 렌더의 것과 같은 객체인데(ResultsView가 useMemo로 identity를 고정한다),
 * memo가 없으면 "부모가 렌더됐다"는 이유만으로 차트 트리 전체가 다시 그려진다 —
 * 화면에 아무 변화도 만들지 않는 렌더다. memo가 그 연결을 끊어 실제로 값이 바뀐
 * transition 패스에서만 그리게 한다.
 */
export const FutureResultsView = memo(function FutureResultsView({
  input,
}: {
  input: SimulationInput;
}) {
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
          <ExposureSummaryHero exposure={state.input.exposure} result={state.result} />
          {/* 상품 가격 추이를 자산 추이보다 위에 둔다 — 두 차트가 같은 기간을
              덮으므로, 원인(가격이 어떻게 움직였나)을 먼저 보여준 뒤 그 결과(내
              돈이 어떻게 됐나)를 아래에 이어 붙이는 순서가 더 읽기 쉽다.
              위는 일별, 아래는 월별로 해상도는 다르지만 x축 틱은 공유한다
              (lib/chart/x-axis.ts dateAxisProps). */}
          <BacktestValueChart
            portfolioIndex={state.result.portfolioIndex}
            exposure={state.input.exposure}
          />
          <AssetChart ledger={state.result.ledger} exposure={state.input.exposure} />
          <FoodBasketBadge
            years={state.input.years}
            startMonth={state.input.startMonth}
            returnSource={state.input.returnSource}
          />
        </>
      )}
    </div>
  );
});
