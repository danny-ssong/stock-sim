import { describe, it, expect } from 'vitest';
import {
  PRODUCTS,
  resolveProduct,
  resolveFutureSimulation,
  getProduct,
  BACKFILL_START,
} from './catalog';
import type { Product } from './types';

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

describe('배당수익률 추정치', () => {
  it('모든 상품이 dividendYield를 갖고 0 이상 10% 이하다', () => {
    for (const product of PRODUCTS) {
      expect(product.dividendYield).toBeGreaterThanOrEqual(0);
      expect(product.dividendYield).toBeLessThanOrEqual(0.1);
    }
  });

  it('배당 100 상품(US_DIVIDEND_100)만 유의미한 배당수익률을 갖는다', () => {
    const dividendProducts = PRODUCTS.filter((p) => p.exposure === 'US_DIVIDEND_100');
    expect(dividendProducts).toHaveLength(2);
    for (const product of dividendProducts) {
      expect(product.dividendYield).toBeGreaterThan(0.02);
    }
  });

  it('그 외 9개 상품은 배당을 계산에 반영하지 않는다 — 영향이 무시할 수준이라 0으로 둔다', () => {
    const nonDividendProducts = PRODUCTS.filter(
      (p) => p.exposure !== 'US_DIVIDEND_100',
    );
    expect(nonDividendProducts).toHaveLength(9);
    for (const product of nonDividendProducts) {
      expect(product.dividendYield).toBe(0);
    }
  });
});

describe('resolveFutureSimulation', () => {
  it('국내 합성형 레버리지는 미래 시뮬을 거부하고 미국 상장 대안을 제시한다', () => {
    const tiger = PRODUCTS.find((p) => p.id === 'TIGER_NASDAQ100_2X');
    expect(tiger).toBeDefined();
    if (!tiger) return;

    const resolution = resolveFutureSimulation(tiger);
    expect(resolution.allowed).toBe(false);
    if (resolution.allowed) return;

    expect(resolution.reason).toBe('FX_MODEL_UNCONFIRMED');
    expect(resolution.message).toContain('환율 반영 공식');
    expect(resolution.alternative).toEqual({
      accountId: 'DIRECT_US',
      exposure: 'NASDAQ100_2X',
      productId: 'QLD',
    });
  });

  it('국내 상장 1배 상품은 허용한다 — 환율이 곱셈으로 분리된다', () => {
    const tiger = PRODUCTS.find((p) => p.id === 'TIGER_NASDAQ100');
    expect(tiger).toBeDefined();
    if (!tiger) return;
    expect(resolveFutureSimulation(tiger).allowed).toBe(true);
  });

  it('미국 상장 레버리지는 허용한다', () => {
    const qld = PRODUCTS.find((p) => p.id === 'QLD');
    expect(qld).toBeDefined();
    if (!qld) return;
    expect(resolveFutureSimulation(qld).allowed).toBe(true);
  });

  it('US 대안이 없으면 alternative가 null이다', () => {
    // 현재 카탈로그의 krSynthetic 상품(TIGER_NASDAQ100_2X)은 우연히 QLD라는
    // 미국 상장 대안을 갖고 있어, 실제 PRODUCTS 조합만으로는 alternative: null
    // 분기를 지나갈 수 없다. 이 분기는 "미국 상장 대안이 없는 국내 합성형
    // 상품이 나중에 추가되는 경우"를 방어하는 코드이므로, resolveFutureSimulation의
    // 선택적 두 번째 매개변수(products)에 QLD를 뺀 카탈로그를 주입해 검증한다.
    // exposure는 실제 IndexExposure 값(NASDAQ100_2X)을 그대로 쓰고, 검색 대상
    // 목록에서만 US 대안을 제거하므로 가짜 유니온 값이나 전역 PRODUCTS 변형이 없다.
    const krProduct: Product = {
      id: 'HYPOTHETICAL_KR_SYNTHETIC',
      ticker: '000000.KS',
      displayName: '가상 국내 합성형 상품(테스트 전용)',
      exposure: 'NASDAQ100_2X',
      market: 'KR',
      listedAt: '2024-01-01',
      expenseRatio: 0.003,
      leverage: { kind: 'krSynthetic', multiplier: 2 },
      hedged: false,
      backfillIndex: null,
      backfillSpread: 0,
      dividendYield: 0,
    };
    const catalogWithoutUsAlternative = PRODUCTS.filter((p) => p.id !== 'QLD');

    const resolution = resolveFutureSimulation(krProduct, catalogWithoutUsAlternative);
    expect(resolution.allowed).toBe(false);
    if (resolution.allowed) return;

    expect(resolution.alternative).toBeNull();
  });
});
