import type { TaxConstants } from './constants';

/**
 * 근로소득공제액.
 *
 * employmentDeductionBrackets의 deduction은 구간 하한에서의 누적 공제액이고,
 * rate는 그 구간 초과분에 붙는 공제율이다 (누진세율 테이블과 의미가 다르다).
 * 한도 2,000만원을 넘지 않는다.
 */
export function employmentIncomeDeduction(
  grossSalary: number,
  constants: TaxConstants,
): number {
  if (grossSalary <= 0) return 0;

  const brackets = constants.comprehensive.employmentDeductionBrackets;
  let lower = 0;

  for (const bracket of brackets) {
    if (grossSalary <= bracket.upTo) {
      const raw = bracket.deduction + (grossSalary - lower) * bracket.rate;
      return Math.min(raw, constants.comprehensive.employmentDeductionCap);
    }
    lower = bracket.upTo;
  }

  return constants.comprehensive.employmentDeductionCap;
}

/**
 * 근사 과세표준.
 *
 *   총급여 − 근로소득공제 = 근로소득금액
 *   근로소득금액 − 기본공제 150만원 = 근사 과세표준
 *
 * ⚠️ 부양가족·연금저축·보험료·의료비 공제를 반영하지 않는다. 실제 과세표준은
 * 이보다 낮으므로 종합과세 세액이 보수적(과대)으로 추정된다. UI 툴팁에 명시한다(§13).
 * 정확한 값을 아는 사용자는 override로 직접 넣는다.
 */
export function approximateTaxBase(params: {
  grossSalary: number;
  override?: number;
  constants: TaxConstants;
}): number {
  const { grossSalary, override, constants } = params;

  if (override !== undefined) return Math.max(0, override);

  const deduction = employmentIncomeDeduction(grossSalary, constants);
  return Math.max(
    0,
    grossSalary - deduction - constants.comprehensive.basicDeduction,
  );
}
