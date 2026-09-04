import { scenarioColor } from '../../lib/chart/colors';
import { exposureLabel } from '../../lib/data/labels';
import { toPlaybackPoints, type PlaybackSeries } from '../../lib/playback/timeline';
import { buildAssetSeries } from '../../lib/sim/asset-series';
import type { ExposureOutcome } from '../../lib/sim/compare';
import type { PlaybackSeriesStyle } from './draw-frame';

type ReadyOutcome = Extract<ExposureOutcome, { kind: 'ready' }>;

/** 원금 시리즈의 키. 노출 순번 키(s0, s1…)와 겹치지 않는 이름이면 된다 */
export const CONTRIBUTED_KEY = 'contributed';

/** 정적 차트의 원금 라인과 같은 색이다(CompareResultsView) — 교대할 때 색이 바뀌면 안 된다 */
export const CONTRIBUTED_COLOR = '#71717a';

export type PlaybackBundle = {
  series: PlaybackSeries[];
  styles: PlaybackSeriesStyle[];
  /** 축 라벨 후보를 만들 원본 날짜 목록. 가장 촘촘한 시리즈의 것을 쓴다 */
  dates: string[];
  /** 끝점 라벨에 띄울 수익률. 원금 대비 최종 평가액이다 */
  changeRateOf: (key: string) => number | null;
};

const EMPTY: PlaybackBundle = { series: [], styles: [], dates: [], changeRateOf: () => null };

/**
 * 자산 평가액 재생 묶음. 원금(회색 점선)을 맨 앞에 두어 다른 선들 아래에 깔린다.
 *
 * 원금은 노출과 무관하게 같으므로(납입 계획이 하나뿐이다) 첫 결과에서만 뽑는다 —
 * CompareResultsView의 buildAssetRows와 같은 이유다.
 */
export function buildAssetPlayback(outcomes: readonly ReadyOutcome[]): PlaybackBundle {
  if (outcomes.length === 0) return EMPTY;
  const rowsPerOutcome = outcomes.map((outcome) => buildAssetSeries(outcome.result.ledger));
  const rates = new Map<string, number | null>();

  const contributedPoints = toPlaybackPoints(
    rowsPerOutcome[0],
    (row) => row.date,
    (row) => row.contributed,
  );
  const finalContributed = rowsPerOutcome[0][rowsPerOutcome[0].length - 1]?.contributed ?? 0;

  const series: PlaybackSeries[] = [{ key: CONTRIBUTED_KEY, points: contributedPoints }];
  const styles: PlaybackSeriesStyle[] = [
    { key: CONTRIBUTED_KEY, name: '원금', color: CONTRIBUTED_COLOR, dashed: true },
  ];

  rowsPerOutcome.forEach((rows, index) => {
    const key = `s${index}`;
    series.push({ key, points: toPlaybackPoints(rows, (row) => row.date, (row) => row.marketValue) });
    styles.push({
      key,
      name: exposureLabel(outcomes[index].exposure),
      color: scenarioColor(index),
      filled: true,
    });
    const finalValue = rows[rows.length - 1]?.marketValue ?? 0;
    rates.set(key, finalContributed > 0 ? (finalValue - finalContributed) / finalContributed : null);
  });

  return {
    series,
    styles,
    dates: rowsPerOutcome[0].map((row) => row.date),
    changeRateOf: (key) => rates.get(key) ?? null,
  };
}

/**
 * 상품 가격 재생 묶음. level은 시작을 1로 정규화한 값이라 수익률이 곧 level - 1이다.
 * 영역은 채우지 않는다 — 여러 노출의 가격이 겹칠 때 채우면 서로를 가린다.
 */
export function buildPricePlayback(outcomes: readonly ReadyOutcome[]): PlaybackBundle {
  if (outcomes.length === 0) return EMPTY;
  const rates = new Map<string, number | null>();

  const series: PlaybackSeries[] = [];
  const styles: PlaybackSeriesStyle[] = [];

  outcomes.forEach((outcome, index) => {
    const key = `s${index}`;
    const points = outcome.result.portfolioIndex;
    series.push({
      key,
      points: toPlaybackPoints(points, (point) => point.date, (point) => point.level),
    });
    styles.push({ key, name: exposureLabel(outcome.exposure), color: scenarioColor(index) });
    const finalLevel = points[points.length - 1]?.level ?? 1;
    rates.set(key, finalLevel - 1);
  });

  return {
    series,
    styles,
    dates: outcomes[0].result.portfolioIndex.map((point) => point.date),
    changeRateOf: (key) => rates.get(key) ?? null,
  };
}
