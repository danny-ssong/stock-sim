export type TaxConstants = {
  /** 해외주식 양도소득세율 (지방소득세 포함) */
  overseasCapitalGainsRate: number;
  /** 해외주식 양도소득 기본공제 — 연 단위 초기화, 이월 불가 */
  overseasBasicDeduction: number;
};

const CONSTANTS_2026: TaxConstants = {
  overseasCapitalGainsRate: 0.22,
  overseasBasicDeduction: 2_500_000,
};

/** 연도별 세법 상수. 법이 바뀌면 그 해 항목을 추가한다. */
export const TAX_CONSTANTS: Record<number, TaxConstants> = {
  2026: CONSTANTS_2026,
};

/**
 * 해당 연도에 적용할 상수를 고른다.
 * 미래 연도는 가장 최근 개정값이 유지된다고 가정한다.
 */
export function getTaxConstants(year: number): TaxConstants {
  const years = Object.keys(TAX_CONSTANTS).map(Number).sort((a, b) => a - b);
  const applicable = years.filter((y) => y <= year);
  const chosen = applicable.length > 0 ? applicable[applicable.length - 1] : years[0];
  return TAX_CONSTANTS[chosen];
}
