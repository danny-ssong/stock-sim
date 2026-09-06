'use client';

import { memo, useMemo } from 'react';
import { useFutureSimulationResult } from '../../hooks/use-simulation-result';
import { formatKrwHuman } from '../../lib/format';
import type { SimulationInput } from '../../lib/sim/types';
import type { PlaybackView } from '../../lib/url/schema';
import { LIGHT_THEME } from '../playback/draw-frame';
import { PlaybackTransport } from '../playback/PlaybackTransport';
import { buildAssetPlayback, buildPricePlayback } from '../playback/series';
import { useChartPlayback } from '../playback/use-chart-playback';
import { RESTORE_DELAY_MS } from '../playback/use-playback';
import { AssetChart } from './AssetChart';
import { BacktestValueChart } from './BacktestValueChart';
import { ExposureSummaryHero } from './ExposureSummaryHero';
import { FoodBasketBadge } from './FoodBasketBadge';
import { ResultsToolbar } from './ResultsToolbar';

/** 가격 축은 배수 표기다(level은 시작을 1로 정규화한 값). 모듈 상수라야 identity가
 *  안정적이다 — tracks 안에서 매 렌더 새 함수를 만들면 아래 useMemo가 무의미해진다. */
const PRICE_FORMATTER = (value: number) => `${value.toFixed(2)}x`;

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
  view,
  onViewChange,
}: {
  input: SimulationInput;
  view: PlaybackView;
  onViewChange: (view: PlaybackView) => void;
}) {
  const state = useFutureSimulationResult(input);

  // buildPricePlayback/buildAssetPlayback은 ReadyOutcome[]를 받으므로 한 개짜리
  // 배열이면 단일 화면도 그대로 동작한다 — 비교 화면과 배선이 같아진다.
  //
  // useMemo를 쓰는 이유는 CompareResultsView와 같다 — 이 배열의 identity가 바뀌면
  // useChartPlayback 안의 틱·bounds 메모가 매 렌더 무효화되고, canvas가 마운트조차
  // 되지 않은 idle 상태에서도 원장을 통째로 다시 훑게 된다.
  //
  // 결과가 아직 없어도 길이는 항상 2다. useChartPlayback이 트랙 자리마다
  // usePlaybackCanvas를 부르므로, 길이가 0↔2로 오가면 훅 호출 수가 렌더마다
  // 달라져 React가 곧바로 터진다 — 빈 outcome 배열을 감싸 자리만 지킨다.
  const tracks = useMemo(() => {
    const ready =
      state.status === 'ready'
        ? [{ kind: 'ready' as const, exposure: state.input.exposure, result: state.result }]
        : [];
    return [
      { bundle: buildPricePlayback(ready), valueFormatter: PRICE_FORMATTER },
      { bundle: buildAssetPlayback(ready), valueFormatter: formatKrwHuman },
    ];
  }, [state]);

  const playback = useChartPlayback({
    tracks,
    theme: LIGHT_THEME,
    restoreDelayMs: RESTORE_DELAY_MS,
  });
  // 반환값은 곧바로 구조분해한다 — 렌더 중에 playback.canvasRefs처럼 프로퍼티로
  // 접근하면 react-hooks/refs가 "렌더 중 ref 접근"으로 오탐한다.
  const { canvasRefs, showsCanvas } = playback;
  // tracks와 같은 순서다. 이름을 붙여 두면 JSX에서 canvasRefs[1]이 어느 차트인지
  // 세어 보지 않아도 된다.
  const [priceCanvasRef, assetCanvasRef] = canvasRefs;

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      <ResultsToolbar view={view} onViewChange={onViewChange} />
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
          {/* 정적 차트와 재생 캔버스의 교대는 차트 컴포넌트 안에서 일어난다 — 제목과
              여백이 두 상태에 공통이라 바깥에서 통째로 갈아 끼울 수 없다. */}
          <BacktestValueChart
            portfolioIndex={state.result.portfolioIndex}
            exposure={state.input.exposure}
            playbackCanvasRef={showsCanvas ? priceCanvasRef : null}
          />
          <AssetChart
            ledger={state.result.ledger}
            exposure={state.input.exposure}
            playbackCanvasRef={showsCanvas ? assetCanvasRef : null}
          />
          {/* 두 차트를 함께 굴리는 컨트롤이라 둘 아래에 한 번만 둔다 */}
          <PlaybackTransport playback={playback} />
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
