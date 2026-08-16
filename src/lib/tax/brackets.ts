import type { TaxBracket } from './constants';

function findBracket(taxBase: number, brackets: TaxBracket[]): TaxBracket {
  const found = brackets.find((b) => taxBase <= b.upTo);
  return found ?? brackets[brackets.length - 1];
}

/**
 * 누진공제 방식으로 산출세액을 구한다.
 *
 *   산출세액 = 과세표준 × 세율 − 누진공제
 *
 * 구간별 적분과 수학적으로 동치이며, 테스트가 8개 구간 경계에서 이를 단언한다.
 */
export function progressiveTax(taxBase: number, brackets: TaxBracket[]): number {
  if (taxBase <= 0) return 0;
  const bracket = findBracket(taxBase, brackets);
  return Math.max(0, taxBase * bracket.rate - bracket.deduction);
}

/** 도달한 최고 구간의 세율. 결과 화면의 "도달 구간" 표시에 쓴다(§6.4). */
export function topBracketRate(taxBase: number, brackets: TaxBracket[]): number {
  if (taxBase <= 0) return brackets[0].rate;
  return findBracket(taxBase, brackets).rate;
}
