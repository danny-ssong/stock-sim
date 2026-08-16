import { progressiveTax, topBracketRate } from './brackets';
import { approximateTaxBase } from './income';
import type { TaxConstants } from './constants';

export type ComprehensiveTaxInput = {
  calendarYear: number;
  /** 0-based 경과 연차 */
  yearIndex: number;
  /** 해당 연도 추정 총급여 */
  employmentIncome: number;
  taxBaseOverride?: number;
  /** 계좌들에서 합산된 금융소득 (ISA·해외 양도차익 제외) */
  financialIncome: number;
  /** 이미 원천징수된 세액 (지방소득세 포함) */
  withheldTax: number;
};

export type ComprehensiveTaxResult = {
  /** 기준금액 초과 여부 */
  applicable: boolean;
  /** 비교과세로 채택된 종합소득 산출세액 (근로소득분 포함, 지방소득세 제외) */
  grossTax: number;
  /** 금융소득에 귀속되는 세액 (지방소득세 포함) */
  financialTax: number;
  /** 원천징수분을 넘어 추가로 낼 세액 */
  additionalTax: number;
  /** 금융소득 기준 실효세율 */
  effectiveRate: number;
  /** 도달한 최고 구간 세율 */
  topBracketReached: number;
  method: 'A' | 'B' | 'withholdingOnly';
};

/**
 * 금융소득종합과세.
 *
 * 비교과세는 두 방식으로 계산해 큰 쪽을 쓴다 — 분리과세보다 유리해지는 역전을 막는다.
 *
 *   A = 종합소득세(근로 과세표준 + (금융소득 − 기준금액)) + 기준금액 × 14%
 *   B = 종합소득세(근로 과세표준) + 금융소득 × 14%
 *
 * 14%는 지방소득세를 뺀 세율이다. 15.4%(원천징수율)와 혼용하면 이중 계산이 된다.
 *
 * 산출세액에는 근로소득분이 섞여 있는데 그건 이미 연말정산으로 낸 것이므로,
 * 근로소득만의 산출세액을 빼서 금융소득 귀속분만 남긴다. 이 차감을 빼먹으면
 * 근로소득세까지 금융소득 탓으로 계상된다.
 */
export function calculateComprehensiveTax(
  input: ComprehensiveTaxInput,
  constants: TaxConstants,
): ComprehensiveTaxResult {
  const { threshold, separateRate, localTaxRate, incomeTaxBrackets } =
    constants.comprehensive;

  const salaryTaxBase = approximateTaxBase({
    grossSalary: input.employmentIncome,
    override: input.taxBaseOverride,
    constants,
  });
  const salaryOnlyTax = progressiveTax(salaryTaxBase, incomeTaxBrackets);
  const financialIncome = Math.max(0, input.financialIncome);

  if (financialIncome <= threshold) {
    return {
      applicable: false,
      grossTax: salaryOnlyTax,
      financialTax: input.withheldTax,
      additionalTax: 0,
      effectiveRate:
        financialIncome > 0 ? input.withheldTax / financialIncome : 0,
      topBracketReached: topBracketRate(salaryTaxBase, incomeTaxBrackets),
      method: 'withholdingOnly',
    };
  }

  const combinedBase = salaryTaxBase + (financialIncome - threshold);
  const taxA =
    progressiveTax(combinedBase, incomeTaxBrackets) + threshold * separateRate;
  const taxB = salaryOnlyTax + financialIncome * separateRate;

  const grossTax = Math.max(taxA, taxB);
  const method = taxA >= taxB ? 'A' : 'B';

  const financialTax = (grossTax - salaryOnlyTax) * (1 + localTaxRate);

  return {
    applicable: true,
    grossTax,
    financialTax,
    additionalTax: Math.max(0, financialTax - input.withheldTax),
    effectiveRate: financialTax / financialIncome,
    topBracketReached:
      method === 'A'
        ? topBracketRate(combinedBase, incomeTaxBrackets)
        : topBracketRate(salaryTaxBase, incomeTaxBrackets),
    method,
  };
}

/**
 * 국내상장(누진)과 해외직투(22% 정액)의 실효세율이 역전되는 금융소득 금액.
 *
 * "귀하의 연봉 6,000만원 기준, 매매차익 약 X원을 넘으면 해외직투가 유리합니다"
 * 문구에 쓴다(§6.4). 실효세율이 금액에 대해 단조 증가하므로 이분탐색으로 푼다.
 */
export function findCrossoverFinancialIncome(params: {
  employmentIncome: number;
  taxBaseOverride?: number;
  constants: TaxConstants;
}): number {
  const { employmentIncome, taxBaseOverride, constants } = params;
  const target = constants.overseasCapitalGainsRate;

  const rateAt = (financialIncome: number): number =>
    calculateComprehensiveTax(
      {
        calendarYear: 0,
        yearIndex: 0,
        employmentIncome,
        taxBaseOverride,
        financialIncome,
        withheldTax: financialIncome * constants.domesticDividendRate,
      },
      constants,
    ).effectiveRate;

  let lo = constants.comprehensive.threshold;
  let hi = 10_000_000_000;

  if (rateAt(hi) < target) return Number.POSITIVE_INFINITY;

  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    if (rateAt(mid) < target) lo = mid;
    else hi = mid;
  }

  return (lo + hi) / 2;
}
