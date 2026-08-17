/**
 * 원화 금액을 "억"·"만원" 단위로 사람이 읽기 편하게 표시한다.
 * 1억 이상이면 억 단위로 소수 둘째 자리까지, 미만이면 만원 단위 정수로 반올림한다.
 * 스펙 §8 결과 화면 예시("누적 납입 1.82억", "총 세금 4,100만원")를 그대로 따른다.
 */
export function formatKrwHuman(amountKrw: number): string {
  const sign = amountKrw < 0 ? '-' : '';
  const abs = Math.abs(amountKrw);
  const EOK = 100_000_000;
  const MANWON = 10_000;

  if (abs >= EOK) {
    return `${sign}${(abs / EOK).toFixed(2)}억`;
  }
  return `${sign}${Math.round(abs / MANWON).toLocaleString('ko-KR')}만원`;
}
