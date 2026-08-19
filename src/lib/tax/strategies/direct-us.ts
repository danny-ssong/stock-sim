import { resolveProduct } from '../../data/catalog';
import type { IndexExposure, ProductResolution } from '../../data/types';
import type {
  AccountYearState,
  ContributionHistory,
  TaxContext,
  TaxBreakdown,
  TaxStrategy,
} from '../types';

const HARVEST_NOTES = [
  '매도-재매수 사이의 가격 변동은 없다고 가정합니다 (당일 재매수)',
  '거래수수료와 매수·매도 호가 스프레드는 계산하지 않습니다',
];

/**
 * 해외주식 직접투자 계좌.
 * 매매차익: 양도소득세 22%, 연 250만원 기본공제. 분류과세라 종합과세와 무관하다.
 * 매도 시점에만 과세되므로 미실현으로 오래 끌수록 과세이연 효과가 크다.
 */
export const directUsStrategy: TaxStrategy = {
  accountId: 'DIRECT_US',

  contributionLimit(
    _yearIndex: number,
    _history: ContributionHistory,
    _ctx: TaxContext,
  ): number | null {
    return null;
  },

  canHold(exposure: IndexExposure): ProductResolution {
    return resolveProduct(exposure);
  },

  annualTax(state: AccountYearState, ctx: TaxContext): TaxBreakdown {
    const { constants } = ctx;

    // 마지막 해는 exitTax가 남은 이익 전체에 공제를 한 번만 적용해 정산한다.
    // 여기서도 소진하면 250만원 공제가 같은 해에 두 번 빠진다.
    if (state.isFinalYear) {
      return {
        accountId: 'DIRECT_US',
        tax: 0,
        financialIncome: 0,
        withheldTax: 0,
        realizedGain: 0,
        costBasisStepUp: 0,
        notes: [],
      };
    }

    const unrealized = state.marketValue - state.costBasis;
    // 공제는 이월되지 않으므로 그 해에 소멸한다. 미실현손실이면 실현하지 않는다.
    const realizedGain = Math.min(
      constants.overseasBasicDeduction,
      Math.max(0, unrealized),
    );

    const notes = realizedGain > 0
      ? [
          `기본공제 범위 내 ${Math.round(realizedGain).toLocaleString('ko-KR')}원을 실현해 취득원가를 올렸습니다 (세금 0원)`,
          ...HARVEST_NOTES,
        ]
      : [];

    return {
      accountId: 'DIRECT_US',
      tax: 0,
      financialIncome: 0,
      withheldTax: 0,
      realizedGain,
      costBasisStepUp: realizedGain,
      notes,
    };
  },

  exitTax(state: AccountYearState, ctx: TaxContext): TaxBreakdown {
    const { constants } = ctx;
    const gain = state.marketValue - state.costBasis;
    const taxable = Math.max(0, gain - constants.overseasBasicDeduction);
    const tax = taxable * constants.overseasCapitalGainsRate;

    const notes = [
      `양도소득세 ${(constants.overseasCapitalGainsRate * 100).toFixed(0)}% 분류과세 — 금액이 커져도 세율이 오르지 않습니다`,
    ];
    if (gain > 0) {
      notes.push(
        `기본공제 ${constants.overseasBasicDeduction.toLocaleString('ko-KR')}원 적용`,
      );
    }

    return {
      accountId: 'DIRECT_US',
      tax,
      financialIncome: 0,
      withheldTax: 0,
      realizedGain: gain,
      costBasisStepUp: 0,
      notes,
    };
  },
};
