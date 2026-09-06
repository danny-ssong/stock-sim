import type { Ledger } from './types';

export type AssetSeriesRow = { date: string; contributed: number; marketValue: number };

/**
 * 원장의 각 월 항목을 "내 자산 추이" 차트가 바로 쓸 수 있는 형태로 낸다.
 * 연말 스냅샷만 뽑던 예전 방식 대신 원장에 있는 모든 월을 그대로 낸다 — 월 단위
 * 해상도는 원장 자체의 해상도이기도 하다(매수는 달마다 한 번뿐이라 평가액을
 * 일별로 늘려 봐야 없는 정보가 생기지 않는다).
 *
 * x값은 **평가 시점**(entry.endDate, 그 달 마지막 거래일)이다. 매수일(entry.date)을
 * x로 쓰던 예전 방식은 값과 라벨이 한 달 어긋나 있었다 — 원장은 매수일에 사서 그 달
 * 마지막 거래일에 평가하므로(ledger.ts), 첫 행의 평가액은 이미 한 달치 등락을 담고
 * 있는데 x는 매수일이었다. 그래서 차트 왼쪽 끝에서 평가액 선이 원금 선보다 위나
 * 아래에서 시작했다 — 특히 전고점 프리셋처럼 첫 달이 크게 빠지는 구간에서 눈에 띈다.
 *
 * 대신 맨 앞에 매수 시점 행을 하나 붙여 두 선이 "산 순간"에서 함께 출발하게 한다.
 * 그 순간의 평가액은 정의상 그날 넣은 금액과 같다(전액을 매수가에 넣으므로
 * sharesBought × buyPrice = contribution).
 *
 * 부수적으로 x 구간이 상품 가격 차트(portfolioIndex: 첫 매수일~마지막 거래일)와
 * 정확히 같아진다 — 예전에는 자산 차트가 마지막 달 매수일에서 끝나 한 달 짧았다.
 * 두 차트의 해상도는 여전히 다르다(가격은 일별, 자산은 월별).
 */
export function buildAssetSeries(ledger: Ledger): AssetSeriesRow[] {
  const first = ledger.entries[0];
  if (first === undefined) return [];

  const rows: AssetSeriesRow[] = [
    { date: first.date, contributed: first.contribution, marketValue: first.contribution },
  ];

  let contributed = 0;
  for (const entry of ledger.entries) {
    contributed += entry.contribution;
    rows.push({ date: entry.endDate, contributed, marketValue: entry.marketValue });
  }
  return rows;
}
