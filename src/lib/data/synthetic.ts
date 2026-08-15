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
