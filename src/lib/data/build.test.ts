import { describe, it, expect } from 'vitest';
import { buildProductSeries } from './build';
import type { Product } from './types';

const N = Number.NaN;

const baseProduct: Product = {
  id: 'TEST',
  ticker: 'TEST',
  displayName: '테스트',
  exposure: 'NASDAQ100_2X',
  listedAt: '1995-01-05',
  expenseRatio: 0.0095,
  leverage: { kind: 'usListed', multiplier: 2 },
  backfillIndex: '^NDX',
  backfillSpread: 0,
};

const axis = ['1995-01-03', '1995-01-04', '1995-01-05', '1995-01-06'];

describe('buildProductSeries', () => {
  it('미국 상품은 환율을 곱해 원화로 환산한다', () => {
    const out = buildProductSeries({
      product: { ...baseProduct, backfillIndex: null, listedAt: '1995-01-03' },
      axis,
      actualUsd: Float64Array.from([10, 10, 10, 10]),
      indexValues: null,
      riskFreeRates: null,
      fxRates: Float64Array.from([800, 800, 900, 900]),
    });
    expect(out.krwValues[0]).toBeCloseTo(8000, 6);
    expect(out.krwValues[2]).toBeCloseTo(9000, 6);
  });

  it('백필 대상이면 상장 이전 구간을 채운다', () => {
    const out = buildProductSeries({
      product: baseProduct,
      axis,
      actualUsd: Float64Array.from([N, N, 100, 110]),
      indexValues: Float64Array.from([100, 100, 100, 100]),
      // 지수가 제자리이고 금리·스프레드가 모두 0이므로 합성 수익률도 0 → 되감아도 100
      riskFreeRates: Float64Array.from([0, 0, 0, 0]),
      fxRates: Float64Array.from([1, 1, 1, 1]),
    });
    expect(out.krwValues[0]).toBeCloseTo(100, 6);
    expect(out.meta.syntheticUntil).toBe('1995-01-04');
  });

  it('백필하지 않으면 상장 이전은 NaN으로 남는다', () => {
    const out = buildProductSeries({
      product: { ...baseProduct, backfillIndex: null },
      axis,
      actualUsd: Float64Array.from([N, N, 100, 110]),
      indexValues: null,
      riskFreeRates: null,
      fxRates: Float64Array.from([1, 1, 1, 1]),
    });
    expect(Number.isNaN(out.krwValues[0])).toBe(true);
    expect(out.meta.syntheticUntil).toBeNull();
    expect(out.meta.availableFrom).toBe('1995-01-05');
  });

  it('백필 대상인데 지수가 없으면 예외를 던진다', () => {
    expect(() =>
      buildProductSeries({
        product: baseProduct,
        axis,
        actualUsd: Float64Array.from([N, N, 100, 110]),
        indexValues: null,
        riskFreeRates: Float64Array.from([0, 0, 0, 0]),
        fxRates: Float64Array.from([1, 1, 1, 1]),
      }),
    ).toThrow(/기준 지수/);
  });

  it('백필 대상인데 금리 데이터가 없으면 예외를 던진다', () => {
    expect(() =>
      buildProductSeries({
        product: baseProduct,
        axis,
        actualUsd: Float64Array.from([N, N, 100, 110]),
        indexValues: Float64Array.from([100, 100, 100, 100]),
        riskFreeRates: null,
        fxRates: Float64Array.from([1, 1, 1, 1]),
      }),
    ).toThrow(/금리/);
  });

  it('거래일 축 내부 결측을 직전 유효값으로 채우고 filledGapDays에 개수를 반영한다', () => {
    // 데이터 소스가 특정 거래일을 누락시키면 상장 이후에도 중간중간 결측이
    // 남을 수 있다. 상장 이전(선행 NaN)은 채우지 않고 상장 이후 중간 결측만
    // 직전 유효값으로 채워야 한다.
    const out = buildProductSeries({
      product: {
        ...baseProduct,
        backfillIndex: null,
        listedAt: '1995-01-03',
      },
      axis,
      // 01-03: 실데이터 / 01-04: 결측 / 01-05, 01-06: 실데이터
      actualUsd: Float64Array.from([100, N, 100, 110]),
      indexValues: null,
      riskFreeRates: null,
      fxRates: Float64Array.from([1, 1, 1, 1]),
    });

    expect(out.krwValues[0]).toBeCloseTo(100, 6);
    expect(out.krwValues[1]).toBeCloseTo(100, 6);
    expect(out.krwValues[2]).toBeCloseTo(100, 6);
    expect(out.krwValues[3]).toBeCloseTo(110, 6);
    expect(out.meta.filledGapDays).toBe(1);
  });

  it('결측이 없으면 filledGapDays가 0이다', () => {
    const out = buildProductSeries({
      product: { ...baseProduct, backfillIndex: null, listedAt: '1995-01-03' },
      axis,
      actualUsd: Float64Array.from([10, 10, 10, 10]),
      indexValues: null,
      riskFreeRates: null,
      fxRates: Float64Array.from([1, 1, 1, 1]),
    });
    expect(out.meta.filledGapDays).toBe(0);
  });
});
