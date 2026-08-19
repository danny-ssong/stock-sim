import type { AccountId } from '../data/types';
import type { SimCalendar } from './calendar';
import { resolveAtYear } from './schedule';
import type { AnchoredSchedule, Ledger, MonthEntry } from './types';

export type LedgerHolding = {
  accountId: AccountId;
  productId: string;
  /** 배분 비중. 전체 합이 1이다 */
  weight: number;
  /** 시뮬 각 일자의 가상 가격 레벨 */
  levels: Float64Array;
  /** 그 일자의 가격이 합성값이면 1 */
  syntheticFlags: Uint8Array;
  dividendYield: number;
  /** 배당에서 원천징수로 빠져나가는 비율 (해외직투 15%, 그 외 0) */
  dividendWithholdingRate: number;
};

/**
 * 납입 상한을 물을 때 넘기는 그 시점까지의 납입 이력.
 *
 * 계좌마다 한도 규칙이 다르다 — ISA는 연 2,000만원과 총 1억원을 동시에 보고,
 * v2의 연금저축·IRP는 연 단위 한도만 본다. 어느 쪽이든 판정할 수 있게
 * 연차별 내역과 전 기간 누계를 함께 넘긴다.
 */
export type ContributionCapRequest = {
  accountId: AccountId;
  yearIndex: number;
  /**
   * 연차 → 그 해 납입액. 진행 중인 연차는 이번 달 납입 직전까지의 누계이고,
   * 지나간 연차는 확정된 총액이다.
   */
  contributedByYear: Readonly<Record<number, number>>;
  /** 전 기간 누계 */
  contributedTotal: number;
};

/**
 * 일별 수익률을 가상 가격 레벨로 누적한다.
 * 1에서 시작하며 절대 수준은 의미가 없고 비율만 쓴다.
 * NaN 수익률은 변동 없음으로 취급해 레벨 전체가 오염되는 것을 막는다.
 */
export function buildLevels(returns: Float64Array): Float64Array {
  const levels = new Float64Array(returns.length);
  let level = 1;

  for (let i = 0; i < returns.length; i += 1) {
    const r = returns[i];
    if (Number.isFinite(r)) level *= 1 + r;
    levels[i] = level;
  }
  return levels;
}

/**
 * 월별 원장을 만든다.
 *
 * 세법을 모른다 — ISA 납입한도는 monthlyCap 콜백으로 주입받고, 세금은
 * 원장을 만든 뒤 엔진이 얹는다. 덕분에 목표금액 역산이 이 함수만 반복
 * 호출하면 되고(§5.7의 성능 근거), 원장 구조가 세금 코드로 새지 않는다.
 */
export function buildLedger(params: {
  calendar: SimCalendar;
  holdings: LedgerHolding[];
  contribution: AnchoredSchedule;
  initialAmount: number;
  fxLevels: Float64Array;
  /** 이번 달 납입 상한. null이면 무제한이다. */
  monthlyCap?: (request: ContributionCapRequest) => number | null;
  /** from 계좌가 그 달 한도에 걸리면 초과분을 즉시 to 계좌로 옮긴다. */
  overflowRouting?: { from: AccountId; to: AccountId };
}): Ledger {
  const {
    calendar,
    holdings,
    contribution,
    initialAmount,
    fxLevels,
    monthlyCap,
    overflowRouting,
  } = params;

  const entries: MonthEntry[] = [];
  const sharesHeld = holdings.map(() => 0);
  const costBasis = holdings.map(() => 0);
  /** 계좌 → (연차 → 그 해 납입액). 연차로 키를 잡으므로 해가 바뀔 때 비울 필요가 없다 */
  const contributedByYear = new Map<AccountId, Record<number, number>>();
  const contributedTotal = new Map<AccountId, number>();

  let syntheticMonths = 0;
  let overflowRouted = 0;

  for (const month of calendar.months) {
    const monthlyTotal =
      resolveAtYear(contribution, month.yearIndex) +
      (month.monthIndex === 0 ? initialAmount : 0);

    // 1차: 각 홀딩의 이번 달 한도·실제 납입액을 먼저 확정하고, from 계좌가
    // 한도에 걸려 못 넣은 몫을 모은다. to 계좌의 실제 납입액에 더하는 건 2차에서
    // 한다 — to 계좌 자신의 한도 판정(1차)이 overflow가 더해지기 전 금액을
    // 기준으로 이뤄져야 순서와 무관하게 결과가 같다.
    const actualByHolding = new Array<number>(holdings.length).fill(0);
    let overflowThisMonth = 0;

    for (let h = 0; h < holdings.length; h += 1) {
      const holding = holdings[h];
      const desired = monthlyTotal * holding.weight;

      const byYear = contributedByYear.get(holding.accountId) ?? {};
      const total = contributedTotal.get(holding.accountId) ?? 0;
      const cap =
        monthlyCap?.({
          accountId: holding.accountId,
          yearIndex: month.yearIndex,
          contributedByYear: byYear,
          contributedTotal: total,
        }) ?? null;
      const actual = cap === null ? desired : Math.min(desired, Math.max(0, cap));
      actualByHolding[h] = actual;

      if (overflowRouting?.from === holding.accountId && actual < desired) {
        overflowThisMonth += desired - actual;
      }
    }

    if (overflowRouting !== undefined && overflowThisMonth > 0) {
      const targetIndex = holdings.findIndex(
        (h) => h.accountId === overflowRouting.to,
      );
      if (targetIndex !== -1) {
        actualByHolding[targetIndex] += overflowThisMonth;
        overflowRouted += overflowThisMonth;
      }
    }

    for (let h = 0; h < holdings.length; h += 1) {
      const holding = holdings[h];
      const actual = actualByHolding[h];

      const byYear = contributedByYear.get(holding.accountId) ?? {};
      const total = contributedTotal.get(holding.accountId) ?? 0;
      contributedByYear.set(holding.accountId, {
        ...byYear,
        [month.yearIndex]: (byYear[month.yearIndex] ?? 0) + actual,
      });
      contributedTotal.set(holding.accountId, total + actual);

      const buyPrice = holding.levels[month.buyOffset];
      const sharesBought = buyPrice > 0 ? actual / buyPrice : 0;

      sharesHeld[h] += sharesBought;
      costBasis[h] += actual;

      const endPrice = holding.levels[month.endOffset];
      const marketValue = sharesHeld[h] * endPrice;

      // 배당은 연 1회 연말에 계상한다. 가격 시계열이 이미 배당 재투자를
      // 반영한 총수익이므로 평가액에 다시 더하지 않는다 (계획 D6).
      // marketValue는 이번 달 배당 반영 전 평가액을 그대로 기록하고,
      // 원천징수로 줄어든 주수는 다음 달 이후 평가액에 자연히 반영된다.
      let dividendReceived = 0;
      if (month.isYearEnd && holding.dividendYield > 0) {
        dividendReceived = marketValue * holding.dividendYield;
        // adjClose는 원천징수 없는 100% 재투자를 가정하므로 그 몫을 되돌린다
        const drag = holding.dividendYield * holding.dividendWithholdingRate;
        sharesHeld[h] *= 1 - drag;
      }

      const isSynthetic = holding.syntheticFlags[month.buyOffset] === 1;
      if (h === 0 && isSynthetic) syntheticMonths += 1;

      entries.push({
        monthIndex: month.monthIndex,
        date: month.buyDate,
        accountId: holding.accountId,
        productId: holding.productId,
        contribution: actual,
        buyPrice,
        sharesBought,
        sharesHeld: sharesHeld[h],
        marketValue,
        costBasis: costBasis[h],
        realizedGain: 0,
        dividendReceived,
        fxRate: fxLevels[month.endOffset],
        isSynthetic,
      });
    }
  }

  return {
    entries,
    syntheticRatio:
      calendar.months.length > 0 ? syntheticMonths / calendar.months.length : 0,
    overflowRouted,
  };
}
