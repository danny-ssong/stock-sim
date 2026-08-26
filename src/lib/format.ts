/**
 * 원화 금액을 "억"·"만원" 단위로 사람이 읽기 편하게 표시한다.
 * 1억 이상이면 억 단위로 소수 둘째 자리까지, 미만이면 만원 단위 정수로 반올림한다.
 * 스펙 §8 결과 화면 예시("누적 납입 1.82억", "총 세금 4,100만원")를 그대로 따른다.
 *
 * 만원 단위로 먼저 반올림한 뒤 억/만원 분기를 판단한다 — 원 단위로 먼저 판단하면
 * 99,995,000원(반올림하면 1.00억)이 반올림 전 기준으로는 1억 미만이라 "10,000만원"으로
 * 잘못 표시된다(M18).
 */
export function formatKrwHuman(amountKrw: number): string {
  const MANWON = 10_000;
  const EOK_IN_MANWON = 10_000;

  const sign = amountKrw < 0 ? '-' : '';
  const roundedManwon = Math.round(Math.abs(amountKrw) / MANWON);

  if (roundedManwon >= EOK_IN_MANWON) {
    return `${sign}${(roundedManwon / EOK_IN_MANWON).toFixed(2)}억`;
  }
  // 반올림 후 0이면 부호를 제거한다 — -0만원이 나오지 않도록 한다.
  const displaySign = roundedManwon === 0 ? '' : sign;
  return `${displaySign}${roundedManwon.toLocaleString('ko-KR')}만원`;
}
