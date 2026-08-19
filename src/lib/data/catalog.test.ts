import { describe, it, expect } from 'vitest';
import {
  PRODUCTS,
  getProduct,
  resolveProduct,
  productIdsForExposures,
  BACKFILL_START,
} from './catalog';
import type { IndexExposure } from './types';

describe('catalog', () => {
  it('미국 상장 6종만 담는다', () => {
    expect(PRODUCTS.map((p) => p.id).sort()).toEqual(
      ['QLD', 'QQQ', 'SPXL', 'SPY', 'SSO', 'TQQQ'].sort(),
    );
  });

  it('노출마다 정확히 하나의 상품을 반환한다', () => {
    const product = getProduct('NASDAQ100_3X');
    expect(product.id).toBe('TQQQ');
  });
});

describe('상품 카탈로그', () => {
  it('모든 상품 id가 고유하다', () => {
    const ids = PRODUCTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('데이터 시작일은 1995-01-03이다', () => {
    expect(BACKFILL_START).toBe('1995-01-03');
  });
});

describe('resolveProduct', () => {
  it('나스닥100 3배 = TQQQ', () => {
    const resolution = resolveProduct('NASDAQ100_3X');
    expect(resolution.available).toBe(true);
    if (resolution.available) expect(resolution.product.ticker).toBe('TQQQ');
  });

  it('모든 노출에 대해 항상 상품을 찾아 반환한다 — v1은 카탈로그가 1:1이라 실패하지 않는다', () => {
    const exposures: IndexExposure[] = [
      'NASDAQ100_1X', 'NASDAQ100_2X', 'NASDAQ100_3X',
      'SP500_1X', 'SP500_2X', 'SP500_3X',
    ];
    for (const exposure of exposures) {
      const resolution = resolveProduct(exposure);
      expect(resolution.available).toBe(true);
      if (resolution.available) expect(resolution.product.exposure).toBe(exposure);
    }
  });
});

describe('productIdsForExposures', () => {
  it('노출 목록을 상품 id로 변환한다', () => {
    const ids = productIdsForExposures(['NASDAQ100_1X', 'NASDAQ100_3X']);
    expect(ids).toEqual(['QQQ', 'TQQQ']);
  });

  it('같은 노출이 중복되면 한 번만 담는다', () => {
    const ids = productIdsForExposures(['NASDAQ100_1X', 'NASDAQ100_1X']);
    expect(ids).toEqual(['QQQ']);
  });
});
