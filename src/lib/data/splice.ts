export type SplicedSeries = {
  values: Float64Array;
  /** 실제 데이터가 시작되는 인덱스. 이 값보다 작은 인덱스는 합성 구간이다. */
  syntheticBefore: number;
};

/**
 * 실제 데이터의 시작점에 앵커를 두고 합성 수익률로 과거를 역산한다.
 *
 * 앞에서부터 합성값을 쌓아 올리면 실제 데이터와 이어지는 지점에서 단차가 생긴다.
 * 실제 시작점을 고정하고 뒤로 되감으면 이음매가 정확히 맞는다.
 */
export function spliceBackfill(
  actual: Float64Array,
  syntheticReturns: Float64Array,
): SplicedSeries {
  const firstReal = actual.findIndex((v) => Number.isFinite(v));
  if (firstReal === -1) {
    throw new Error('실제 데이터가 없어 백필 기준점을 잡을 수 없습니다');
  }

  const values = new Float64Array(actual.length);
  values.set(actual);

  for (let i = firstReal - 1; i >= 0; i -= 1) {
    const nextValue = values[i + 1];
    const nextReturn = syntheticReturns[i + 1];

    values[i] =
      Number.isFinite(nextValue) &&
      Number.isFinite(nextReturn) &&
      nextReturn !== -1
        ? nextValue / (1 + nextReturn)
        : Number.NaN;
  }

  return { values, syntheticBefore: firstReal };
}
