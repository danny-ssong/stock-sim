import { computePrincipalRecovery, type PrincipalRecoveryResult } from './principal-recovery';
import type { DrawdownResult } from './drawdown';
import type { SimulationResult } from './types';

/**
 * 회복 지표의 세 가지 상태.
 *
 * 개월 수 하나(`number | null`)로는 "떨어진 적이 없어 회복할 것도 없다"(가장 좋은
 * 결과)와 "기간이 끝나도록 못 돌아왔다"(가장 나쁜 결과)가 같은 null이 되어, 화면에서
 * 정반대의 사실이 같은 '—'로 찍힌다. 전고점 회복과 원금 회복이 같은 문제를 갖고
 * 있어 형태를 공유한다 — 두 열이 나란히 서므로 표기 규칙이 갈리면 더 나쁘다.
 *
 * 근거가 되는 날짜·금액은 여기 담지 않는다. 툴팁이 필요할 때 원본(result.drawdown,
 * computePrincipalRecovery)에서 직접 읽는다 — 이 타입은 "어느 상태인가"만 답한다.
 */
export type RecoveryStatus =
  | { kind: 'never-fell' }
  | { kind: 'recovered'; months: number }
  | { kind: 'unrecovered' };

/**
 * 요약 화면이 쓰는 지표를 한 곳에 모은 값. **포맷 문자열은 담지 않는다** —
 * 저장소가 이미 계산(lib/sim)과 표시(components)를 나눠 두었고, 테이블·히어로가
 * 같은 값을 서로 다르게 그려야 하기 때문이다. 표시는 summary-columns.tsx가 맡는다.
 *
 * null은 모두 "그 값을 낼 수 없다"는 부재다. maxDrawdown만 0과 null이 다른 뜻인데,
 * 0은 "고점 대비 하락이 없었다"는 사실이고 null은 "잴 대상이 없다"는 부재다.
 * 회복 지표 둘은 그 구분을 RecoveryStatus가 대신 맡는다.
 */
export type SummaryMetrics = {
  /** result.finalAfterTax 그대로 */
  afterTax: number;
  /** (finalAfterTax - totalContributed) / totalContributed. 납입이 0 이하면 null */
  returnRate: number | null;
  /** 0~1 사이 양수. 하락이 없었으면 0, drawdown 자체가 없으면 null */
  maxDrawdown: number | null;
  /** 전고점 회복. drawdown 자체가 없으면 null */
  peakRecovery: RecoveryStatus | null;
  /** 원금 회복. 원장이 비어 있으면 null */
  principalRecovery: RecoveryStatus | null;
};

/** 값이 클수록 좋은 지표인가, 작을수록 좋은 지표인가. 최우수 셀 강조가 이걸 본다 */
export type MetricDirection = 'higher-better' | 'lower-better';

/**
 * 수익률은 반드시 totalContributed 기준으로 잰다 — 세후 평가액과 나란히 놓을
 * 값이므로 분모가 다른 금액이면 "이 평가액 대비 이 %가 맞나"를 되짚을 수 없다.
 * 숏츠 화면이 쓰던 식과 같은 식이다.
 */
export function buildSummaryMetrics(result: SimulationResult): SummaryMetrics {
  const { finalAfterTax, totalContributed, drawdown } = result;
  const principalRecovery = computePrincipalRecovery(result.ledger.entries);

  return {
    afterTax: finalAfterTax,
    returnRate:
      totalContributed > 0 ? (finalAfterTax - totalContributed) / totalContributed : null,
    maxDrawdown: drawdown === null ? null : drawdown.maxDrawdown,
    peakRecovery: toPeakRecovery(drawdown),
    principalRecovery: toPrincipalRecovery(principalRecovery),
  };
}

/**
 * 원금 회복 결과에서 상태만 뽑는다. 근거(결손액·날짜)는 툴팁이 원본에서 직접 읽으므로
 * 여기서 옮기지 않는다.
 */
function toPrincipalRecovery(result: PrincipalRecoveryResult | null): RecoveryStatus | null {
  if (result === null) return null;

  switch (result.kind) {
    case 'never-underwater':
      return { kind: 'never-fell' };
    case 'recovered':
      return { kind: 'recovered', months: result.months };
    case 'unrecovered':
      return { kind: 'unrecovered' };
  }
}

/**
 * 가격 낙폭을 회복 상태로 옮긴다.
 *
 * maxDrawdown 0이 곧 'never-fell'이다 — computeDrawdown은 낙폭이 0일 때 회복 탐색
 * 자체를 하지 않으므로(drawdown.ts) recoveryMonths가 null인 것이 "회복 못했다"는
 * 뜻이 아니다. 두 경우를 구분하는 조건이 여기 한 군데에만 있게 둔다.
 */
function toPeakRecovery(drawdown: DrawdownResult | null): RecoveryStatus | null {
  if (drawdown === null) return null;
  if (drawdown.maxDrawdown === 0) return { kind: 'never-fell' };
  if (drawdown.recoveryMonths === null) return { kind: 'unrecovered' };
  return { kind: 'recovered', months: drawdown.recoveryMonths };
}

/**
 * 한 열에서 가장 좋은 값을 가진 행들.
 *
 * 유효 후보가 1개 이하면 빈 Set을 돌려준다 — 비교 상대가 없는데 "최우수"를 칠하면
 * 그 값이 좋아서 강조된 것처럼 읽힌다. 동점이면 모두 포함한다.
 */
export function pickBestIndices(
  values: readonly (number | null)[],
  direction: MetricDirection,
): Set<number> {
  const candidates = values.flatMap((value, index) =>
    value === null ? [] : [{ value, index }],
  );
  if (candidates.length < 2) return new Set();

  const isBetter = (a: number, b: number) =>
    direction === 'higher-better' ? a > b : a < b;
  const best = candidates.reduce((acc, candidate) =>
    isBetter(candidate.value, acc.value) ? candidate : acc,
  );

  return new Set(
    candidates.filter((candidate) => candidate.value === best.value).map((c) => c.index),
  );
}
