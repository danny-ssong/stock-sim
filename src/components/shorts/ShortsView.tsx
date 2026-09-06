'use client';

import { memo } from 'react';
import { useCompareSimulationResult } from '../../hooks/use-compare-simulation-result';
import { exposureTicker } from '../../lib/data/labels';
import type { IndexExposure } from '../../lib/data/types';
import { formatContributionPlan, formatKrwHuman } from '../../lib/format';
import { buildTimeTicks, timelineBounds, toDateString } from '../../lib/playback/timeline';
import type { SimulationInputBase } from '../../lib/sim/types';
import { DARK_THEME } from '../playback/draw-frame';
import { PlaybackHeadline } from '../playback/PlaybackHeadline';
import { PlaybackScrubber, PlayButton } from '../playback/PlaybackScrubber';
import { usePlaybackDisplay } from '../playback/use-playback-display';
import { buildAssetPlayback } from '../playback/series';
import { PLAYBACK_DURATION_MS, usePlayback } from '../playback/use-playback';
import { usePlaybackCanvas } from '../playback/use-playback-canvas';

/**
 * "QQQ vs QLD" — 숏츠는 티커로 부른다.
 *
 * 한글 라벨을 쓰면 "나스닥100 vs 나스닥100 2배"가 9:16 카드에서 두 줄로 넘쳐
 * 차트가 차지할 세로 공간을 잡아먹는다. 이 화면은 상품을 고르는 곳이 아니라
 * 결과를 보여주는 곳이라, 무엇을 산 건지는 티커만으로 충분하다.
 */
function titleOf(exposures: readonly IndexExposure[]): string {
  return exposures.map(exposureTicker).join(' vs ');
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
 * deferred 값이라 무관한 리렌더에서는 identity가 그대로다. (예전 주석은 이 memo가
 * react-hooks/refs 오탐을 막아 준다고 적어 두었는데, 원인 진단이 틀렸다. 규칙이
 * 걸리는 건 훅 반환 객체에서 프로퍼티로 ref를 바로 읽을 때이고, 해법은 memo가
 * 아니라 반환값을 즉시 구조분해하는 것이다 — 이 플랜 전체가 그 방식을 쓴다.)
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

  const asset = buildAssetPlayback(outcomes, exposureTicker);
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

  const display = usePlaybackDisplay();

  const { status, start, seek } = usePlayback({
    durationMs: PLAYBACK_DURATION_MS,
    onFrame: (progress) => {
      assetCanvas.drawAt(progress);
      const time = bounds.from + (bounds.to - bounds.from) * progress;
      display.update(progress, toDateString(time));
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
    // 카드와 조작 UI를 형제로 둔다 — 카드 안에 있는 것만이 캡처할 그림이고,
    // 재생 버튼·스크럽은 그 그림에 섞이면 안 되는 도구다.
    <div className="mx-auto flex w-[calc((100vh_-_7rem)_*_3/8)] max-w-[min(600px,100%)] flex-col gap-2">
      {/* 폭을 wrapper에서 직접 계산한다 — 쓸 수 있는 높이의 2/3에 9:16을 곱한 값
          ((100vh - 7rem) * 2/3 * 9/16 = (100vh - 7rem) * 3/8)이다. 카드는 그 폭을
          그대로 받아 aspect-[9/16]로 높이를 스스로 유도한다.

          이전에는 반대로(카드에 높이를 주고 폭을 auto로 두고, wrapper를 w-fit으로
          접었다) 했었는데, 그러면 형제인 조작 UI(w-full 안의 <input type=range>)가
          가진 브라우저 기본 콘텐츠 폭이 w-fit의 "가장 넓은 자식" 계산에 끼어들어
          카드보다 넓게 wrapper를 부풀렸다 — 카드는 제 비율대로 그려지는데 그 아래
          재생바만 카드 폭을 넘어 삐져나오는 원인이었다. wrapper 폭을 자식들의
          콘텐츠 크기와 무관하게 직접 정해두면 그런 역전이 생길 수 없다. */}
      <div className="flex aspect-[9/16] w-full flex-col gap-3 rounded-xl bg-zinc-950 p-5 text-zinc-100">
        <div className="text-center">
          <h2 className="text-3xl font-bold">{titleOf(exposures)}</h2>
          <p className="text-sm text-amber-400">{formatContributionPlan(base)}</p>
        </div>

        {/* 날짜와 진행바는 카드 안에 남는다 — 참고 영상에서도 이 둘은 조작 요소가
            아니라 "지금 어디를 보고 있는지" 알려주는 그림의 일부다 */}
        <PlaybackHeadline
          headlineRef={display.headlineRef}
          progressRef={display.progressRef}
          large
        />

        <canvas ref={assetCanvas.canvasRef} className="w-full flex-1" />

        {/* 상품이 하나면 grid-cols-2에서 오른쪽 절반이 빈 채로 남아 카드가 한쪽으로
            쏠린다 — 개수에 맞춰 열을 정한다. */}
        <div
          className={`grid gap-2 text-center ${outcomes.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}
        >
          {outcomes.map((outcome) => {
            // 평가액(finalAfterTax, 세후)과 나란히 놓을 수익률은 반드시 같은 금액 기준으로
            // 계산한다 — 원장을 다시 훑어 세전 시점값을 쓰면 "평가액 대비 이 %가 맞나"
            // 되짚어 볼 때 숫자가 안 맞는다(§G item 6).
            const { totalContributed, finalAfterTax } = outcome.result;
            const rate =
              totalContributed > 0 ? (finalAfterTax - totalContributed) / totalContributed : null;
            return (
              <div key={outcome.exposure} className="flex flex-col">
                <span className="text-xs text-zinc-400">{exposureTicker(outcome.exposure)}</span>
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

      {/* 카드 밖 — 캡처 영역에 조작 요소가 들어가지 않는다. 이 화면은 canvas가 처음부터
          마운트돼 있으므로 재생 전에도 스크럽이 실제로 그려진다 */}
      <div className="flex items-center gap-3">
        <PlayButton status={status} onStart={start} compact />
        <PlaybackScrubber onSeek={seek} sliderRef={display.sliderRef} />
      </div>
    </div>
  );
});
