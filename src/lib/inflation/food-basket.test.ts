import { describe, it, expect } from 'vitest';
import { FOOD_ITEMS, DEFAULT_DINING_INFLATION_RATE, projectPrice } from './food-basket';

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

describe('기본 품목', () => {
  it('국밥 1종만 제공한다 — 아메리카노는 제거됐다', () => {
    expect(FOOD_ITEMS.map((i) => i.id)).toEqual(['gukbap']);
  });

  it('각 품목은 실측 상승률 계산용 ECOS 품목코드를 갖는다', () => {
    expect(GUKBAP.cpiItemCode).toBe('K01104');
  });

  it('기본 상승률이 전체 CPI보다 높은 외식물가 수준이다', () => {
    expect(DEFAULT_DINING_INFLATION_RATE).toBeGreaterThan(0.02);
    expect(DEFAULT_DINING_INFLATION_RATE).toBeLessThan(0.06);
  });
});
