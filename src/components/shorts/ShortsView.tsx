'use client';

import { memo, useRef } from 'react';
import { useCompareSimulationResult } from '../../hooks/use-compare-simulation-result';
import { exposureLabel } from '../../lib/data/labels';
import type { IndexExposure } from '../../lib/data/types';
import { formatKrwHuman } from '../../lib/format';
import { buildTimeTicks, timelineBounds, toDateString } from '../../lib/playback/timeline';
import type { SimulationInputBase } from '../../lib/sim/types';
import { DARK_THEME } from '../playback/draw-frame';
import { PlaybackControls, type PlaybackControlsHandle } from '../playback/PlaybackControls';
import { buildAssetPlayback } from '../playback/series';
import { PLAYBACK_DURATION_MS, usePlayback } from '../playback/use-playback';
import { usePlaybackCanvas } from '../playback/use-playback-canvas';

const MANWON = 10_000;

/** "월 50만원씩 10년 투자" — 입력값에서 부제를 만든다 */
function subtitleOf(base: SimulationInputBase): string {
  const monthly = Math.round(base.contribution.base / MANWON).toLocaleString('ko-KR');
  return `월 ${monthly}만원씩 ${base.years}년 투자`;
}

function titleOf(exposures: readonly IndexExposure[]): string {
  return exposures.map(exposureLabel).join(' vs ');
}

/**
 * 숏츠 포맷의 세로 화면. 재생이 주인공이라 정적 차트가 등장하지 않고, 재생이 끝나도
 * 복구하지 않는다(restoreDelayMs를 넘기지 않는다) — 끝점 라벨이 남아야 화면을
 * 캡처했을 때 그림이 완성된다.
 *
 * 배경은 앱 테마와 무관하게 다크 고정이다. 렌더러가 테마를 인자로 받는 설계가
 * 이걸 가능하게 한다(draw-frame.ts).
 *
 * memo를 씌우는 이유는 CompareResultsView와 같다 — base·exposures가 ResultsView의
 * deferred 값이라 무관한 리렌더에서는 identity가 그대로다. (부수적으로, 이 memo
 * 래핑이 없으면 usePlaybackCanvas가 돌려주는 canvasRef를 canvas의 ref로 바로
 * 넘기는 지점에서 eslint-plugin-react-hooks(v7.1.1)의 react-hooks/refs 규칙이
 * false positive를 낸다 — CompareResultsView도 같은 패턴을 memo로 감싼 채로 쓰고
 * 있어서 겉으로 드러나지 않았을 뿐, memo 없는 순수 함수 선언에서만 재현된다.)
 */
export const ShortsView = memo(function ShortsView({
  base,
  exposures,
}: {
  base: SimulationInputBase;
  exposures: IndexExposure[];
}) {
  const state = useCompareSimulationResult(base, exposures);
  const outcomes = state.status === 'ready' ? state.outcomes.filter((o) => o.kind === 'ready') : [];

  const asset = buildAssetPlayback(outcomes);
  // 이 화면은 canvas가 하나뿐이라 합집합을 구할 필요는 없지만, bounds가 null(그릴
  // 점이 없음)일 수 있다는 사실은 CompareResultsView와 같다 — 아래 이른 return들이
  // 그 경우를 실제로 걸러 내므로, 여기 폴백은 훅 호출 시점에 타입만 맞추는 용도다.
  const bounds = timelineBounds(asset.series) ?? { from: 0, to: 0 };
  const assetCanvas = usePlaybackCanvas({
    series: asset.series,
    styles: asset.styles,
    ticks: buildTimeTicks(asset.dates),
    bounds,
    theme: DARK_THEME,
    valueFormatter: formatKrwHuman,
    changeRateOf: asset.changeRateOf,
  });

  const controlsRef = useRef<PlaybackControlsHandle | null>(null);

  const { status, start, seek } = usePlayback({
    durationMs: PLAYBACK_DURATION_MS,
    onFrame: (progress) => {
      assetCanvas.drawAt(progress);
      if (controlsRef.current !== null) {
        const time = bounds.from + (bounds.to - bounds.from) * progress;
        controlsRef.current.update(progress, toDateString(time));
      }
    },
  });

  // dataset-error/insufficient-data를 "불러오는 중"으로 뭉개면 실제로는 멈춘
  // 상태가 영원히 로딩 중인 것처럼 보인다 — CompareResultsView와 같은 문구로 원인을
  // 그대로 보여준다.
  if (state.status === 'dataset-error') {
    return <p className="p-4 text-red-600">{state.message}</p>;
  }
  if (state.status === 'insufficient-data') {
    return (
      <p className="p-4 text-amber-600">
        선택한 시작 시점부터는 계산할 수 있는 데이터가 1년치도 없습니다. 왼쪽에서 시작
        시점을 더 최근으로 옮겨주세요.
      </p>
    );
  }
  if (state.status !== 'ready' || outcomes.length === 0) {
    return <p className="p-4 text-zinc-500">데이터를 불러오는 중입니다…</p>;
  }

  return (
    <div className="mx-auto flex aspect-[9/16] max-h-[calc(100vh-6rem)] w-full max-w-[520px] flex-col gap-3 rounded-xl bg-zinc-950 p-5 text-zinc-100">
      <div className="text-center">
        <h2 className="text-2xl font-bold">{titleOf(exposures)}</h2>
        <p className="text-sm text-amber-400">{subtitleOf(base)}</p>
      </div>

      <PlaybackControls status={status} onStart={start} onSeek={seek} handleRef={controlsRef} large />

      <canvas ref={assetCanvas.canvasRef} className="w-full flex-1" />

      <div className="grid grid-cols-2 gap-2 text-center">
        {outcomes.map((outcome) => {
          // 평가액(finalAfterTax, 세후)과 나란히 놓을 수익률은 반드시 같은 금액 기준으로
          // 계산한다 — 원장을 다시 훑어 세전 시점값을 쓰면 "평가액 대비 이 %가 맞나"
          // 되짚어 볼 때 숫자가 안 맞는다(§G item 6).
          const { totalContributed, finalAfterTax } = outcome.result;
          const rate = totalContributed > 0 ? (finalAfterTax - totalContributed) / totalContributed : null;
          return (
            <div key={outcome.exposure} className="flex flex-col">
              <span className="text-xs text-zinc-400">{exposureLabel(outcome.exposure)}</span>
              <span className="text-[11px] text-zinc-500">
                투자금액 {formatKrwHuman(totalContributed)}
              </span>
              <span className="text-lg font-bold">{formatKrwHuman(finalAfterTax)}</span>
              {rate !== null && (
                <span className="text-xs text-zinc-400">
                  {rate >= 0 ? '+' : ''}
                  {(rate * 100).toFixed(1)}%
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
