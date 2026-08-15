import { synthesizeLeveraged, TRADING_DAYS_PER_YEAR } from './synthetic';

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
