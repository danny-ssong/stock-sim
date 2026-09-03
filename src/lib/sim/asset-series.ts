import type { Ledger } from './types';

export type AssetSeriesRow = { date: string; contributed: number; marketValue: number };

/**
 * 원장의 각 월 항목을 "내 자산 추이" 차트가 바로 쓸 수 있는 형태로 낸다.
 * 연말 스냅샷만 뽑던 예전 방식 대신 원장에 있는 모든 월을 그대로 낸다 — 월 단위
 * 해상도는 원장 자체의 해상도이기도 하다(매수는 달마다 한 번뿐이라 평가액을
 * 일별로 늘려 봐야 없는 정보가 생기지 않는다).
 *
 * 그래서 이 차트는 상품 가격 차트(portfolioIndex, 일별)와 x축 해상도가 다르다 —
 * 가격 차트는 월중 저점을 보여줘야 MDD와 맞춰 읽을 수 있어 일별이어야 한다.
 * date는 MonthEntry.date(buyDate, 'YYYY-MM-DD')를 'YYYY-MM'으로 정규화한다.
 */
export function buildAssetSeries(ledger: Ledger): AssetSeriesRow[] {
  let contributed = 0;
  return ledger.entries.map((entry) => {
    contributed += entry.contribution;
    return { date: entry.date.slice(0, 7), contributed, marketValue: entry.marketValue };
  });
}
