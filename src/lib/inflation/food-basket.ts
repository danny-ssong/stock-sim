export type FoodItem = {
  id: string;
  name: string;
  emoji: string;
  /** ECOS 통계표 901Y009(4.2.1. 소비자물가지수)의 품목코드 — 실측 상승률 계산에 쓴다 */
  cpiItemCode: string;
  /**
   * 개별 메뉴 품목만 갖는다(예: 설렁탕). basePrice/basePriceDate가 둘 다 있어야
   * projectPrice로 "지금 X원 → 나중 Y원"을 계산할 수 있다. 음식 서비스 종합지수처럼
   * 특정 메뉴 가격이 없는 품목은 이 필드를 비워 상승률만 표시한다(FoodBasketBadge 참고).
   */
  basePrice?: number;
  basePriceDate?: string;
};

/**
 * 기본 품목.
 *
 * ⚠️ basePrice는 여전히 미검증 관찰 추정치다 — ECOS는 절대 원화 가격이 아니라
 * 지수(2020=100)만 제공하므로 기준가 자체는 실측으로 대체할 수 없다. 대신
 * cpiItemCode로 얻는 상승률은 실측이다(computeHistoricalDiningRate 참고).
 * "국밥"과 정확히 같은 품목은 없어 가장 근접한 개별 품목인 설렁탕(K01104)을 쓴다.
 * 배열이라 품목 추가가 쉽다.
 */
export const FOOD_ITEMS: readonly FoodItem[] = [
  {
    id: 'seolleongtang',
    name: '설렁탕',
    emoji: '🍲',
    cpiItemCode: 'K01104',
    basePrice: 12_000,
    basePriceDate: '2026-08-25',
  },
  {
    id: 'oesikbi',
    name: '외식비 전체',
    emoji: '🍽️',
    cpiItemCode: 'K011',
    // 음식 서비스 종합지수라 특정 메뉴 가격이 없다 — basePrice 없이 상승률만 표시한다.
  },
];

/**
 * 두 날짜 사이의 경과년수를 소수로 구한다.
 *
 * 단순히 ms 차이를 평균 연 길이(365.2425일)로 나누면 윤년 배치에 따라
 * "정확히 N년" 뒤 날짜인데도 오차가 수 KRW~수십 KRW씩 생긴다(복리라 배율로 증폭됨).
 * 대신 시작일의 월/일을 기준점(anchor)으로 삼아 정수년을 먼저 구하고,
 * 남은 구간만 그 구간의 실제 길이로 나눠 소수부를 계산한다.
 * 월/일이 같은 두 날짜(예: 기준일과 10년 뒤 같은 날)는 오차 없이 정확히 정수가 된다.
 */
function yearsBetween(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);

  const startYear = start.getUTCFullYear();
  const startMonth = start.getUTCMonth();
  const startDate = start.getUTCDate();
  const anchorForYears = (yearsElapsed: number) =>
    new Date(Date.UTC(startYear + yearsElapsed, startMonth, startDate));

  let years = end.getUTCFullYear() - startYear;
  if (end.getTime() < anchorForYears(years).getTime()) {
    years -= 1;
  }

  const anchorStart = anchorForYears(years);
  const anchorEnd = anchorForYears(years + 1);
  const fraction =
    (end.getTime() - anchorStart.getTime()) /
    (anchorEnd.getTime() - anchorStart.getTime());

  return years + fraction;
}

/**
 * 미래 가격 = 기준가 × (1 + 외식물가상승률)^경과년수.
 * basePrice/basePriceDate가 있는 품목에만 호출할 수 있다(FoodItem 타입 참고) —
 * 종합지수처럼 가격이 없는 품목은 호출부에서 걸러낸다(FoodBasketBadge 참고).
 */
export function projectPrice(
  basePrice: number,
  basePriceDate: string,
  targetDate: string,
  annualRate: number,
): number {
  return basePrice * (1 + annualRate) ** yearsBetween(basePriceDate, targetDate);
}
