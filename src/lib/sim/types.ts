import type { AccountId } from '../data/types';

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

/**
 * 미래 환율 가정(§5.6).
 *
 * 주가는 장기 우상향 경향이 있지만 환율은 등락을 반복한다. 과거 환율 경로를
 * 미래에 그대로 재생하면 "원화가 계속 약세로 간다"는 강한 방향성 가정이
 * 숨어 들어가므로, 탭 1의 기본값은 fixed다.
 */
export type FxAssumption =
  | { type: 'fixed'; rate: number }
  | { type: 'historicalPath' }
  | { type: 'drift'; annualRate: number };

/** 수익률 소스(§5.3). 두 모드는 같은 파이프라인을 통과한다. */
export type ReturnSource =
  /** 기본값: 선택한 과거 구간의 일별 수익률 시퀀스를 미래에 순서대로 적용 */
  | { type: 'historicalPath'; from: string; to: string; tileMode: 'repeat' }
  /** 토글: 연 복리 직선 */
  | { type: 'constantCagr'; annualRate: number };

/** 월별 원장의 한 줄. 계좌×상품마다 한 줄씩 생긴다(§5.2). */
export type MonthEntry = {
  monthIndex: number;
  date: string;
  accountId: AccountId;
  productId: string;

  /** 이번 달 실제 납입액 (KRW) */
  contribution: number;
  /** 매수 단가 (KRW 환산 가상 레벨. 절대 수준은 무의미하고 비율만 쓴다) */
  buyPrice: number;
  sharesBought: number;
  sharesHeld: number;
  /** 월말 평가액 (KRW) */
  marketValue: number;
  /** 누적 취득원가 (KRW). 세금의 step-up은 엔진이 따로 관리한다 */
  costBasis: number;
  /** 매도·이전으로 실현된 손익 (KRW). 원장 단계에서는 항상 0이다 */
  realizedGain: number;
  /** 그 달에 계상된 배당 총액 (원천징수 전) */
  dividendReceived: number;

  fxRate: number;
  /** 이 달의 가격이 합성값인지 */
  isSynthetic: boolean;
};

export type Ledger = {
  entries: MonthEntry[];
  /** 합성 구간이 차지하는 비율 → UI 배지에 그대로 쓴다 */
  syntheticRatio: number;
};
