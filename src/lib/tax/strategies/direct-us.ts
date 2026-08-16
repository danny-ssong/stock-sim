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
 *
 * - 매매차익: 양도소득세 22%, 연 250만원 기본공제. 분류과세라 종합과세 합산 대상이 아니다
 * - 배당: 미국 원천징수 15% (한미 조세조약). 배당소득은 종합과세 대상이다
 * - 매도 시점에만 과세되므로 미실현으로 오래 끌수록 과세이연 효과가 크다
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
    return resolveProduct('DIRECT_US', exposure);
  },

  annualTax(state: AccountYearState, ctx: TaxContext): TaxBreakdown {
    const { constants, realizationStrategy } = ctx;
    const notes: string[] = [];

    const withheldTax =
      state.dividendIncome * constants.overseasDividendWithholdingRate;
    if (state.dividendIncome > 0) {
      notes.push('해외 배당은 미국에서 15% 원천징수 후 재투자됩니다');
    }

    let realizedGain = 0;
    let costBasisStepUp = 0;

    if (realizationStrategy.type === 'annualDeductionHarvest') {
      const unrealized = state.marketValue - state.costBasis;
      // 미실현손실이면 실현하지 않는다. 공제는 이월되지 않으므로 그 해에 소멸한다.
      realizedGain = Math.min(
        constants.overseasBasicDeduction,
        Math.max(0, unrealized),
      );
      costBasisStepUp = realizedGain;

      if (realizedGain > 0) {
        notes.push(
          `기본공제 범위 내 ${Math.round(realizedGain).toLocaleString('ko-KR')}원을 실현해 취득원가를 올렸습니다 (세금 0원)`,
          ...HARVEST_NOTES,
        );
      }
    }

    return {
      accountId: 'DIRECT_US',
      tax: withheldTax,
      // 양도차익은 분류과세라 합산하지 않는다. 배당만 종합과세 대상이다(§6.4).
      financialIncome: state.dividendIncome,
      withheldTax,
      realizedGain,
      costBasisStepUp,
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
