/** 사용자가 선택하는 단위 — 무엇에 노출되고 싶은가 */
export type IndexExposure =
  | 'NASDAQ100_1X'
  | 'NASDAQ100_2X'
  | 'NASDAQ100_3X'
  | 'SP500_1X'
  | 'SP500_2X'
  | 'SP500_3X'
  | 'US_DIVIDEND_100';

export type AccountId = 'DIRECT_US' | 'DOMESTIC_ETF' | 'ISA';

export type Market = 'US' | 'KR';

/** 레버리지 수익 계산 방식. 미국 상장과 국내 합성형은 환율 반영 구조가 다르다. */
export type LeverageModel =
  | { kind: 'usListed'; multiplier: number }
  | { kind: 'krSynthetic'; multiplier: number }
  | { kind: 'none' };

export type Product = {
  id: string;
  ticker: string;
  displayName: string;
  exposure: IndexExposure;
  market: Market;
  /** 이 날짜 이전은 실제 데이터가 없다 */
  listedAt: string;
  /** 연 총보수 */
  expenseRatio: number;
  leverage: LeverageModel;
  hedged: boolean;
  /** 백필 기준 지수 심볼. null이면 백필하지 않는다. */
  backfillIndex: string | null;
  /**
   * 백필 시 금리에 더할 연간 스프레드.
   * 운용보수·배당수익률·추적오차를 모두 흡수한 실측 적합값이며,
   * 배당이 보수를 넘어서면 음수가 된다(배율 1 상품에서 흔함).
   * 골든 테스트가 캘리브레이션한다.
   */
  backfillSpread: number;
  /**
   * 연 배당수익률.
   *
   * 배당 비중이 큰 상품(SCHD·TIGER_DIVIDEND)만 추정치를 넣는다. 나머지는 배당이
   * 세금·최종 금액에 미치는 영향이 무시할 수준(0.2~1.4%)이라 0으로 둬 결과에서
   * 아예 제외하고, 대신 결과 화면에 안내만 남긴다(계획 D6).
   *
   * ⚠️ SCHD·TIGER_DIVIDEND의 값도 미검증 추정치다. 가격 시계열은 Yahoo
   * adjClose(배당 재투자 반영 총수익)라 배당이 이미 녹아 있어 되꺼낼 수 없다.
   * 이 값은 시계열에 더하지 않고 금융소득종합과세 합산과 미국 원천징수 15%
   * 차감에만 쓴다. 발행사 공시로 확인되면 이 값만 교체하면 된다.
   */
  dividendYield: number;
};

export type ProductUnavailableReason =
  | 'NOT_LISTED_IN_KR'
  | 'ONLY_HEDGED_IN_KR'
  | 'US_ONLY_PRODUCT';

export type ProductResolution =
  | { available: true; product: Product }
  | { available: false; reason: ProductUnavailableReason; message: string };

/** 미래 시뮬레이션에서 이 상품을 쓸 수 있는지의 판정 결과 */
export type FutureSimulationResolution =
  | { allowed: true }
  | {
      allowed: false;
      reason: 'FX_MODEL_UNCONFIRMED';
      message: string;
      /** 같은 노출을 담을 수 있는 미국 상장 대안. 없으면 null */
      alternative: {
        accountId: AccountId;
        exposure: IndexExposure;
        productId: string;
      } | null;
    };
