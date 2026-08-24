'use client';

import { useState } from 'react';
import { addMonths } from '../../lib/sim/calendar';
import { useHistoricalDiningRateAutoFill } from '../../hooks/use-historical-dining-rate-auto-fill';
import { DEFAULT_DINING_INFLATION_RATE, FOOD_ITEMS, projectPrice } from '../../lib/inflation/food-basket';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

/**
 * 외식물가상승률은 계산 결과에 영향을 주지 않는 순수 표시용 값이라 URL 상태로
 * 올리지 않고 이 컴포넌트 로컬 상태로 둔다. 슬라이더 기본값은
 * useHistoricalDiningRateAutoFill이 실측 CPI 기준 최근 years년 평균 상승률로
 * 자동 채운다 — 사용자가 슬라이더를 직접 움직이면 그 순간부터 추적을 멈춘다.
 */
export function FoodBasketBadge({ years, startMonth }: { years: number; startMonth: string }) {
  const [annualRate, setAnnualRate] = useState(DEFAULT_DINING_INFLATION_RATE);
  useHistoricalDiningRateAutoFill(FOOD_ITEMS[0].id, years, annualRate, setAnnualRate);

  const targetDate = `${addMonths(startMonth, years * 12)}-01`;

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
        {FOOD_ITEMS.map((item) => (
          <li key={item.id}>
            {item.emoji} {item.name}: 지금 {Math.round(item.basePrice).toLocaleString('ko-KR')}원 → {years}
            년 후 {Math.round(projectPrice(item, targetDate, annualRate)).toLocaleString('ko-KR')}원
          </li>
        ))}
      </ul>
      <p className="text-xs text-zinc-500">상승률은 통계청(ECOS) 실측치, 기준가는 관찰 추정치입니다.</p>
    </div>
  );
}
