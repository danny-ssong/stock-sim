import type { AccountId } from './data/types';

/** 계좌 ID 전체 목록. `Object.keys()`가 항상 `string[]`로 좁혀지는 TS의 한계를
 *  `as` 단언 없이 우회하기 위한 런타임 화이트리스트다(아래 `isAccountId` 참조).
 *  스키마(`url/schema.ts`)·입력 패널(`InputPanel.tsx`)이 계좌 목록이 필요할 때
 *  이 상수를 재사용한다 — 4번째 계좌가 추가돼도 갱신할 곳이 한 곳이 되게 한다(M8). */
export const ALL_ACCOUNT_IDS: readonly AccountId[] = ['DIRECT_US', 'DOMESTIC_ETF', 'ISA'];
const ACCOUNT_ID_SET = new Set<string>(ALL_ACCOUNT_IDS);

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
  const clampedPercent = Math.round(Math.min(1, Math.max(0, nextValue)) * 100);
  const accountIds = Object.keys(weights).filter(isAccountId);
  const others = accountIds.filter((id) => id !== changedId);

  const result: Partial<Record<AccountId, number>> = {
    ...weights,
    [changedId]: clampedPercent / 100,
  };
  if (others.length === 0) return result;

  const remainingPercent = 100 - clampedPercent;
  const othersTotal = others.reduce((sum, id) => sum + (weights[id] ?? 0), 0);

  // 정수 퍼센트로 양자화한다 — 부동소수 비중을 그대로 쓰면 URL 직렬화(정수 %)와
  // 재정규화 과정에서 changedId 값이 미세하게 튄다(최대 잔여법으로 합을
  // 정확히 100으로 맞춘다).
  const shares = others.map((id) => {
    const raw =
      othersTotal <= 0
        ? remainingPercent / others.length
        : ((weights[id] ?? 0) / othersTotal) * remainingPercent;
    return { id, floor: Math.floor(raw), remainder: raw - Math.floor(raw) };
  });

  const allocated = shares.reduce((sum, s) => sum + s.floor, 0);
  let leftover = remainingPercent - allocated;

  const byRemainderDesc = [...shares].sort((a, b) => b.remainder - a.remainder);
  for (const s of byRemainderDesc) {
    if (leftover <= 0) break;
    s.floor += 1;
    leftover -= 1;
  }

  for (const s of shares) {
    result[s.id] = s.floor / 100;
  }

  return result;
}
