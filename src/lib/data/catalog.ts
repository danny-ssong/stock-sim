import type {
  AccountId,
  FutureSimulationResolution,
  IndexExposure,
  Market,
  Product,
  ProductResolution,
  ProductUnavailableReason,
} from './types';

/** 데이터 시작일. 환율(1970~)과 지수(1985~)가 모두 커버하는 지점이다. */
export const BACKFILL_START = '1995-01-03';

/**
 * backfillSpread 값은 Task 9의 골든 테스트(golden.test.ts)가 실제 상장 이후 구간의
 * ETF 종가와 (지수 + 무위험금리)를 비교해 역산한 캘리브레이션 값이다.
 * 원천 데이터(data/raw/)가 갱신되어 최적값이 달라지면 골든 테스트를 다시 돌려 갱신한다.
 *
 * dividendYield는 SCHD·TIGER_DIVIDEND(배당 100 상품, 3.5~3.6%)만 반영한다.
 * 나머지 9종은 추정 배당수익률이 0.2~1.4%로 낮아 종합과세 발동 여부나
 * 최종 세후 금액에 미치는 영향이 무시할 수준이라 0으로 두고, 결과 화면에
 * "배당을 계산에 반영하지 않음" 안내만 남긴다(계획 D6).
 * ⚠️ 반영하는 두 값도 미검증 추정치다. 스펙 §14의 남은 확인 항목 6번을 참조한다.
 */
export const PRODUCTS: readonly Product[] = [
  {
    id: 'QQQ',
    ticker: 'QQQ',
    displayName: 'Invesco QQQ Trust',
    exposure: 'NASDAQ100_1X',
    market: 'US',
    listedAt: '1999-03-10',
    expenseRatio: 0.0020,
    leverage: { kind: 'none' },
    hedged: false,
    backfillIndex: '^NDX',
    // 배당수익률이 총보수를 넘어서 스프레드가 음수로 산출된다 (Task 9 골든 테스트로 캘리브레이션)
    backfillSpread: -0.0061,
    dividendYield: 0, // 추정 0.5% — 영향 무시할 수준이라 0으로 둔다
  },
  {
    id: 'QLD',
    ticker: 'QLD',
    displayName: 'ProShares Ultra QQQ',
    exposure: 'NASDAQ100_2X',
    market: 'US',
    listedAt: '2006-06-21',
    expenseRatio: 0.0095,
    leverage: { kind: 'usListed', multiplier: 2 },
    hedged: false,
    backfillIndex: '^NDX',
    backfillSpread: -0.0012,
    dividendYield: 0, // 추정 0.2%
  },
  {
    id: 'TQQQ',
    ticker: 'TQQQ',
    displayName: 'ProShares UltraPro QQQ',
    exposure: 'NASDAQ100_3X',
    market: 'US',
    listedAt: '2010-02-11',
    expenseRatio: 0.0084,
    leverage: { kind: 'usListed', multiplier: 3 },
    hedged: false,
    backfillIndex: '^NDX',
    backfillSpread: -0.0064,
    dividendYield: 0, // 추정 1.4%
  },
  {
    id: 'SPY',
    ticker: 'SPY',
    displayName: 'SPDR S&P 500 ETF Trust',
    exposure: 'SP500_1X',
    market: 'US',
    listedAt: '1993-01-29',
    expenseRatio: 0.0009,
    leverage: { kind: 'none' },
    hedged: false,
    backfillIndex: null,
    backfillSpread: 0,
    dividendYield: 0, // 추정 1.2%
  },
  {
    id: 'SSO',
    ticker: 'SSO',
    displayName: 'ProShares Ultra S&P500',
    exposure: 'SP500_2X',
    market: 'US',
    listedAt: '2006-06-21',
    expenseRatio: 0.0089,
    leverage: { kind: 'usListed', multiplier: 2 },
    hedged: false,
    backfillIndex: '^SP500TR',
    backfillSpread: 0.0169,
    dividendYield: 0, // 추정 1.0%
  },
  {
    id: 'SPXL',
    ticker: 'SPXL',
    displayName: 'Direxion Daily S&P 500 Bull 3X',
    exposure: 'SP500_3X',
    market: 'US',
    listedAt: '2008-11-05',
    expenseRatio: 0.0087,
    leverage: { kind: 'usListed', multiplier: 3 },
    hedged: false,
    backfillIndex: '^SP500TR',
    backfillSpread: 0.0238,
    dividendYield: 0, // 추정 1.3%
  },
  {
    id: 'SCHD',
    ticker: 'SCHD',
    displayName: 'Schwab US Dividend Equity ETF',
    exposure: 'US_DIVIDEND_100',
    market: 'US',
    listedAt: '2011-10-20',
    expenseRatio: 0.0006,
    leverage: { kind: 'none' },
    // 기초지수(Dow Jones US Dividend 100)가 공개 소스에 없어 백필 불가
    backfillIndex: null,
    hedged: false,
    backfillSpread: 0,
    dividendYield: 0.036, // 배당 100 상품 — 유의미해 반영한다
  },
  {
    id: 'TIGER_NASDAQ100',
    ticker: '133690.KS',
    displayName: 'TIGER 미국나스닥100',
    exposure: 'NASDAQ100_1X',
    market: 'KR',
    listedAt: '2010-10-18',
    expenseRatio: 0.0020,
    leverage: { kind: 'none' },
    hedged: false,
    backfillIndex: null,
    backfillSpread: 0,
    dividendYield: 0, // 추정 0.3%
  },
  {
    id: 'TIGER_NASDAQ100_2X',
    ticker: '418660.KS',
    displayName: 'TIGER 미국나스닥100레버리지(합성)',
    exposure: 'NASDAQ100_2X',
    market: 'KR',
    listedAt: '2022-02-22',
    expenseRatio: 0.0030,
    // 환율 반영 공식을 실측으로 확정하지 못했다. 백필하지 않는다.
    leverage: { kind: 'krSynthetic', multiplier: 2 },
    hedged: false,
    backfillIndex: null,
    backfillSpread: 0,
    dividendYield: 0, // 스왑 구조상 배당 없음
  },
  {
    id: 'TIGER_SP500',
    ticker: '360750.KS',
    displayName: 'TIGER 미국S&P500',
    exposure: 'SP500_1X',
    market: 'KR',
    listedAt: '2020-08-07',
    expenseRatio: 0.0020,
    leverage: { kind: 'none' },
    hedged: false,
    backfillIndex: null,
    backfillSpread: 0,
    dividendYield: 0, // 추정 1.0%
  },
  {
    id: 'TIGER_DIVIDEND',
    ticker: '458730.KS',
    displayName: 'TIGER 미국배당다우존스',
    exposure: 'US_DIVIDEND_100',
    market: 'KR',
    listedAt: '2023-06-20',
    expenseRatio: 0.0011,
    leverage: { kind: 'none' },
    hedged: false,
    backfillIndex: null,
    backfillSpread: 0,
    dividendYield: 0.035, // 배당 100 상품 — 유의미해 반영한다
  },
];

export function getProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

/** 계좌가 요구하는 시장. ISA와 국내ETF 계좌는 국내 상장만 담을 수 있다. */
function requiredMarket(accountId: AccountId): Market {
  return accountId === 'DIRECT_US' ? 'US' : 'KR';
}

const KR_UNAVAILABLE: Record<string, ProductUnavailableReason> = {
  NASDAQ100_3X: 'NOT_LISTED_IN_KR',
  SP500_3X: 'NOT_LISTED_IN_KR',
  SP500_2X: 'ONLY_HEDGED_IN_KR',
};

const REASON_MESSAGE: Record<ProductUnavailableReason, string> = {
  NOT_LISTED_IN_KR:
    '자본시장법상 2배 초과 레버리지 ETF는 국내 상장이 제한됩니다',
  ONLY_HEDGED_IN_KR: '국내에는 환헤지형만 상장되어 있습니다',
  US_ONLY_PRODUCT: '해외 직접투자 계좌에서만 거래할 수 있습니다',
};

export function resolveProduct(
  accountId: AccountId,
  exposure: IndexExposure,
): ProductResolution {
  const market = requiredMarket(accountId);
  const product = PRODUCTS.find(
    (p) => p.exposure === exposure && p.market === market,
  );

  if (product) return { available: true, product };

  const reason = market === 'KR'
    ? (KR_UNAVAILABLE[exposure] ?? 'NOT_LISTED_IN_KR')
    : 'US_ONLY_PRODUCT';

  return { available: false, reason, message: REASON_MESSAGE[reason] };
}

/**
 * 미래 시뮬레이션 가용성을 판정한다.
 *
 * 국내 합성형 레버리지(krSynthetic)는 환율 반영 공식이 실측으로 확정되지 않았다(§4.6).
 * 미래 시뮬은 과거 수익률을 복사해 붙이면서 환율 가정을 바꿔 끼우는데(계획 D3),
 * 그러려면 원화 수익률에서 환율 몫을 빼내야 하고 그 계산이 바로 미확정 공식에 기댄다.
 * 과거 백테스트는 실제 데이터를 그대로 쓰므로 이 판정을 거치지 않는다.
 */
export function resolveFutureSimulation(
  product: Product,
): FutureSimulationResolution {
  if (product.leverage.kind !== 'krSynthetic') return { allowed: true };

  const usAlternative = PRODUCTS.find(
    (p) => p.exposure === product.exposure && p.market === 'US',
  );

  return {
    allowed: false,
    reason: 'FX_MODEL_UNCONFIRMED',
    message: `${product.displayName}는 환율 반영 공식이 확정되지 않아 미래 시뮬레이션을 제공하지 않습니다. 과거 백테스트에서는 실제 데이터로 확인할 수 있습니다.`,
    alternative: usAlternative
      ? {
          accountId: 'DIRECT_US',
          exposure: usAlternative.exposure,
          productId: usAlternative.id,
        }
      : null,
  };
}
