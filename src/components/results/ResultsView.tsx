'use client';

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

  if (exposures.length > 1) {
    return <CompareResultsView base={base} exposures={exposures} />;
  }

  // parseExposures가 항상 1개 이상을 보장한다(url/exposures.ts).
  const input = { ...base, exposure: exposures[0] };
  return base.mode === 'backtest' ? (
    <BacktestResultsView input={input} />
  ) : (
    <FutureResultsView input={input} />
  );
}
