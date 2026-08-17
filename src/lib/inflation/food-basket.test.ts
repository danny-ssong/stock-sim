import { describe, it, expect } from 'vitest';
import {
  FOOD_ITEMS,
  DEFAULT_DINING_INFLATION_RATE,
  projectPrice,
  convertToItems,
} from './food-basket';

const GUKBAP = FOOD_ITEMS[0];

describe('projectPrice', () => {
  it('기준일과 같은 날짜면 기준가 그대로다', () => {
    expect(projectPrice(GUKBAP, GUKBAP.basePriceDate, 0.035)).toBeCloseTo(
      GUKBAP.basePrice,
      6,
    );
  });

  it('경과년수만큼 복리로 오른다', () => {
    const price = projectPrice(GUKBAP, '2036-08-16', 0.035);
    expect(price).toBeCloseTo(GUKBAP.basePrice * 1.035 ** 10, 2);
  });

  it('상승률 0이면 가격이 변하지 않는다', () => {
    expect(projectPrice(GUKBAP, '2041-08-16', 0)).toBeCloseTo(
      GUKBAP.basePrice,
      6,
    );
  });

  it('기준일보다 이른 날짜는 역산한다', () => {
    const price = projectPrice(GUKBAP, '2016-08-16', 0.035);
    expect(price).toBeLessThan(GUKBAP.basePrice);
    expect(price).toBeCloseTo(GUKBAP.basePrice / 1.035 ** 10, 2);
  });
});

describe('convertToItems', () => {
  it('지금 몇 그릇, 그때 몇 그릇인지 함께 낸다', () => {
    const rows = convertToItems({
      amount: 300_000_000,
      targetDate: '2041-08-16',
      annualRate: 0.035,
    });

    expect(rows).toHaveLength(FOOD_ITEMS.length);
    const gukbap = rows[0];
    expect(gukbap.countNow).toBe(
      Math.floor(300_000_000 / GUKBAP.basePrice),
    );
    expect(gukbap.countThen).toBeLessThan(gukbap.countNow);
    expect(gukbap.priceThen).toBeGreaterThan(GUKBAP.basePrice);
  });

  it('상승률 0이면 지금과 그때의 개수가 같다', () => {
    const rows = convertToItems({
      amount: 10_000_000,
      targetDate: '2041-08-16',
      annualRate: 0,
    });
    for (const row of rows) {
      expect(row.countThen).toBe(row.countNow);
    }
  });

  it('품목을 갈아끼울 수 있다 — 배열이라 추가가 쉽다', () => {
    const rows = convertToItems({
      amount: 100_000,
      targetDate: '2027-08-16',
      annualRate: 0.03,
      items: [
        {
          id: 'coffee',
          name: '아메리카노',
          emoji: '☕',
          basePrice: 5_000,
          basePriceDate: '2026-08-01',
        },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].item.id).toBe('coffee');
  });
});

describe('기본 품목', () => {
  it('국밥·김밥·아메리카노·지하철 4종을 제공한다', () => {
    expect(FOOD_ITEMS.map((i) => i.id)).toEqual([
      'gukbap',
      'gimbap',
      'americano',
      'subway',
    ]);
  });

  it('기본 상승률이 전체 CPI보다 높은 외식물가 수준이다', () => {
    expect(DEFAULT_DINING_INFLATION_RATE).toBeGreaterThan(0.02);
    expect(DEFAULT_DINING_INFLATION_RATE).toBeLessThan(0.06);
  });
});
