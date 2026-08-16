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
  /**
   * 이번 달 납입 상한. null이면 무제한이다.
   * contributedThisYear는 그 해 누적, contributedTotal은 전 기간 누적이다 —
   * ISA는 연 2,000만원과 총 1억원 두 한도를 동시에 봐야 하므로 둘 다 넘긴다.
   */
  monthlyCap?: (
    accountId: AccountId,
    yearIndex: number,
    contributedThisYear: number,
    contributedTotal: number,
  ) => number | null;
}): Ledger {
  const { calendar, holdings, contribution, initialAmount, fxLevels, monthlyCap } =
    params;

  const entries: MonthEntry[] = [];
  const sharesHeld = holdings.map(() => 0);
  const costBasis = holdings.map(() => 0);
  const contributedThisYear = new Map<AccountId, number>();
  const contributedTotal = new Map<AccountId, number>();

  let syntheticMonths = 0;

  for (const month of calendar.months) {
    if (month.monthIndex % 12 === 0) contributedThisYear.clear();

    const monthlyTotal =
      resolveAtYear(contribution, month.yearIndex) +
      (month.monthIndex === 0 ? initialAmount : 0);

    for (let h = 0; h < holdings.length; h += 1) {
      const holding = holdings[h];
      const desired = monthlyTotal * holding.weight;

      const thisYear = contributedThisYear.get(holding.accountId) ?? 0;
      const total = contributedTotal.get(holding.accountId) ?? 0;
      const cap =
        monthlyCap?.(holding.accountId, month.yearIndex, thisYear, total) ?? null;
      const actual = cap === null ? desired : Math.min(desired, Math.max(0, cap));
      contributedThisYear.set(holding.accountId, thisYear + actual);
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
  };
}
