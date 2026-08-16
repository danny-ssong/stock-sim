/**
 * 연도별 값 스케줄. 기본은 상승률로 자동 증가하되, 특정 해에 값을 고정(anchor)할 수 있다.
 * 고정한 해가 새 기준점이 되어 그 이후는 다시 상승률이 붙는다.
 * 월 납입액과 연 근로소득이 같은 구조를 요구하므로 하나로 뽑았다(§5.4).
 */
export type AnchoredSchedule = {
  /** 0년차 기준값 */
  base: number;
  /** 연 상승률 */
  growthRate: number;
  /** 연차 → 그 해의 값. 이 연도가 새 기준점이 된다 */
  anchors: Record<number, number>;
};

export type { RealizationStrategy } from '../tax/types';
