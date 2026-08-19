/**
 * 원화 수익률에서 환율 몫을 나눠 현지통화(달러) 수익률을 꺼낸다.
 *
 * public/data/<id>.bin은 달러 가격에 환율을 곱해 만든 원화 시계열이라
 * 일별 수익률 안에 주가 몫과 환율 몫이 곱으로 섞여 있다.
 *
 *   1 + r_krw = (1 + r_local) × (1 + r_fx)
 *
 * 이 피벗 이후에는 꺼낸 달러 수익률을 원화 원금에 그대로 곱한다(환율을 다시
 * 씌우지 않는다) — "원화 원금이 달러 수익률만큼 성장한다"는 이번 피벗의
 * 확정된 가정이다(스펙 §2 "환율 처리 방식 확정").
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
