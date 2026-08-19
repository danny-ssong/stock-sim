import type { Ledger } from './types';

export type AssetSeriesRow = { yearIndex: number; contributed: number; marketValue: number };

/**
 * 연말 스냅샷을 "내 자산 추이" 차트가 바로 쓸 수 있는 형태로 낸다.
 * 계좌가 하나뿐이라 계좌별 스택(구 buildContributionSeries) 대신
 * 납입 누계·평가액 두 계열이면 충분하다(스펙 §6).
 */
export function buildAssetSeries(ledger: Ledger, years: number): AssetSeriesRow[] {
  const rows: AssetSeriesRow[] = [];
  let contributed = 0;
  let cursor = 0;

  for (let yearIndex = 0; yearIndex < years; yearIndex += 1) {
    const yearEndMonthIndex = (yearIndex + 1) * 12 - 1;
    let marketValue = rows.length > 0 ? rows[rows.length - 1].marketValue : 0;

    while (cursor < ledger.entries.length && ledger.entries[cursor].monthIndex <= yearEndMonthIndex) {
      contributed += ledger.entries[cursor].contribution;
      if (ledger.entries[cursor].monthIndex === yearEndMonthIndex) {
        marketValue = ledger.entries[cursor].marketValue;
      }
      cursor += 1;
    }

    rows.push({ yearIndex, contributed, marketValue });
  }
  return rows;
}
