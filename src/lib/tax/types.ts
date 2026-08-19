import type { AccountId, IndexExposure, ProductResolution } from '../data/types';
import type { TaxConstants } from './constants';

/** 한 계좌·한 시점의 세금 계산 결과. UI가 근거를 그대로 보여줄 수 있게 notes를 함께 낸다. */
export type TaxBreakdown = {
  accountId: AccountId;
  tax: number;
  /** 금융소득종합과세 개념이 사라져 항상 0이지만, 필드 자체는 v2 확장 자리로 남긴다 */
  financialIncome: number;
  withheldTax: number;
  realizedGain: number;
  /** 취득원가 조정액 — 기본공제 소진 전략이 그 해 실현한 이익만큼 */
  costBasisStepUp: number;
  notes: string[];
};

export type ContributionHistory = {
  byYear: Record<number, number>;
  total: number;
};

export type AccountYearState = {
  yearIndex: number;
  calendarYear: number;
  accountId: AccountId;
  productId: string;
  marketValue: number;
  costBasis: number;
  realizedGain: number;
  heldYears: number;
  isFinalYear: boolean;
};

export type TaxContext = {
  constants: TaxConstants;
};

/**
 * 계좌별 과세 전략.
 * v2에서 연금저축·IRP를 붙일 때 이 인터페이스만 구현하면 되고 기존 코드는 건드리지 않는다.
 */
export interface TaxStrategy {
  readonly accountId: AccountId;
  contributionLimit(
    yearIndex: number,
    history: ContributionHistory,
    ctx: TaxContext,
  ): number | null;
  canHold(exposure: IndexExposure): ProductResolution;
  annualTax(state: AccountYearState, ctx: TaxContext): TaxBreakdown;
  exitTax(state: AccountYearState, ctx: TaxContext): TaxBreakdown;
}
