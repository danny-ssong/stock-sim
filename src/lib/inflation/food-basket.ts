export type FoodItem = {
  id: string;
  name: string;
  emoji: string;
  /** 2026-08 기준가 (KRW) */
  basePrice: number;
  basePriceDate: string;
  /** ECOS 통계표 901Y009(4.2.1. 소비자물가지수)의 품목코드 — 실측 상승률 계산에 쓴다 */
  cpiItemCode: string;
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
    id: 'gukbap',
    name: '국밥',
    emoji: '🍲',
    basePrice: 10_000,
    basePriceDate: '2026-08-16',
    cpiItemCode: 'K01104',
  },
];

/**
 * 미래 구간 기본 상승률. 과거 10년 외식물가 평균을 근사한 값이며
 * UI에서 슬라이더로 수정할 수 있다. 전체 CPI보다 높아 체감에 가깝다.
 * useHistoricalDiningRateAutoFill이 실측 데이터를 못 불러온 동안의 초기값으로도 쓰인다.
 */
export const DEFAULT_DINING_INFLATION_RATE = 0.035;

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

/** 미래 가격 = 기준가 × (1 + 외식물가상승률)^경과년수 */
export function projectPrice(
  item: FoodItem,
  targetDate: string,
  annualRate: number,
): number {
  return item.basePrice * (1 + annualRate) ** yearsBetween(item.basePriceDate, targetDate);
}
