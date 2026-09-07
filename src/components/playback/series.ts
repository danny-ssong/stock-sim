import { CONTRIBUTED_COLOR, exposureColor } from '../../lib/chart/colors';
import { exposureLabel } from '../../lib/data/labels';
import type { IndexExposure } from '../../lib/data/types';
import { toPlaybackPoints, type PlaybackPoint, type PlaybackSeries } from '../../lib/playback/timeline';
import type { ExposureOutcome } from '../../lib/sim/compare';
import type { PlaybackSeriesStyle } from './draw-frame';

type ReadyOutcome = Extract<ExposureOutcome, { kind: 'ready' }>;

/**
 * 노출을 차트에 적을 이름으로 바꾸는 방법. 화면마다 쓸 수 있는 가로폭이 달라서
 * 호출자가 고른다 — 인라인 비교는 한글 라벨("나스닥100 2배"), 숏츠의 9:16 카드는
 * 티커(exposureTicker)를 쓴다. 시리즈를 만드는 쪽이 화면 폭을 알 이유는 없다.
 */
export type ExposureLabeller = (exposure: IndexExposure) => string;

/** 원금 시리즈의 키. 노출 순번 키(s0, s1…)와 겹치지 않는 이름이면 된다 */
export const CONTRIBUTED_KEY = 'contributed';

export type PlaybackBundle = {
  series: readonly PlaybackSeries[];
  styles: readonly PlaybackSeriesStyle[];
  /** 축 라벨 후보를 만들 원본 날짜 목록. 가장 촘촘한 시리즈의 것을 쓴다 */
  dates: readonly string[];
  /** 끝점 라벨에 띄울 수익률. 그 프레임의 마지막 점을 받아 그 시점 기준으로 계산한다 */
  changeRateOf: (key: string, point: PlaybackPoint) => number | null;
};

/**
 * 그릴 것이 없는 묶음. 결과가 아직 없을 때의 반환값이자, 재생 훅이 트랙 없는
 * canvas 자리를 채울 때 쓰는 자리표시자다 — 모듈 상수라 identity가 안정적이다.
 */
export const EMPTY_BUNDLE: PlaybackBundle = {
  series: [],
  styles: [],
  dates: [],
  changeRateOf: () => null,
};

/**
 * 자산 평가액 재생 묶음. 원금(회색 점선)을 맨 앞에 두어 다른 선들 아래에 깔린다.
 *
 * 원금은 노출과 무관하게 같으므로(납입 계획이 하나뿐이다) 첫 결과에서만 뽑는다 —
 * CompareResultsView의 buildAssetRows와 같은 이유다.
 */
export function buildAssetPlayback(
  outcomes: readonly ReadyOutcome[],
  labelOf: ExposureLabeller = exposureLabel,
): PlaybackBundle {
  if (outcomes.length === 0) return EMPTY_BUNDLE;
  const rowsPerOutcome = outcomes.map((outcome) => outcome.result.dailyAssetSeries);

  const contributedPoints = toPlaybackPoints(
    rowsPerOutcome[0],
    (row) => row.date,
    (row) => row.contributed,
  );

  // 시점별 수익률을 그 시점의 원금 대비로 계산하려면 "그 시점의 원금"이 필요하다 —
  // 원금 시리즈가 모든 outcome의 자산 시리즈와 날짜를 공유하므로(같은 납입 계획을
  // 같은 달력에 얹은 것이다) time → contributed 조회 테이블로 미리 뽑아 둔다.
  const contributedAt = new Map(contributedPoints.map((point) => [point.time, point.value]));

  const series: PlaybackSeries[] = [{ key: CONTRIBUTED_KEY, points: contributedPoints }];
  const styles: PlaybackSeriesStyle[] = [
    { key: CONTRIBUTED_KEY, name: '원금', color: CONTRIBUTED_COLOR, dashed: true },
  ];

  rowsPerOutcome.forEach((rows, index) => {
    const key = `s${index}`;
    series.push({ key, points: toPlaybackPoints(rows, (row) => row.date, (row) => row.marketValue) });
    styles.push({
      key,
      name: labelOf(outcomes[index].exposure),
      color: exposureColor(outcomes[index].exposure),
      filled: true,
    });
  });

  return {
    series,
    styles,
    dates: rowsPerOutcome[0].map((row) => row.date),
    changeRateOf: (key, point) => {
      if (key === CONTRIBUTED_KEY) return null;
      const contributed = contributedAt.get(point.time);
      if (contributed === undefined || contributed <= 0) return null;
      return (point.value - contributed) / contributed;
    },
  };
}

/**
 * 상품 가격 재생 묶음. level은 시작을 1로 정규화한 값이라 수익률이 곧 level - 1이다.
 * 영역은 채우지 않는다 — 여러 노출의 가격이 겹칠 때 채우면 서로를 가린다.
 */
export function buildPricePlayback(
  outcomes: readonly ReadyOutcome[],
  labelOf: ExposureLabeller = exposureLabel,
): PlaybackBundle {
  if (outcomes.length === 0) return EMPTY_BUNDLE;

  const series: PlaybackSeries[] = [];
  const styles: PlaybackSeriesStyle[] = [];

  outcomes.forEach((outcome, index) => {
    const key = `s${index}`;
    const points = outcome.result.portfolioIndex;
    series.push({
      key,
      points: toPlaybackPoints(points, (point) => point.date, (point) => point.level),
    });
    styles.push({ key, name: labelOf(outcome.exposure), color: exposureColor(outcome.exposure) });
  });

  return {
    series,
    styles,
    dates: outcomes[0].result.portfolioIndex.map((point) => point.date),
    // level은 시작을 1로 정규화한 값이라 그 시점 수익률이 곧 value - 1이다. 원금
    // 시리즈가 없는 화면이라 key === CONTRIBUTED_KEY 검사는 실질적으로 항상 false지만,
    // buildAssetPlayback과 같은 방어를 남겨 둔다.
    changeRateOf: (key, point) => (key === CONTRIBUTED_KEY ? null : point.value - 1),
  };
}
