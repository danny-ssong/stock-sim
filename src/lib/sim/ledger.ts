import type { AccountId } from '../data/types';
import type { SimCalendar } from './calendar';
import { resolveAtYear } from './schedule';
import type { AnchoredSchedule, Ledger, MonthEntry } from './types';

export type LedgerHolding = {
  accountId: AccountId;
  productId: string;
  /** 시뮬 각 일자의 가상 가격 레벨(달러 수익률 기준, §2 "환율 처리 방식 확정") */
  levels: Float64Array;
  /** 그 일자의 가격이 합성값이면 1 */
  syntheticFlags: Uint8Array;
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
 * 월별 원장을 만든다. 계좌가 하나뿐이라 배분 비중·납입 한도·초과분 라우팅
 * 개념이 전부 사라졌다 — 매달 전액을 그 계좌에 넣는다.
 */
export function buildLedger(params: {
  calendar: SimCalendar;
  holding: LedgerHolding;
  contribution: AnchoredSchedule;
  initialAmount: number;
}): Ledger {
  const { calendar, holding, contribution, initialAmount } = params;

  const entries: MonthEntry[] = [];
  let sharesHeld = 0;
  let costBasis = 0;
  let syntheticMonths = 0;

  for (const month of calendar.months) {
    const contributionThisMonth =
      resolveAtYear(contribution, month.yearIndex) +
      (month.monthIndex === 0 ? initialAmount : 0);

    const buyPrice = holding.levels[month.buyOffset];
    const sharesBought = buyPrice > 0 ? contributionThisMonth / buyPrice : 0;
    sharesHeld += sharesBought;
    costBasis += contributionThisMonth;

    const endPrice = holding.levels[month.endOffset];
    const marketValue = sharesHeld * endPrice;
    const isSynthetic = holding.syntheticFlags[month.buyOffset] === 1;
    if (isSynthetic) syntheticMonths += 1;

    entries.push({
      monthIndex: month.monthIndex,
      date: month.buyDate,
      accountId: holding.accountId,
      productId: holding.productId,
      contribution: contributionThisMonth,
      buyPrice,
      sharesBought,
      sharesHeld,
      marketValue,
      costBasis,
      realizedGain: 0,
      isSynthetic,
    });
  }

  return {
    entries,
    syntheticRatio: calendar.months.length > 0 ? syntheticMonths / calendar.months.length : 0,
  };
}
