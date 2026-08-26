'use client';

import { addMonths } from '../../lib/sim/calendar';
import { useHistoricalDiningRate } from '../../hooks/use-historical-dining-rate';
import { FOOD_ITEMS, projectPrice, type FoodItem } from '../../lib/inflation/food-basket';
import type { ReturnSource } from '../../lib/sim/types';

/**
 * 품목 하나의 실측 상승률 행. 품목마다 상승률이 다를 수 있어(설렁탕과 외식비
 * 전체 종합지수는 실측치가 다르다) 훅을 품목별로 따로 호출한다 — FOOD_ITEMS는
 * 모듈 스코프 상수라 배열 길이·순서가 렌더마다 바뀌지 않으므로, 이 컴포넌트를
 * 고정 개수만큼 매핑해 부르는 건 Rules of Hooks를 어기지 않는다.
 */
function DiningItemRow({
  item,
  returnSource,
  years,
  targetDate,
}: {
  item: FoodItem;
  returnSource: ReturnSource;
  years: number;
  targetDate: string;
}) {
  const rate = useHistoricalDiningRate(item.id, returnSource, years);
  if (rate === null) return null;

  if (item.basePrice === undefined || item.basePriceDate === undefined) {
    const periodLabel = returnSource.type === 'historicalPath' ? '해당 기간' : `최근 ${years}년`;
    return (
      <li>
        {item.emoji} {item.name}: {periodLabel} 연평균 {(rate * 100).toFixed(1)}% 상승
      </li>
    );
  }

  const priceThen = projectPrice(item.basePrice, item.basePriceDate, targetDate, rate);
  return (
    <li>
      {item.emoji} {item.name}: {Math.round(item.basePrice).toLocaleString('ko-KR')}원 →{' '}
      {Math.round(priceThen).toLocaleString('ko-KR')}원 ({years}년 후) [연 {(rate * 100).toFixed(1)}%]
    </li>
  );
}

export function FoodBasketBadge({
  years,
  startMonth,
  returnSource,
}: {
  years: number;
  startMonth: string;
  returnSource: ReturnSource;
}) {
  const targetDate = `${addMonths(startMonth, years * 12)}-01`;

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-4">
      <ul className="flex flex-col gap-1 text-sm">
        {FOOD_ITEMS.map((item) => (
          <DiningItemRow key={item.id} item={item} returnSource={returnSource} years={years} targetDate={targetDate} />
        ))}
      </ul>
      <p className="text-xs text-zinc-500">통계청(ECOS) 기반 추정 데이터입니다.</p>
    </div>
  );
}
