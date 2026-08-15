import { describe, it, expect } from 'vitest';
import { PRODUCTS, resolveProduct, getProduct, BACKFILL_START } from './catalog';

describe('상품 카탈로그', () => {
  it('모든 상품 id가 고유하다', () => {
    const ids = PRODUCTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('백필 대상은 미국 상장 상품뿐이다', () => {
    const backfillable = PRODUCTS.filter((p) => p.backfillIndex !== null);
    expect(backfillable.every((p) => p.market === 'US')).toBe(true);
  });

  it('SCHD는 백필하지 않는다 — 기초지수가 공개 소스에 없다', () => {
    const schd = getProduct('SCHD');
    expect(schd?.backfillIndex).toBeNull();
  });

  it('국내 상장 상품은 전부 백필하지 않는다', () => {
    const kr = PRODUCTS.filter((p) => p.market === 'KR');
    expect(kr.length).toBeGreaterThan(0);
    expect(kr.every((p) => p.backfillIndex === null)).toBe(true);
  });

  it('데이터 시작일은 1995-01-03이다', () => {
    expect(BACKFILL_START).toBe('1995-01-03');
  });
});

describe('resolveProduct', () => {
  it('해외직투 + 나스닥100 3배 = TQQQ', () => {
    const r = resolveProduct('DIRECT_US', 'NASDAQ100_3X');
    expect(r.available).toBe(true);
    if (r.available) expect(r.product.ticker).toBe('TQQQ');
  });

  it('ISA + 나스닥100 3배 = 국내 상장 없음', () => {
    const r = resolveProduct('ISA', 'NASDAQ100_3X');
    expect(r.available).toBe(false);
    if (!r.available) expect(r.reason).toBe('NOT_LISTED_IN_KR');
  });

  it('ISA + S&P500 2배 = 환헤지형만 존재', () => {
    const r = resolveProduct('ISA', 'SP500_2X');
    expect(r.available).toBe(false);
    if (!r.available) expect(r.reason).toBe('ONLY_HEDGED_IN_KR');
  });

  it('ISA와 국내ETF 계좌는 같은 상품으로 해석된다', () => {
    const isa = resolveProduct('ISA', 'NASDAQ100_1X');
    const dom = resolveProduct('DOMESTIC_ETF', 'NASDAQ100_1X');
    expect(isa.available && dom.available).toBe(true);
    if (isa.available && dom.available) {
      expect(isa.product.id).toBe(dom.product.id);
    }
  });

  it('ISA에서 가능한 노출은 4종이다', () => {
    const all: Array<Parameters<typeof resolveProduct>[1]> = [
      'NASDAQ100_1X', 'NASDAQ100_2X', 'NASDAQ100_3X',
      'SP500_1X', 'SP500_2X', 'SP500_3X', 'US_DIVIDEND_100',
    ];
    const ok = all.filter((e) => resolveProduct('ISA', e).available);
    expect(ok).toEqual([
      'NASDAQ100_1X', 'NASDAQ100_2X', 'SP500_1X', 'US_DIVIDEND_100',
    ]);
  });
});
