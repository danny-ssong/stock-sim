import type { IndexExposure, Product, ProductResolution } from './types';

/** 데이터 시작일. 환율(1970~)과 지수(1985~)가 모두 커버하는 지점이다. */
export const BACKFILL_START = '1995-01-03';

/**
 * backfillSpread 값은 Task 9의 골든 테스트(golden.test.ts)가 실제 상장 이후 구간의
 * ETF 종가와 (지수 + 무위험금리)를 비교해 역산한 캘리브레이션 값이다.
 * 원천 데이터(data/raw/)가 갱신되어 최적값이 달라지면 골든 테스트를 다시 돌려 갱신한다.
 */
export const PRODUCTS: readonly Product[] = [
  {
    id: 'QQQ',
    ticker: 'QQQ',
    displayName: 'Invesco QQQ Trust',
    exposure: 'NASDAQ100_1X',
    listedAt: '1999-03-10',
    expenseRatio: 0.0020,
    leverage: { kind: 'none' },
    backfillIndex: '^NDX',
    // 배당수익률이 총보수를 넘어서 스프레드가 음수로 산출된다 (Task 9 골든 테스트로 캘리브레이션)
    backfillSpread: -0.0061,
  },
  {
    id: 'QLD',
    ticker: 'QLD',
    displayName: 'ProShares Ultra QQQ',
    exposure: 'NASDAQ100_2X',
    listedAt: '2006-06-21',
    expenseRatio: 0.0095,
    leverage: { kind: 'usListed', multiplier: 2 },
    backfillIndex: '^NDX',
    backfillSpread: -0.0012,
  },
  {
    id: 'TQQQ',
    ticker: 'TQQQ',
    displayName: 'ProShares UltraPro QQQ',
    exposure: 'NASDAQ100_3X',
    listedAt: '2010-02-11',
    expenseRatio: 0.0084,
    leverage: { kind: 'usListed', multiplier: 3 },
    backfillIndex: '^NDX',
    backfillSpread: -0.0064,
  },
  {
    id: 'SPY',
    ticker: 'SPY',
    displayName: 'SPDR S&P 500 ETF Trust',
    exposure: 'SP500_1X',
    listedAt: '1993-01-29',
    expenseRatio: 0.0009,
    leverage: { kind: 'none' },
    backfillIndex: null,
    backfillSpread: 0,
  },
  {
    id: 'SSO',
    ticker: 'SSO',
    displayName: 'ProShares Ultra S&P500',
    exposure: 'SP500_2X',
    listedAt: '2006-06-21',
    expenseRatio: 0.0089,
    leverage: { kind: 'usListed', multiplier: 2 },
    backfillIndex: '^SP500TR',
    backfillSpread: 0.0169,
  },
  {
    id: 'SPXL',
    ticker: 'SPXL',
    displayName: 'Direxion Daily S&P 500 Bull 3X',
    exposure: 'SP500_3X',
    listedAt: '2008-11-05',
    expenseRatio: 0.0087,
    leverage: { kind: 'usListed', multiplier: 3 },
    backfillIndex: '^SP500TR',
    backfillSpread: 0.0238,
  },
];

/** 노출 하나에 상품 하나 — 카탈로그가 1:1이라 실패하지 않는다.
 *  존재하지 않는 노출값이 들어오면(타입을 무시한 호출) 그 자체가 버그이므로 던진다. */
export function getProduct(exposure: IndexExposure): Product {
  const product = PRODUCTS.find((p) => p.exposure === exposure);
  if (product === undefined) {
    throw new Error(`카탈로그에 없는 노출입니다: ${exposure}`);
  }
  return product;
}

/** TaxStrategy.canHold가 쓰는 판정 형태. v1은 6개 노출이 전부 가능해 항상 성공하지만,
 *  v2 전략(예: 레버리지를 담지 못하는 연금저축)이 이 자리에서 갈릴 수 있다. */
export function resolveProduct(exposure: IndexExposure): ProductResolution {
  const product = PRODUCTS.find((p) => p.exposure === exposure);
  if (product === undefined) {
    return { available: false, reason: 'UNKNOWN_EXPOSURE', message: '지원하지 않는 노출입니다' };
  }
  return { available: true, product };
}

export function productIdsForExposures(exposures: readonly IndexExposure[]): string[] {
  return [...new Set(exposures.map((e) => getProduct(e).id))];
}
