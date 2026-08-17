import type {
  AccountId,
  IndexExposure,
  ProductResolution,
} from '../data/types';
import type { TaxConstants } from './constants';

/** 해외직투 이익 실현 전략(§6.3). 기본값은 매년 기본공제 한도까지 실현하는 쪽이다. */
export type RealizationStrategy =
  | { type: 'annualDeductionHarvest' }
  | { type: 'holdUntilExit' };

/** 한 계좌·한 시점의 세금 계산 결과. UI가 근거를 그대로 보여줄 수 있게 notes를 함께 낸다. */
export type TaxBreakdown = {
  accountId: AccountId;
  /** 이 단계에서 확정된 세액 (지방소득세 포함) */
  tax: number;
  /** 금융소득종합과세에 합산될 금액. 분류·분리과세면 0 */
  financialIncome: number;
  /** 이미 원천징수된 세액. 종합과세 정산에서 차감된다 */
  withheldTax: number;
  /** 이 단계에서 실현된 손익 */
  realizedGain: number;
  /**
   * 취득원가 조정액. 없으면 0.
   *
   * 두 가지가 여기로 들어온다.
   * 1. 기본공제 소진 전략이 그 해 실현한 이익 (해외직투)
   * 2. 그 해 재투자된 배당 — 가격 시계열이 배당 재투자 총수익이라(계획 D6)
   *    재투자분이 평가액 성장에 그대로 남는다. 취득원가에 얹지 않으면 매도 시
   *    이미 배당소득세를 낸 금액에 매매차익세가 한 번 더 붙는다.
   *
   * 엔진이 이 값을 누적해 다음 해 `AccountYearState.costBasis`와 최종 `exitTax`에
   * 더한다. 계좌마다 재투자 금액이 다르므로(원천징수를 원장이 주수에서 빼는지에
   * 따라 갈린다) 각 전략이 자기 계좌 기준으로 계산한다.
   */
  costBasisStepUp: number;
  /** UI 툴팁용 근거 문구. 가정과 한계를 숨기지 않는다(§13) */
  notes: string[];
};

export type ContributionHistory = {
  /** 연차 → 그 해 실제 납입액 */
  byYear: Record<number, number>;
  total: number;
};

/**
 * 전략에 넘기는 연말 시점 상태.
 * 스펙 §6.1은 원장 전체를 넘기지만, 전략이 실제로 쓰는 값만 좁혀서 넘겨
 * 원장 구조 변경이 세금 코드로 번지지 않게 한다.
 */
export type AccountYearState = {
  yearIndex: number;
  calendarYear: number;
  accountId: AccountId;
  productId: string;
  /** 연말 평가액 */
  marketValue: number;
  /** 연말 취득원가 (그해 step-up 반영 전) */
  costBasis: number;
  /** 그 해 계상된 배당소득 총액 (원천징수 전) */
  dividendIncome: number;
  /** 그 해 매도·이전으로 이미 실현된 손익 */
  realizedGain: number;
  /** 계좌 보유 연차 — ISA 의무보유 판정용 */
  heldYears: number;
  isFinalYear: boolean;
};

export type TaxContext = {
  constants: TaxConstants;
  realizationStrategy: RealizationStrategy;
};

/**
 * 계좌별 과세 전략.
 * v2에서 연금저축·IRP를 붙일 때 이 인터페이스만 구현하면 되고
 * 기존 코드는 건드리지 않는다(§15).
 */
export interface TaxStrategy {
  readonly accountId: AccountId;

  /** 해당 연차의 납입 가능 한도. null이면 무제한 */
  contributionLimit(
    yearIndex: number,
    history: ContributionHistory,
    ctx: TaxContext,
  ): number | null;

  /** 이 계좌에 해당 노출을 담을 수 있는가 */
  canHold(exposure: IndexExposure): ProductResolution;

  /** 보유 중 매년 발생하는 세금 */
  annualTax(state: AccountYearState, ctx: TaxContext): TaxBreakdown;

  /** 최종 매도 시 세금 */
  exitTax(state: AccountYearState, ctx: TaxContext): TaxBreakdown;
}
