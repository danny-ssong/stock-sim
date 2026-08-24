'use client';

import { useState } from 'react';
import { addMonths } from '../../lib/sim/calendar';
import { DEFAULT_DINING_INFLATION_RATE, FOOD_ITEMS } from '../../lib/inflation/food-basket';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

/**
 * 외식물가상승률은 계산 결과(finalAfterTax 등)에 영향을 주지 않는 순수 표시용
 * 값이라 URL 상태로 올리지 않고 이 컴포넌트 로컬 상태로 둔다(§7 — "과거 10년
 * 평균을 기본값으로 제안하되 슬라이더로 수정 가능").
 */
export function FoodBasketBadge({
  finalAfterTax,
  years,
  startMonth,
}: {
  finalAfterTax: number;
  years: number;
  startMonth: string;
}) {
  const [annualRate, setAnnualRate] = useState(DEFAULT_DINING_INFLATION_RATE);
  const targetDate = `${addMonths(startMonth, years * 12)}-01`;

  const rows: { item: { id: string; name: string; emoji: string }; countNow: number; countThen: number }[] = [];

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-4">
      <Label className="flex flex-col gap-1 text-sm">
        외식물가 상승률(%, 미래 구간 가정): {(annualRate * 100).toFixed(1)}
        <Input
          type="range"
          min={0}
          max={10}
          step={0.5}
          value={annualRate * 100}
          onChange={(e) => setAnnualRate(Number(e.target.value) / 100)}
        />
      </Label>
      <ul className="flex flex-col gap-1 text-sm">
        {rows.map(({ item, countNow, countThen }) => (
          <li key={item.id}>
            {item.emoji} {item.name}: 지금 {countNow.toLocaleString('ko-KR')}개 → 그때{' '}
            {countThen.toLocaleString('ko-KR')}개
          </li>
        ))}
      </ul>
    </div>
  );
}
