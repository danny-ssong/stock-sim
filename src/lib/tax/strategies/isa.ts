import { resolveProduct } from '../../data/catalog';
import type { IndexExposure, ProductResolution } from '../../data/types';
import type {
  AccountYearState,
  ContributionHistory,
  TaxContext,
  TaxBreakdown,
  TaxStrategy,
} from '../types';
import { domesticEtfStrategy } from './domestic-etf';

/**
 * 중개형 ISA (일반형).
 *
 * - 납입한도 연 2,000만원 / 총 1억원. 미사용분은 다음 해로 이월된다
 * - 의무보유 3년. 못 채우면 일반계좌와 동일 과세로 소급한다
 * - 정산은 계좌 내 모든 손익을 통산한 순소득 기준. 200만원까지 비과세,
 *   초과분 9.9% 분리과세 — 금융소득종합과세에서 제외된다
 *
 * 서민형(비과세 400만원)은 소득 요건 확인이 필요해 v1에서는 다루지 않는다(§6.2).
 */
export const isaStrategy: TaxStrategy = {
  accountId: 'ISA',

  contributionLimit(
    yearIndex: number,
    history: ContributionHistory,
    ctx: TaxContext,
  ): number | null {
    const { annualLimit, totalLimit } = ctx.constants.isa;
    // 미사용분 이월 = 경과 연차만큼 연 한도가 누적된다
    const accrued = Math.min(annualLimit * (yearIndex + 1), totalLimit);
    return Math.max(0, accrued - history.total);
  },

  canHold(exposure: IndexExposure): ProductResolution {
    return resolveProduct('ISA', exposure);
  },

  annualTax(_state: AccountYearState, _ctx: TaxContext): TaxBreakdown {
    // 계좌 안에서는 과세가 유예된다. 정산은 해지 시 한 번에 한다.
    return {
      accountId: 'ISA',
      tax: 0,
      financialIncome: 0,
      withheldTax: 0,
      realizedGain: 0,
      costBasisStepUp: 0,
      notes: [],
    };
  },

  exitTax(state: AccountYearState, ctx: TaxContext): TaxBreakdown {
    const { lockupYears, taxFreeIncome, excessRate } = ctx.constants.isa;

    if (state.heldYears < lockupYears) {
      const fallback = domesticEtfStrategy.exitTax(state, ctx);
      const dividendTax =
        state.dividendIncome * ctx.constants.domesticDividendRate;

      return {
        ...fallback,
        accountId: 'ISA',
        tax: fallback.tax + dividendTax,
        financialIncome: fallback.financialIncome + state.dividendIncome,
        withheldTax: fallback.withheldTax + dividendTax,
        notes: [
          `의무보유 ${lockupYears}년을 채우지 못해 일반계좌와 동일하게 과세됩니다`,
          ...fallback.notes,
        ],
      };
    }

    const netIncome =
      state.marketValue - state.costBasis + state.dividendIncome;
    const taxable = Math.max(0, netIncome - taxFreeIncome);
    const tax = taxable * excessRate;

    return {
      accountId: 'ISA',
      tax,
      // 분리과세라 금융소득종합과세에 합산되지 않는다 — ISA의 숨은 장점(§6.4)
      financialIncome: 0,
      withheldTax: tax,
      realizedGain: state.marketValue - state.costBasis,
      costBasisStepUp: 0,
      notes: [
        `계좌 내 모든 손익을 통산한 순소득 ${Math.round(netIncome).toLocaleString('ko-KR')}원 기준입니다`,
        `${taxFreeIncome.toLocaleString('ko-KR')}원까지 비과세, 초과분 ${(excessRate * 100).toFixed(1)}% 분리과세`,
        '금융소득종합과세 합산 대상에서 제외됩니다',
      ],
    };
  },
};
