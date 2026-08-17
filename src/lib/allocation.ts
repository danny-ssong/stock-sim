import type { AccountId } from './data/types';

/** 계좌 ID 전체 목록. `Object.keys()`가 항상 `string[]`로 좁혀지는 TS의 한계를
 *  `as` 단언 없이 우회하기 위한 런타임 화이트리스트다(아래 `isAccountId` 참조). */
const ACCOUNT_ID_VALUES: readonly AccountId[] = ['DIRECT_US', 'DOMESTIC_ETF', 'ISA'];
const ACCOUNT_ID_SET = new Set<string>(ACCOUNT_ID_VALUES);

/** 문자열이 AccountId인지 런타임으로 판별하는 타입 가드. `Object.keys(weights)`처럼
 *  `string[]`로만 추론되는 값을 `AccountId[]`로 좁힐 때 `as` 대신 사용한다. */
export function isAccountId(value: string): value is AccountId {
  return ACCOUNT_ID_SET.has(value);
}

/**
 * 계좌 배분 슬라이더의 "합계 100% 강제"를 구현한다.
 *
 * 방금 움직인 슬라이더(changedId) 값은 그대로 확정하고, 나머지 계좌는
 * 서로의 기존 비율을 유지한 채 남은 몫을 나눠 갖는다(계획 D5). 이렇게 해야
 * 사용자가 방금 조작한 슬라이더가 조작 직후 다시 움직이는 것처럼 보이지 않는다.
 *
 * `weights`는 사용자가 실제로 보유한 계좌만 담는 부분 맵이다(예: ISA만 쓰는
 * 사용자는 `{ ISA: 1 }`). 모든 AccountId가 항상 채워져 있다고 가정하지 않는다.
 */
export function redistributeWeights(
  weights: Partial<Record<AccountId, number>>,
  changedId: AccountId,
  nextValue: number,
): Partial<Record<AccountId, number>> {
  const clamped = Math.min(1, Math.max(0, nextValue));
  const accountIds = Object.keys(weights).filter(isAccountId);
  const others = accountIds.filter((id) => id !== changedId);
  const remaining = 1 - clamped;

  const result: Partial<Record<AccountId, number>> = { ...weights, [changedId]: clamped };
  if (others.length === 0) return result;

  const othersTotal = others.reduce((sum, id) => sum + (weights[id] ?? 0), 0);
  if (othersTotal <= 0) {
    const share = remaining / others.length;
    for (const id of others) result[id] = share;
    return result;
  }

  for (const id of others) {
    result[id] = ((weights[id] ?? 0) / othersTotal) * remaining;
  }
  return result;
}
