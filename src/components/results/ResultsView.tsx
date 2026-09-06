'use client';

import { useDeferredValue, useMemo } from 'react';
import { useSimulationInputState } from '../../hooks/use-simulation-input';
import { useSimulationQueryContext } from '../../hooks/use-simulation-query-context';
import { ShortsView } from '../shorts/ShortsView';
import { BacktestResultsView } from './BacktestResultsView';
import { CompareResultsView } from './CompareResultsView';
import { FutureResultsView } from './FutureResultsView';
import { ResultsToolbar } from './ResultsToolbar';

/**
 * 결과 영역의 유일한 분기점. 비교 대상 개수와 시점(모드)이 직교하므로 네 조합이
 * 모두 성립한다 — 탭 시절 비어 있던 "과거 × 비교"가 여기서 생긴다.
 *
 * InputPanel도 독립적으로 useSimulationInputState를 호출한다(같은 훅을 두 번
 * 인스턴스화). nuqs가 URL을 단일 진실 소스로 동기화하므로 두 인스턴스는 자동으로
 * 같은 값을 본다 — 상태를 page.tsx로 끌어올리지 않는 이유다.
 *
 * base·exposures는 useDeferredValue로 한 단계 늦춰 받는다 — simulate()와 그 결과로
 * 그려지는 차트가 이 서브트리 안에서만 일어나므로, 이 값을 저우선순위로 두면
 * InputPanel(위 훅을 별도로 호출하는 urgent 인스턴스)은 즉시 반응하고 결과만
 * 뒤따라 갱신된다 — 슬라이더 드래그 중 인풋이 막히는 걸 막는다.
 */
export function ResultsView() {
  const context = useSimulationQueryContext();
  const { base, exposures, view, setView } = useSimulationInputState(context);
  const deferredBase = useDeferredValue(base);
  const deferredExposures = useDeferredValue(exposures);

  // parseExposures가 항상 1개 이상을 보장한다(url/exposures.ts). 노출 1개 경로의
  // 결과 훅(useFutureSimulationResult·useBacktestSimulationResult)이 이 값의
  // identity로 메모이제이션하므로, 매 렌더 새 객체를 만들면 그 메모가 무력화되고
  // simulate()가 매 렌더 재실행된다 — useMemo로 identity를 안정화한다.
  const singleInput = useMemo(
    () => ({ ...deferredBase, exposure: deferredExposures[0] }),
    [deferredBase, deferredExposures],
  );

  // view는 useDeferredValue를 거치지 않는다 — 화면 전환은 사용자가 버튼을 눌러 일으키는
  // 즉시 반응해야 할 변화라, 결과 계산과 함께 뒤로 미루면 클릭이 먹히지 않은 것처럼 보인다.
  // view는 노출 개수와 직교하는 축이다 — 상품 하나를 27년 굴린 결과도 숏츠 포맷으로
  // 성립하므로 개수 안쪽에 두지 않는다.
  if (view === 'shorts') {
    return (
      // 세로 여백을 아낀다 — 9:16 카드는 남는 높이가 곧 폭이라, 여기서 줄인 padding
      // 만큼 카드가 커진다.
      <div className="flex flex-1 flex-col items-center gap-2 p-2">
        <ResultsToolbar view={view} onViewChange={setView} />
        <ShortsView base={deferredBase} exposures={deferredExposures} />
      </div>
    );
  }

  if (deferredExposures.length > 1) {
    return (
      <CompareResultsView
        base={deferredBase}
        exposures={deferredExposures}
        view={view}
        onViewChange={setView}
      />
    );
  }

  return deferredBase.mode === 'backtest' ? (
    <BacktestResultsView input={singleInput} view={view} onViewChange={setView} />
  ) : (
    <FutureResultsView input={singleInput} view={view} onViewChange={setView} />
  );
}
