import type { AccountId } from '../data/types';
import type { TaxStrategy } from './types';
import { directUsStrategy } from './strategies/direct-us';

/**
 * 계좌별 과세 전략 레지스트리.
 * v2에서 연금저축·IRP를 붙이려면 AccountId에 값을 추가하고 여기에 등록하면 된다.
 */
export const TAX_STRATEGIES: Record<AccountId, TaxStrategy> = {
  DIRECT_US: directUsStrategy,
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
export type { TaxConstants } from './constants';
