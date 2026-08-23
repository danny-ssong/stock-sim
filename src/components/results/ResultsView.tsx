'use client';

import { useMemo } from 'react';
import { useSimulationInputState } from '../../hooks/use-simulation-input';
import { useSimulationQueryContext } from '../../hooks/use-simulation-query-context';
import { BacktestResultsView } from './BacktestResultsView';
import { CompareResultsView } from './CompareResultsView';
import { FutureResultsView } from './FutureResultsView';

/**
 * 결과 영역의 유일한 분기점. 비교 대상 개수와 시점(모드)이 직교하므로 네 조합이
 * 모두 성립한다 — 탭 시절 비어 있던 "과거 × 비교"가 여기서 생긴다.
 *
 * InputPanel도 독립적으로 useSimulationInputState를 호출한다(같은 훅을 두 번
 * 인스턴스화). nuqs가 URL을 단일 진실 소스로 동기화하므로 두 인스턴스는 자동으로
 * 같은 값을 본다 — 상태를 page.tsx로 끌어올리지 않는 이유다.
 */
export function ResultsView() {
  const context = useSimulationQueryContext();
  const { base, exposures } = useSimulationInputState(context);

  // parseExposures가 항상 1개 이상을 보장한다(url/exposures.ts). 노출 1개 경로의
  // 결과 훅(useFutureSimulationResult·useBacktestSimulationResult)이 이 값의
  // identity로 메모이제이션하므로, 매 렌더 새 객체를 만들면 그 메모가 무력화되고
  // simulate()가 매 렌더 재실행된다 — useMemo로 identity를 안정화한다.
  const singleInput = useMemo(() => ({ ...base, exposure: exposures[0] }), [base, exposures]);

  if (exposures.length > 1) {
    return <CompareResultsView base={base} exposures={exposures} />;
  }

  return base.mode === 'backtest' ? (
    <BacktestResultsView input={singleInput} />
  ) : (
    <FutureResultsView input={singleInput} />
  );
}
