export const TRADING_DAYS_PER_YEAR = 252;

/** 가격 시계열을 일별 수익률로 변환한다. 첫 원소는 직전 값이 없으므로 NaN이다. */
export function dailyReturns(values: Float64Array): Float64Array {
  const out = new Float64Array(values.length);
  out[0] = Number.NaN;

  for (let i = 1; i < values.length; i += 1) {
    const prev = values[i - 1];
    const curr = values[i];
    out[i] = Number.isFinite(prev) && Number.isFinite(curr) && prev !== 0
      ? curr / prev - 1
      : Number.NaN;
  }
  return out;
}

/**
 * 레버리지 ETF의 일별 수익률을 합성한다.
 *
 * 레버리지는 일별 복리로 정의되므로 반드시 일별 해상도에서 계산해야 한다.
 * 월별로 계산하면 변동성 끌림이 사라져 결과가 근본적으로 틀린다.
 *
 * annualDrag는 차입비용 + 추적오차 − 배당수익률을 합친 순드래그로,
 * 골든 테스트(Task 9)가 상품별로 캘리브레이션한 값이다.
 */
export function synthesizeLeveraged(
  indexReturns: Float64Array,
  multiplier: number,
  annualDrag: number,
): Float64Array {
  const dailyDrag = annualDrag / TRADING_DAYS_PER_YEAR;
  const out = new Float64Array(indexReturns.length);

  for (let i = 0; i < indexReturns.length; i += 1) {
    const r = indexReturns[i];
    out[i] = Number.isFinite(r) ? multiplier * r - dailyDrag : Number.NaN;
  }
  return out;
}

/**
 * 금리 연동 레버리지 합성.
 *
 * 일별 드래그 = (배율 − 1) × 무위험금리(t) + 스프레드
 *
 * 차입비용은 금리에 비례하고 (배율 − 1)배로 증폭된다.
 * 1995~2026년 미국 금리가 0~17%를 오갔으므로 고정 드래그로는
 * 금리 체제가 바뀌는 구간에서 오차가 크게 벌어진다.
 * 스프레드는 운용보수·배당수익률·추적오차를 흡수한 상수다.
 */
export function synthesizeLeveragedWithRates(
  indexReturns: Float64Array,
  riskFreeRates: Float64Array,
  multiplier: number,
  spread: number,
): Float64Array {
  const out = new Float64Array(indexReturns.length);

  for (let i = 0; i < indexReturns.length; i += 1) {
    const r = indexReturns[i];
    const rate = riskFreeRates[i];
    out[i] =
      Number.isFinite(r) && Number.isFinite(rate)
        ? multiplier * r - ((multiplier - 1) * rate + spread) / TRADING_DAYS_PER_YEAR
        : Number.NaN;
  }
  return out;
}
