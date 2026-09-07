import type { MonthEntry } from './types';

/** 잔고가 누적 원금에 얼마나 모자랐던 한 시점 */
type PrincipalDeficitPoint = {
  monthIndex: number;
  date: string;
  /** costBasis - marketValue. 양수다 */
  deficit: number;
};

/**
 * "내가 넣은 돈이 언제 돌아오는가"의 세 가지 답.
 *
 * 하나의 `number | null`로 접어두면 "한 번도 원금을 밑돈 적이 없다"(가장 좋은 결과)와
 * "기간이 끝나도록 못 돌아왔다"(가장 나쁜 결과)가 같은 null이 되어, 화면에서 정반대
 * 사실이 같은 '—'로 찍힌다. 판별 유니온이라 표시하는 쪽이 세 갈래를 빠뜨릴 수 없다.
 */
export type PrincipalRecoveryResult =
  | {
      kind: 'never-underwater';
      /**
       * 잔고/원금이 가장 낮았던 순간. 1.31이면 최악일 때도 원금의 131%였다는 뜻이다.
       * 원금이 0인 달만 있으면(=비교할 분모가 없으면) null이다.
       *
       * 이 근거가 없으면 화면의 "하회 없음"이 "정말 안 밑돌았나, 계산이 빠진 건가"로
       * 읽힌다 — MDD가 크게 찍힌 상품일수록 그렇다.
       */
      worstCoverage: { ratio: number; date: string } | null;
    }
  | {
      kind: 'recovered';
      worst: PrincipalDeficitPoint;
      recovery: { monthIndex: number; date: string };
      /** worst → recovery 사이의 개월 수. 항상 1 이상이다 */
      months: number;
    }
  | {
      kind: 'unrecovered';
      worst: PrincipalDeficitPoint;
      /** 마지막 달 기준 아직 모자란 금액. 저점에서 일부 회복했다면 worst.deficit보다 작다 */
      remainingDeficit: number;
    };

/**
 * 월 납입액까지 포함한 누적 원금(costBasis) 대비 잔고(marketValue)가 언제 다시
 * 원금을 넘어서는지 구한다. 원장이 비어 있을 때만 null이다.
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

  if (worstDeficit <= 0) {
    return { kind: 'never-underwater', worstCoverage: findWorstCoverage(entries) };
  }

  const worst: PrincipalDeficitPoint = {
    monthIndex: entries[worstIdx].monthIndex,
    date: entries[worstIdx].date,
    deficit: worstDeficit,
  };

  for (let i = worstIdx + 1; i < entries.length; i += 1) {
    if (entries[i].marketValue >= entries[i].costBasis) {
      return {
        kind: 'recovered',
        worst,
        recovery: { monthIndex: entries[i].monthIndex, date: entries[i].date },
        months: entries[i].monthIndex - entries[worstIdx].monthIndex,
      };
    }
  }

  const last = entries[entries.length - 1];
  return { kind: 'unrecovered', worst, remainingDeficit: last.costBasis - last.marketValue };
}

/**
 * 잔고/원금 비율이 가장 낮았던 달. 결손이 한 번도 없었을 때 "얼마나 아슬아슬했나"를
 * 답하는 값이라, 결손액이 아니라 비율로 잰다 — 원금이 계속 커지므로 같은 결손액도
 * 초반과 후반의 의미가 다르다.
 *
 * 원금이 0인 달은 건너뛴다. 비율의 분모가 없어 "가장 낮았다"고 말할 수 없다.
 */
function findWorstCoverage(entries: MonthEntry[]): { ratio: number; date: string } | null {
  let worst: { ratio: number; date: string } | null = null;

  for (const entry of entries) {
    if (entry.costBasis <= 0) continue;
    const ratio = entry.marketValue / entry.costBasis;
    if (worst === null || ratio < worst.ratio) worst = { ratio, date: entry.date };
  }

  return worst;
}
