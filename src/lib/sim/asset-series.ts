import type { Ledger } from './types';

export type AssetSeriesRow = { date: string; contributed: number; marketValue: number };

/**
 * 원장의 각 월 항목을 "내 자산 추이" 차트가 바로 쓸 수 있는 형태로 낸다.
 * 상품 가격 차트(portfolioIndex)와 같은 월별 해상도·날짜 라벨을 써야 두 차트가
 * 같은 x축 틱 로직(lib/chart/x-axis.ts)을 공유하며 나란히 정렬된다 — 그래서
 * 연말 스냅샷만 뽑던 예전 방식 대신 원장에 있는 모든 월을 그대로 낸다.
 * date는 MonthEntry.date(buyDate, 'YYYY-MM-DD')를 'YYYY-MM'으로 정규화해
 * portfolioIndex.date와 형식을 맞춘다.
 */
export function buildAssetSeries(ledger: Ledger): AssetSeriesRow[] {
  let contributed = 0;
  return ledger.entries.map((entry) => {
    contributed += entry.contribution;
    return { date: entry.date.slice(0, 7), contributed, marketValue: entry.marketValue };
  });
}
