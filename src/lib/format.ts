import type { SimulationInputBase } from './sim/types';

/**
 * 원화 금액을 "억"·"만원" 단위로 사람이 읽기 편하게 표시한다.
 * 1억 이상이면 억 단위로 소수 둘째 자리까지, 미만이면 만원 단위 정수로 반올림한다.
 * 스펙 §8 결과 화면 예시("누적 납입 1.82억", "총 세금 4,100만원")를 그대로 따른다.
 *
 * 만원 단위로 먼저 반올림한 뒤 억/만원 분기를 판단한다 — 원 단위로 먼저 판단하면
 * 99,995,000원(반올림하면 1.00억)이 반올림 전 기준으로는 1억 미만이라 "10,000만원"으로
 * 잘못 표시된다(M18).
 */
/** 달러 가격 표시. 상품 가격은 원화로 환산하지 않고 실제 거래 통화 그대로 보여준다(§6). */
export function formatUsd(amountUsd: number): string {
  return `$${amountUsd.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

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

const MANWON = 10_000;

/**
 * "초기 원금 1.00억, 월 150만원씩 27년 투자" — 납입 계획을 한 줄로.
 *
 * 첫 항목은 **"초기 원금"**이다. 입력 패널의 슬라이더 라벨(InputPanel "초기 원금")과
 * 같은 이름이라, 사용자가 방금 움직인 값이 결과 캡션 어디에 나타나는지 바로 짚인다.
 *
 * 수식어 없는 "원금"은 쓰지 않는다 — 화면 전체에서 누적 납입액(engine.ts
 * totalContributed, 수익률의 분모이자 세후 평가액의 짝)을 뜻하는 자리가 따로 있고,
 * 그쪽은 **"총 원금"**으로 부른다. 두 값이 같은 캡션 안에 나란히 서므로
 * (`초기 원금 1.00억 … · 총 원금 5.92억`) 수식어가 곧 구분자다.
 *
 * 값이 0인 항목은 통째로 뺀다. 거치식(월 납입 0)에서 "월 0만원씩"은 정보가 아니라
 * 잡음이고, 적립식(초기 원금 0)에서 "초기 원금 0원"도 마찬가지다. 둘 다 0이면
 * 기간만 남는다.
 *
 * 숏츠 카드의 부제와 비교 테이블의 캡션이 같은 문장을 쓴다 — 납입 계획은 상품과
 * 무관하므로 어느 화면에서든 한 번만 말하면 된다.
 */
export function formatContributionPlan(base: SimulationInputBase): string {
  const monthlyManwon = Math.round(base.contribution.base / MANWON);
  const schedule =
    monthlyManwon > 0
      ? `월 ${monthlyManwon.toLocaleString('ko-KR')}만원씩 ${base.years}년 투자`
      : `${base.years}년 투자`;

  if (base.initialAmount <= 0) return schedule;
  return `초기 원금 ${formatKrwHuman(base.initialAmount)}, ${schedule}`;
}
