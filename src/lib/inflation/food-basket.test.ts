import { describe, it, expect } from 'vitest';
import { FOOD_ITEMS, projectPrice } from './food-basket';

const SEOLLEONGTANG = FOOD_ITEMS[0];

describe('projectPrice', () => {
  it('기준일과 같은 날짜면 기준가 그대로다', () => {
    expect(projectPrice(12_000, '2026-08-25', '2026-08-25', 0.035)).toBeCloseTo(12_000, 6);
  });

  it('경과년수만큼 복리로 오른다', () => {
    const price = projectPrice(12_000, '2026-08-25', '2036-08-25', 0.035);
    expect(price).toBeCloseTo(12_000 * 1.035 ** 10, 2);
  });

  it('상승률 0이면 가격이 변하지 않는다', () => {
    expect(projectPrice(12_000, '2026-08-25', '2041-08-25', 0)).toBeCloseTo(12_000, 6);
  });

  it('기준일보다 이른 날짜는 역산한다', () => {
    const price = projectPrice(12_000, '2026-08-25', '2016-08-25', 0.035);
    expect(price).toBeLessThan(12_000);
    expect(price).toBeCloseTo(12_000 / 1.035 ** 10, 2);
  });
});

describe('기본 품목', () => {
  it('설렁탕(개별 메뉴)과 외식비 전체(종합지수) 2종을 제공한다', () => {
    expect(FOOD_ITEMS.map((i) => i.id)).toEqual(['seolleongtang', 'oesikbi']);
  });

  it('각 품목은 실측 상승률 계산용 ECOS 품목코드를 갖는다', () => {
    expect(SEOLLEONGTANG.cpiItemCode).toBe('K01104');
    expect(FOOD_ITEMS[1].cpiItemCode).toBe('K011');
  });

  it('개별 메뉴 품목만 기준가를 갖는다 — 종합지수는 특정 메뉴 가격이 없다', () => {
    expect(SEOLLEONGTANG.basePrice).toBeDefined();
    expect(SEOLLEONGTANG.basePriceDate).toBeDefined();
    expect(FOOD_ITEMS[1].basePrice).toBeUndefined();
    expect(FOOD_ITEMS[1].basePriceDate).toBeUndefined();
  });
});
