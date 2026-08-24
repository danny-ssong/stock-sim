import type { IndexExposure, Product } from './types';
import { dailyReturns, synthesizeLeveragedWithRates } from './synthetic';
import { spliceBackfill } from './splice';
import { forwardFillGaps } from './align';

export type ProductMeta = {
  id: string;
  ticker: string;
  displayName: string;
  exposure: IndexExposure;
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
  /**
   * USD/KRW 일별 환율 산출물. dates와 같은 길이의 Float32Array다.
   * .bin에는 환율이 이미 곱해져 있어(build.ts의 원화 환산), 시뮬레이터가
   * 환율 가정을 바꾸려면 이 시계열로 나눠 되벗겨야 한다 (계획 D3).
   */
  fx: { file: string; length: number };
  /** 외식물가 실측 CPI 산출물. 품목(FOOD_ITEMS)별로 하나씩, dates와 같은 길이다. */
  diningCpi: Array<{ itemId: string; file: string; length: number }>;
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

  // 카탈로그 상품이 전부 미국 상장이라(계획 D2) 원화 환산은 항상 적용한다
  const rawKrwValues = new Float64Array(values.length);
  for (let i = 0; i < values.length; i += 1) {
    rawKrwValues[i] = values[i] * fxRates[i];
  }

  // 데이터 소스(Yahoo)가 드물게 개별 거래일을 누락시킬 수 있어 방어적으로
  // 전진 채움을 전 상품에 일률 적용한다. 결측이 없으면 filledCount === 0이라
  // 안전하다 — 규칙이 하나로 유지된다.
  const { filled: krwValues, filledCount: filledGapDays } = forwardFillGaps(rawKrwValues);

  const firstValid = krwValues.findIndex((v) => Number.isFinite(v));

  return {
    krwValues,
    meta: {
      id: product.id,
      ticker: product.ticker,
      displayName: product.displayName,
      exposure: product.exposure,
      listedAt: product.listedAt,
      expenseRatio: product.expenseRatio,
      availableFrom: firstValid === -1 ? axis[axis.length - 1] : axis[firstValid],
      syntheticUntil: syntheticBefore > 0 ? axis[syntheticBefore - 1] : null,
      length: krwValues.length,
      filledGapDays,
    },
  };
}
