import { computePrincipalRecovery } from './principal-recovery';
import type { SimulationResult } from './types';

/**
 * 요약 화면이 쓰는 지표를 한 곳에 모은 값. **포맷 문자열은 담지 않는다** —
 * 저장소가 이미 계산(lib/sim)과 표시(components)를 나눠 두었고, 테이블·히어로가
 * 같은 값을 서로 다르게 그려야 하기 때문이다. 표시는 summary-columns.tsx가 맡는다.
 *
 * null은 모두 "그 값을 낼 수 없다"는 뜻이다. maxDrawdown만 0과 null이 다른 뜻인데,
 * 0은 "고점 대비 하락이 없었다"는 사실이고 null은 "잴 대상이 없다"는 부재다.
 */
export type SummaryMetrics = {
  /** result.finalAfterTax 그대로 */
  afterTax: number;
  /** (finalAfterTax - totalContributed) / totalContributed. 납입이 0 이하면 null */
  returnRate: number | null;
  /** 0~1 사이 양수. 하락이 없었으면 0, drawdown 자체가 없으면 null */
  maxDrawdown: number | null;
  /** 전고점 회복 개월. 기간 내 미회복이거나 drawdown이 없으면 null */
  recoveryMonths: number | null;
  /** 원금 회복 개월. 결손이 없었거나 미회복이면 null */
  principalRecoveryMonths: number | null;
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
    recoveryMonths: drawdown === null ? null : drawdown.recoveryMonths,
    principalRecoveryMonths:
      principalRecovery === null ? null : principalRecovery.recoveryMonths,
  };
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
