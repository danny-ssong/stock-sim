import type { SimCalendar } from './calendar';
import type { LedgerHolding } from './ledger';
import type { Ledger } from './types';

export type DailyAssetPoint = { date: string; contributed: number; marketValue: number };

/**
 * 자산 평가액을 상품 가격 차트(portfolioIndex, engine.ts)와 같은 일별 해상도로 낸다.
 *
 * 매수는 달마다 한 번뿐이라 보유 좌수(entry.sharesHeld)는 그 달 내내 고정이지만,
 * 평가액(sharesHeld × 그날 가격)은 가격 자체가 매일 움직이므로 보간이 아니라 실제로
 * 매일 다른 값이다 — 월별 스냅샷만 내던 이전 방식으로는 월중 낙폭이 자산 차트에
 * 보이지 않았다(상품 가격 차트에만 보였다).
 *
 * ledger.entries는 calendar.months와 같은 순서로 1:1 대응한다(ledger.ts의
 * buildLedger가 calendar.months를 그대로 순회해 만든다). 그 대응을 이용해 각
 * 일자가 속한 달의 항목에서 sharesHeld·costBasis를 그대로 얹는다 — 새 계산이
 * 아니라 이미 원장에 있는 값을 일별 축에 펼치는 것뿐이라 비용은 O(일수)다.
 *
 * startOffset·오프셋 비교 방식은 engine.ts의 buildPortfolioIndex/buildDailyDrawdown과
 * 같다 — 세 함수 모두 "calendar.dailyDates[i] ↔ holding.levels[startOffset + i]"라는
 * 같은 불변식에 기대고 있다(engine.ts dailyWindowStart 주석 참고).
 */
export function buildDailyAssetSeries(
  calendar: SimCalendar,
  holding: LedgerHolding,
  ledger: Ledger,
): DailyAssetPoint[] {
  const { months, dailyDates } = calendar;
  if (months.length === 0 || ledger.entries.length === 0) return [];

  const startOffset = months[0].buyOffset;
  const points: DailyAssetPoint[] = [];

  let monthCursor = 0;
  for (let i = 0; i < dailyDates.length; i += 1) {
    while (monthCursor < months.length - 1 && startOffset + i > months[monthCursor].endOffset) {
      monthCursor += 1;
    }
    const entry = ledger.entries[monthCursor];
    points.push({
      date: dailyDates[i],
      contributed: entry.costBasis,
      marketValue: entry.sharesHeld * holding.levels[startOffset + i],
    });
  }
  return points;
}
