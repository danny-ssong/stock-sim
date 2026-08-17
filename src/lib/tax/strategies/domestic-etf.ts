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
      /**
       * 분배금 전액이 재투자되어 평가액에 남으므로 그만큼 취득원가를 올린다.
       *
       * 이 계좌는 원장의 dividendWithholdingRate가 0이라(engine.ts) 주수가
       * 줄지 않는다 — 원천징수 15.4%는 세금 쪽에서만 빠지고 분배금은 100%
       * 재투자된 셈이다. 올리지 않으면 매도 시 같은 금액이 매매차익으로 다시
       * 배당소득세를 문다.
       */
      costBasisStepUp: state.dividendIncome,
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
  /** 전액이 최고구간이라 가정했을 때 (constants.ts의 최고 구간·지방소득세율로 도출, 2026년 기준 49.5%) */
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
 * 전액이 최고 소득세 구간이라 가정했을 때의 최악 시나리오 세액.
 *
 * 법정 상수는 `constants.ts`에서만 가져온다는 제약(계획 문서)에 따라
 * 45%·10% 같은 값을 여기 하드코딩하지 않고, 브래킷 목록의 마지막 구간에서
 * 매년 도출한다 — 세율 개정이 있어도 이 함수는 손댈 필요가 없다.
 *
 * `capitalGain * (rate * (1 + localTaxRate))`처럼 세율을 먼저 합성해두면
 * 부동소수점 오차가 생겨(0.45 * 1.1 ≈ 0.49500000000000005) 테스트의
 * 정확 일치(toBe) 단언이 깨진다. `capitalGain * rate * (1 + localTaxRate)`
 * 순서로 계산해야 오차가 상쇄되므로 곱셈 순서를 그대로 유지한다.
 */
function calculateWorstCaseTax(
  capitalGain: number,
  constants: TaxConstants,
): number {
  const { incomeTaxBrackets, localTaxRate } = constants.comprehensive;
  // incomeTaxBrackets는 constants.ts에서 항상 비어있지 않게 구성된다.
  const topBracket = incomeTaxBrackets[incomeTaxBrackets.length - 1];
  return capitalGain * topBracket.rate * (1 + localTaxRate);
}

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
    worstCaseTax: calculateWorstCaseTax(capitalGain, constants),
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
