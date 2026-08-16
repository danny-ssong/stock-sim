import { resolveProduct } from '../../data/catalog';
import type { IndexExposure, ProductResolution } from '../../data/types';
import type { TaxConstants } from '../constants';
import {
  calculateComprehensiveTax,
  findCrossoverFinancialIncome,
} from '../comprehensive';
import type {
  AccountYearState,
  ContributionHistory,
  TaxContext,
  TaxBreakdown,
  TaxStrategy,
} from '../types';

/** 최고 구간(45%)에 지방소득세 10%를 얹은 최악 시나리오 세율 */
const WORST_CASE_RATE = 0.495;

const SHARED_NOTES = [
  '매매차익과 분배금 모두 배당소득으로 과세되며 금융소득종합과세 합산 대상입니다',
  '⚠️ 과표기준가 데이터가 없어 실제 매매차익 전액을 과세표준으로 씁니다. 실제 세금은 이보다 낮을 수 있습니다',
  '⚠️ 손익통산이 불가능해 손실 종목이 있어도 이익 종목에는 그대로 과세됩니다',
];

/**
 * 국내상장 해외ETF 일반계좌.
 *
 * 해외직투의 22%는 정액이지만 이쪽의 15.4%는 하한선일 뿐이다.
 * 매도한 해에 매매차익 전액이 배당소득으로 계상되므로, 오래 모아 한 번에 팔면
 * 그 해 금융소득이 최고 구간까지 올라간다(§6.4).
 */
export const domesticEtfStrategy: TaxStrategy = {
  accountId: 'DOMESTIC_ETF',

  contributionLimit(
    _yearIndex: number,
    _history: ContributionHistory,
    _ctx: TaxContext,
  ): number | null {
    return null;
  },

  canHold(exposure: IndexExposure): ProductResolution {
    return resolveProduct('DOMESTIC_ETF', exposure);
  },

  annualTax(state: AccountYearState, ctx: TaxContext): TaxBreakdown {
    const withheldTax = state.dividendIncome * ctx.constants.domesticDividendRate;

    return {
      accountId: 'DOMESTIC_ETF',
      tax: withheldTax,
      financialIncome: state.dividendIncome,
      withheldTax,
      realizedGain: 0,
      costBasisStepUp: 0,
      notes: state.dividendIncome > 0 ? [SHARED_NOTES[0]] : [],
    };
  },

  exitTax(state: AccountYearState, ctx: TaxContext): TaxBreakdown {
    const gain = state.marketValue - state.costBasis;
    // 손익통산이 안 되므로 손실은 0으로 잘라낸다.
    const taxableGain = Math.max(0, gain);
    const withheldTax = taxableGain * ctx.constants.domesticDividendRate;

    return {
      accountId: 'DOMESTIC_ETF',
      tax: withheldTax,
      financialIncome: taxableGain,
      withheldTax,
      realizedGain: gain,
      costBasisStepUp: 0,
      notes: SHARED_NOTES,
    };
  },
};

export type DomesticSaleAnalysis = {
  /** 실제 누진 계산 결과 */
  effectiveRate: number;
  /** 도달한 최고 구간 세율 */
  topBracketReached: number;
  /** 금융소득 귀속 세액 (지방소득세 포함) */
  tax: number;
  /** 전액이 최고구간이라 가정했을 때 (49.5%) */
  worstCaseTax: number;
  /** 분할 매도 시 절감 추정액 */
  splitSaleSaving: number;
  splitYears: number;
  /** 같은 금액을 해외직투로 실현했을 때의 양도소득세 */
  overseasEquivalentTax: number;
  /** 해외직투 실효세율과 역전되는 금융소득 금액 */
  crossoverAmount: number;
};

/**
 * 한 해에 몰아 팔았을 때의 세율 폭발을 정량화한다.
 *
 * 분할 매도 추정은 근로소득이 그 기간 동안 일정하다고 가정한다 —
 * 연봉이 오르면 절감액은 이보다 줄어든다. v1은 추정까지만 다루고
 * 최적 매도 스케줄 탐색은 v2다(§6.4).
 */
export function analyzeDomesticSale(params: {
  capitalGain: number;
  employmentIncome: number;
  taxBaseOverride?: number;
  splitYears?: number;
  constants: TaxConstants;
}): DomesticSaleAnalysis {
  const { capitalGain, employmentIncome, taxBaseOverride, constants } = params;
  const splitYears = params.splitYears ?? 5;

  const taxFor = (amount: number): ReturnType<typeof calculateComprehensiveTax> =>
    calculateComprehensiveTax(
      {
        calendarYear: 0,
        yearIndex: 0,
        employmentIncome,
        taxBaseOverride,
        financialIncome: amount,
        withheldTax: amount * constants.domesticDividendRate,
      },
      constants,
    );

  const lumpSum = taxFor(capitalGain);
  const splitTax = taxFor(capitalGain / splitYears).financialTax * splitYears;

  return {
    effectiveRate: lumpSum.effectiveRate,
    topBracketReached: lumpSum.topBracketReached,
    tax: lumpSum.financialTax,
    worstCaseTax: capitalGain * WORST_CASE_RATE,
    splitSaleSaving: lumpSum.financialTax - splitTax,
    splitYears,
    overseasEquivalentTax:
      Math.max(0, capitalGain - constants.overseasBasicDeduction) *
      constants.overseasCapitalGainsRate,
    crossoverAmount: findCrossoverFinancialIncome({
      employmentIncome,
      taxBaseOverride,
      constants,
    }),
  };
}
