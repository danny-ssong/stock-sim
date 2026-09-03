import type { DrawdownResult, PortfolioIndexPoint } from './drawdown';

/** MDD 구간의 한 지점. 날짜는 항상 있고, 실제 달러 가격은 있을 때만 붙는다. */
export type DrawdownMilestone = { date: string; priceUsd: number | null };

export type DrawdownMilestones = {
  peak: DrawdownMilestone;
  trough: DrawdownMilestone;
  /** 시뮬 종료까지 전고점을 못 넘었으면 null */
  recovery: DrawdownMilestone | null;
};

/**
 * MDD의 고점·저점·회복 날짜에 그날의 실제 달러 가격을 붙인다.
 *
 * computeDrawdown은 비율만 보도록 `{date, level}`만 받으므로(drawdown.ts) 달러
 * 가격을 모른다. 두 배열이 같은 일별 축을 공유한다는 사실(engine.ts dailyWindowStart)
 * 덕분에 날짜로 짝지을 수 있어, 가격을 엔진 파이프라인에 끼워 넣는 대신 여기서 합친다 —
 * computeDrawdown을 원화든 달러든 어떤 시계열에도 쓸 수 있는 순수 함수로 남겨 두려는 것이다.
 *
 * 요약 카드가 "-41.8%"의 근거(어느 날 얼마에서 어느 날 얼마로)를 보여주는 데 쓴다.
 * 미래 모드처럼 실제 종가가 없으면 priceUsd가 null이고, 그때는 날짜만 보여주면 된다.
 */
export function buildDrawdownMilestones(
  drawdown: DrawdownResult,
  portfolioIndex: readonly PortfolioIndexPoint[],
): DrawdownMilestones {
  const priceByDate = new Map(portfolioIndex.map((point) => [point.date, point.priceUsd]));
  const at = (date: string): DrawdownMilestone => ({
    date,
    priceUsd: priceByDate.get(date) ?? null,
  });

  return {
    peak: at(drawdown.peak.date),
    trough: at(drawdown.trough.date),
    recovery: drawdown.recovery === null ? null : at(drawdown.recovery.date),
  };
}
