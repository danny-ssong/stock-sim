import {
  synthesizeLeveraged,
  synthesizeLeveragedWithRates,
  TRADING_DAYS_PER_YEAR,
} from './synthetic';

/** 유효 구간의 연평균 성장률. tradingDays는 첫 값에서 마지막 값까지의 거래일 수다. */
export function cagr(values: Float64Array, tradingDays: number): number {
  const first = values[0];
  const last = values[values.length - 1];
  const years = tradingDays / TRADING_DAYS_PER_YEAR;
  if (!Number.isFinite(first) || !Number.isFinite(last) || first <= 0) {
    return Number.NaN;
  }
  return (last / first) ** (1 / years) - 1;
}

/**
 * 표준편차 — NaN은 건너뛴다.
 * 배율을 잘못 넣는 실수는 CAGR보다 변동성에 훨씬 뚜렷하게 나타나므로,
 * 골든 테스트가 이를 잡아내는 데 쓴다(예: 3배 상품에 2배를 넣으면
 * 변동성이 실제의 약 2/3로 줄어든다).
 */
export function stdev(values: Float64Array): number {
  const finite: number[] = [];
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i];
    if (Number.isFinite(v)) finite.push(v);
  }
  if (finite.length === 0) return Number.NaN;

  const mean = finite.reduce((sum, v) => sum + v, 0) / finite.length;
  const variance =
    finite.reduce((sum, v) => sum + (v - mean) ** 2, 0) / finite.length;
  return Math.sqrt(variance);
}

/** 일별 수익률을 누적 배수로 접는다. NaN은 건너뛴다. */
export function compoundReturns(returns: Float64Array): number {
  let acc = 1;
  for (let i = 0; i < returns.length; i += 1) {
    const r = returns[i];
    if (!Number.isFinite(r)) continue;
    acc *= 1 + r;
    if (acc <= 0) return 0;
  }
  return acc;
}

/**
 * 실제 ETF를 가장 잘 재현하는 연간 순드래그를 이분탐색으로 찾는다.
 *
 * 드래그가 커질수록 합성 CAGR은 단조 감소하므로 이분탐색이 수렴한다.
 * 반환하는 errorCagr는 합성 CAGR − 실제 CAGR이다.
 */
export function calibrateDrag(
  indexReturns: Float64Array,
  actualValues: Float64Array,
  multiplier: number,
): { drag: number; errorCagr: number } {
  const span = actualValues.length - 1;
  const targetCagr = cagr(actualValues, span);

  const syntheticCagr = (drag: number): number => {
    const synth = synthesizeLeveraged(indexReturns, multiplier, drag);
    const growth = compoundReturns(synth);
    if (growth <= 0) return Number.NEGATIVE_INFINITY;
    return growth ** (TRADING_DAYS_PER_YEAR / span) - 1;
  };

  let lo = -0.05; // 배당이 비용을 넘어서면 음수 드래그가 나올 수 있다
  let hi = 0.20;

  for (let i = 0; i < 80; i += 1) {
    const mid = (lo + hi) / 2;
    if (syntheticCagr(mid) > targetCagr) lo = mid;
    else hi = mid;
  }

  const drag = (lo + hi) / 2;
  return { drag, errorCagr: syntheticCagr(drag) - targetCagr };
}

/**
 * 금리 연동 모델로 실제 ETF를 가장 잘 재현하는 연간 스프레드를 이분탐색으로 찾는다.
 *
 * 차입비용은 (배율 − 1) × 금리로 이미 반영되므로, 여기서 찾는 스프레드는
 * 운용보수 + 추적오차 − 배당수익률만 남은 잔차 성분이다.
 * 스프레드가 커질수록 합성 CAGR은 단조 감소하므로 이분탐색이 수렴한다.
 * 반환하는 errorCagr는 합성 CAGR − 실제 CAGR이다.
 */
export function calibrateSpread(
  indexReturns: Float64Array,
  riskFreeRates: Float64Array,
  actualValues: Float64Array,
  multiplier: number,
): { spread: number; errorCagr: number } {
  const span = actualValues.length - 1;
  const targetCagr = cagr(actualValues, span);

  const syntheticCagr = (spread: number): number => {
    const synth = synthesizeLeveragedWithRates(
      indexReturns,
      riskFreeRates,
      multiplier,
      spread,
    );
    const growth = compoundReturns(synth);
    if (growth <= 0) return Number.NEGATIVE_INFINITY;
    return growth ** (TRADING_DAYS_PER_YEAR / span) - 1;
  };

  let lo = -0.05; // 배당이 비용을 넘어서면 음수 스프레드가 나올 수 있다
  let hi = 0.20;

  for (let i = 0; i < 80; i += 1) {
    const mid = (lo + hi) / 2;
    if (syntheticCagr(mid) > targetCagr) lo = mid;
    else hi = mid;
  }

  const spread = (lo + hi) / 2;
  return { spread, errorCagr: syntheticCagr(spread) - targetCagr };
}

/**
 * 표본 외 검증 — 겹침 구간을 반으로 나눠 앞에서 구한 스프레드를 뒤에 적용한다.
 *
 * calibrateSpread는 정의상 오차를 0으로 만들므로 그 자체로는 검증이 되지 않는다
 * (전체 구간에 대해 CAGR이 정확히 일치하는 스프레드를 역산하는 것이 알고리즘의 목적이기 때문).
 * 전반부에서 얻은 스프레드가 후반부에서도 통하는지가 공식의 구조적 타당성을 보여주는 진짜 시험이다.
 * 고정 드래그 모델(calibrateDrag)과 달리 금리를 별도로 반영하므로, 금리 체제가
 * 바뀌는 구간에서도 표본 외 오차가 작게 유지되어야 공식이 타당하다고 볼 수 있다.
 */
export function validateOutOfSample(
  indexReturns: Float64Array,
  riskFreeRates: Float64Array,
  actualValues: Float64Array,
  multiplier: number,
): { calibrationSpread: number; holdoutErrorCagr: number } {
  const mid = Math.floor(actualValues.length / 2);

  const { spread } = calibrateSpread(
    indexReturns.slice(0, mid),
    riskFreeRates.slice(0, mid),
    actualValues.slice(0, mid),
    multiplier,
  );

  // 후반부: 값은 mid부터, 수익률·금리는 mid+1부터 (mid→mid+1 이후의 변화분)
  const holdoutActual = actualValues.slice(mid);
  const holdoutReturns = indexReturns.slice(mid + 1);
  const holdoutRates = riskFreeRates.slice(mid + 1);
  const span = holdoutActual.length - 1;

  const synth = synthesizeLeveragedWithRates(
    holdoutReturns,
    holdoutRates,
    multiplier,
    spread,
  );
  const growth = compoundReturns(synth);
  const synthCagr =
    growth <= 0 ? Number.NEGATIVE_INFINITY : growth ** (TRADING_DAYS_PER_YEAR / span) - 1;

  return {
    calibrationSpread: spread,
    holdoutErrorCagr: synthCagr - cagr(holdoutActual, span),
  };
}
