import type { AccountId } from '../data/types';
import type { TaxStrategy } from './types';
import { directUsStrategy } from './strategies/direct-us';
import { domesticEtfStrategy } from './strategies/domestic-etf';
import { isaStrategy } from './strategies/isa';

/**
 * 계좌별 과세 전략 레지스트리.
 * v2에서 연금저축·IRP를 붙이려면 AccountId에 값을 추가하고 여기에 등록하면 된다.
 */
export const TAX_STRATEGIES: Record<AccountId, TaxStrategy> = {
  DIRECT_US: directUsStrategy,
  DOMESTIC_ETF: domesticEtfStrategy,
  ISA: isaStrategy,
};

export function getTaxStrategy(accountId: AccountId): TaxStrategy {
  return TAX_STRATEGIES[accountId];
}

export type {
  AccountYearState,
  ContributionHistory,
  TaxBreakdown,
  TaxContext,
  TaxStrategy,
} from './types';
export { getTaxConstants, TAX_CONSTANTS } from './constants';
export type { TaxBracket, TaxConstants } from './constants';
export { progressiveTax, topBracketRate } from './brackets';
export { approximateTaxBase, employmentIncomeDeduction } from './income';
export {
  calculateComprehensiveTax,
  findCrossoverFinancialIncome,
} from './comprehensive';
export type {
  ComprehensiveTaxInput,
  ComprehensiveTaxResult,
} from './comprehensive';
export { analyzeDomesticSale } from './strategies/domestic-etf';
export type { DomesticSaleAnalysis } from './strategies/domestic-etf';
