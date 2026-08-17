import type { AccountId } from '../data/types';
import type { Ledger, MonthEntry } from './types';

export type ContributionSeriesRow = {
  yearIndex: number;
  /** 계좌 → 그 연도 말 평가액(KRW). 그 연도에 보유하지 않은 계좌는 키 자체가 없다 */
  values: Partial<Record<AccountId, number>>;
};

/**
 * 연말 원장 스냅샷을 계좌별로 합산해 스택 차트가 바로 쓸 수 있는 형태로 낸다.
 * 같은 계좌에 여러 노출이 배분돼도(§4.5) 계좌 단위로 합산된다.
 */
export function buildContributionSeries(
  ledger: Ledger,
  years: number,
): ContributionSeriesRow[] {
  const byMonth = new Map<number, MonthEntry[]>();
  for (const entry of ledger.entries) {
    const bucket = byMonth.get(entry.monthIndex);
    if (bucket === undefined) byMonth.set(entry.monthIndex, [entry]);
    else bucket.push(entry);
  }

  const rows: ContributionSeriesRow[] = [];
  for (let yearIndex = 0; yearIndex < years; yearIndex += 1) {
    const yearEndMonthIndex = (yearIndex + 1) * 12 - 1;
    const entries = byMonth.get(yearEndMonthIndex) ?? [];

    const values: Partial<Record<AccountId, number>> = {};
    for (const entry of entries) {
      values[entry.accountId] = (values[entry.accountId] ?? 0) + entry.marketValue;
    }
    rows.push({ yearIndex, values });
  }
  return rows;
}
