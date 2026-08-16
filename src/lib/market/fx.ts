import type { FxAssumption } from '../sim/types';

/**
 * 원화 수익률에서 환율 몫을 나눠 현지통화 수익률을 꺼낸다.
 *
 * public/data/<id>.bin은 달러 가격에 환율을 곱해 만든 원화 시계열이라
 * 일별 수익률 안에 주가 몫과 환율 몫이 곱으로 섞여 있다.
 *
 *   1 + r_krw = (1 + r_local) × (1 + r_fx)
 *
 * 사용자가 고른 환율 가정을 씌우려면 먼저 이 곱을 풀어야 한다(계획 D3).
 * 국내 상장 1배 상품도 같은 구조라 같은 식을 쓴다. 국내 합성형 레버리지는
 * 미래 시뮬에서 거부되므로(계획 D2) 여기서 분기할 일이 없다.
 */
export function stripFx(
  krwReturns: Float64Array,
  fxReturns: Float64Array,
): Float64Array {
  const out = new Float64Array(krwReturns.length);

  for (let i = 0; i < out.length; i += 1) {
    const krw = krwReturns[i];
    const fx = fxReturns[i];
    out[i] =
      Number.isFinite(krw) && Number.isFinite(fx) && fx !== -1
        ? (1 + krw) / (1 + fx) - 1
        : Number.NaN;
  }
  return out;
}

/** stripFx의 역함수. 현지통화 수익률에 환율 수익률을 곱해 원화 수익률로 되돌린다. */
export function applyFx(
  localReturns: Float64Array,
  fxReturns: Float64Array,
): Float64Array {
  const out = new Float64Array(localReturns.length);

  for (let i = 0; i < out.length; i += 1) {
    const local = localReturns[i];
    const fx = fxReturns[i];
    out[i] =
      Number.isFinite(local) && Number.isFinite(fx)
        ? (1 + local) * (1 + fx) - 1
        : Number.NaN;
  }
  return out;
}

/**
 * 시뮬 각 일자에 적용할 환율 수익률 배열을 만든다.
 *
 * historicalPath는 상품 수익률과 **같은 경로 인덱스**를 통해 읽는다.
 * 그래야 stripFx와 applyFx가 정확히 상쇄되어 "실제 그랬던 일"이 왜곡 없이 재현된다.
 */
export function buildAssumedFxReturns(params: {
  assumption: FxAssumption;
  historicalFxReturns: Float64Array;
  pathIndices: Int32Array | null;
  totalDays: number;
  daysPerYear: number;
}): Float64Array {
  const { assumption, historicalFxReturns, pathIndices, totalDays, daysPerYear } =
    params;
  const out = new Float64Array(totalDays);

  if (assumption.type === 'historicalPath') {
    if (pathIndices === null) {
      throw new Error(
        'CAGR 모드에는 재생할 환율 경로가 없습니다. 환율 가정을 고정 또는 추세로 바꾸세요.',
      );
    }
    for (let i = 0; i < totalDays; i += 1) {
      out[i] = historicalFxReturns[pathIndices[i]];
    }
    return out;
  }

  if (assumption.type === 'fixed') {
    return out; // Float64Array는 0으로 초기화된다
  }

  const daily = (1 + assumption.annualRate) ** (1 / daysPerYear) - 1;
  out.fill(daily);
  return out;
}

/** 표시용 환율 레벨. 시작 환율에서 가정된 수익률로 복리 누적한다. */
export function buildFxLevels(
  assumedFxReturns: Float64Array,
  startRate: number,
): Float64Array {
  const out = new Float64Array(assumedFxReturns.length);
  let level = startRate;

  for (let i = 0; i < out.length; i += 1) {
    const r = assumedFxReturns[i];
    level = Number.isFinite(r) ? level * (1 + r) : level;
    out[i] = level;
  }
  return out;
}

/** 결과 카드에 항상 노출할 환율 가정 문구(§5.6). */
export function describeFxAssumption(assumption: FxAssumption): string {
  switch (assumption.type) {
    case 'fixed':
      return `환율 ${Math.round(assumption.rate).toLocaleString('ko-KR')}원 고정 가정`;
    case 'historicalPath':
      return '실제 환율 경로 적용';
    case 'drift':
      return `환율 연 ${(assumption.annualRate * 100).toFixed(1)}% 상승 가정`;
  }
}
