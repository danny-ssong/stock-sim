import type { MonthEntry } from './types';

export type PrincipalRecoveryResult = {
  /** 누적 원금(costBasis) 대비 잔고(marketValue)가 가장 많이 모자랐던 시점 */
  worst: { monthIndex: number; date: string; deficit: number };
  /** worst 이후 잔고가 그 시점의 누적 원금을 다시 넘어선 시점. 시뮬레이션 종료까지
   *  못 넘었으면 null */
  recovery: { monthIndex: number; date: string } | null;
  recoveryMonths: number | null;
};

/**
 * 월 납입액까지 포함한 누적 원금(costBasis) 대비 잔고(marketValue)가 언제 다시
 * 원금을 넘어서는지 구한다.
 *
 * computeDrawdown은 상품 가격 자체의 전고점 회복만 재므로(§8) 납입 시점·금액과
 * 무관하다 — "내가 실제로 넣은 돈이 언제 돌아오는가"는 이 함수가 답한다.
 *
 * costBasis는 납입만 있고 인출이 없어 단조증가한다. 그래서 가격처럼 "전고점"을
 * 따로 추적할 필요 없이, 결손(costBasis - marketValue)이 가장 컸던 시점 하나만
 * 잡아 그 이후 회복 여부를 본다 — 그 시점이 회복하면 그 전의 모든 얕은 결손도
 * 이미 회복했다는 뜻이기 때문이다.
 */
export function computePrincipalRecovery(entries: MonthEntry[]): PrincipalRecoveryResult | null {
  if (entries.length === 0) return null;

  let worstIdx = 0;
  let worstDeficit = entries[0].costBasis - entries[0].marketValue;

  for (let i = 1; i < entries.length; i += 1) {
    const deficit = entries[i].costBasis - entries[i].marketValue;
    if (deficit > worstDeficit) {
      worstDeficit = deficit;
      worstIdx = i;
    }
  }

  if (worstDeficit <= 0) return null;

  let recoveryIdx: number | null = null;
  for (let i = worstIdx + 1; i < entries.length; i += 1) {
    if (entries[i].marketValue >= entries[i].costBasis) {
      recoveryIdx = i;
      break;
    }
  }

  return {
    worst: {
      monthIndex: entries[worstIdx].monthIndex,
      date: entries[worstIdx].date,
      deficit: worstDeficit,
    },
    recovery:
      recoveryIdx === null
        ? null
        : { monthIndex: entries[recoveryIdx].monthIndex, date: entries[recoveryIdx].date },
    recoveryMonths:
      recoveryIdx === null ? null : entries[recoveryIdx].monthIndex - entries[worstIdx].monthIndex,
  };
}
