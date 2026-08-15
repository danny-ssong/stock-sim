import type { IndexExposure, Market, Product } from './types';
import { dailyReturns, synthesizeLeveragedWithRates } from './synthetic';
import { spliceBackfill } from './splice';
import { forwardFillGaps } from './align';

export type ProductMeta = {
  id: string;
  ticker: string;
  displayName: string;
  exposure: IndexExposure;
  market: Market;
  listedAt: string;
  expenseRatio: number;
  /** 유효한 값이 시작되는 날짜 */
  availableFrom: string;
  /** 합성 구간의 마지막 날짜. 백필하지 않았으면 null */
  syntheticUntil: string | null;
  length: number;
  /** 휴장일 결측을 직전 유효값으로 채운 일수. 보정 사실을 숨기지 않는다. */
  filledGapDays: number;
};

export type DataManifest = {
  formatVersion: number;
  generatedAt: string;
  startDate: string;
  dates: string[];
  products: ProductMeta[];
};

export type BuildInput = {
  product: Product;
  axis: string[];
  /** 상품의 원통화 총수익 시계열. 상장 이전은 NaN */
  actualUsd: Float64Array;
  /** 백필 기준 지수 시계열. 백필하지 않으면 null */
  indexValues: Float64Array | null;
  /** 무위험 금리 (연율 소수). 백필 대상이면 필수 */
  riskFreeRates: Float64Array | null;
  fxRates: Float64Array;
};

export type BuildOutput = {
  krwValues: Float64Array;
  meta: ProductMeta;
};

export function buildProductSeries(input: BuildInput): BuildOutput {
  const { product, axis, actualUsd, indexValues, riskFreeRates, fxRates } = input;

  let values = actualUsd;
  let syntheticBefore = 0;

  if (product.backfillIndex !== null) {
    if (indexValues === null) {
      throw new Error(
        `${product.id}는 백필 대상인데 기준 지수 데이터가 없습니다`,
      );
    }
    if (riskFreeRates === null) {
      throw new Error(
        `${product.id}는 백필 대상인데 무위험 금리 데이터가 없습니다`,
      );
    }
    if (product.leverage.kind === 'krSynthetic') {
      throw new Error(
        `${product.id}는 국내 합성형 레버리지입니다. 환율 반영 공식이 확정되지 않아 백필할 수 없습니다.`,
      );
    }
    const multiplier =
      product.leverage.kind === 'none' ? 1 : product.leverage.multiplier;
    const syntheticReturns = synthesizeLeveragedWithRates(
      dailyReturns(indexValues),
      riskFreeRates,
      multiplier,
      product.backfillSpread,
    );
    const spliced = spliceBackfill(actualUsd, syntheticReturns);
    values = spliced.values;
    syntheticBefore = spliced.syntheticBefore;
  }

  // 국내 상장 상품은 이미 원화 표시라 환산하지 않는다
  const rawKrwValues = new Float64Array(values.length);
  for (let i = 0; i < values.length; i += 1) {
    rawKrwValues[i] =
      product.market === 'US' ? values[i] * fxRates[i] : values[i];
  }

  // 미국 거래일 축에 국내 상장 상품을 올리면 한국 휴장일이 내부 결측으로
  // 남는다(연말 포함). 미국 상품은 구멍이 없어 filledCount === 0이 나오므로
  // 전 상품에 일률 적용해도 안전하다 — 규칙이 하나로 유지된다.
  const { filled: krwValues, filledCount: filledGapDays } = forwardFillGaps(rawKrwValues);

  const firstValid = krwValues.findIndex((v) => Number.isFinite(v));

  return {
    krwValues,
    meta: {
      id: product.id,
      ticker: product.ticker,
      displayName: product.displayName,
      exposure: product.exposure,
      market: product.market,
      listedAt: product.listedAt,
      expenseRatio: product.expenseRatio,
      availableFrom: firstValid === -1 ? axis[axis.length - 1] : axis[firstValid],
      syntheticUntil: syntheticBefore > 0 ? axis[syntheticBefore - 1] : null,
      length: krwValues.length,
      filledGapDays,
    },
  };
}
