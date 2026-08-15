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
   * 백필 시 적용할 연간 순드래그 (차입비용 + 추적오차 − 배당수익률).
   * Task 9의 골든 테스트로 캘리브레이션한 값이다.
   */
  backfillDrag: number;
};

export type ProductUnavailableReason =
  | 'NOT_LISTED_IN_KR'
  | 'ONLY_HEDGED_IN_KR'
  | 'US_ONLY_PRODUCT';

export type ProductResolution =
  | { available: true; product: Product }
  | { available: false; reason: ProductUnavailableReason; message: string };
