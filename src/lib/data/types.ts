/** 사용자가 선택하는 단위 — 무엇에 노출되고 싶은가 */
export type IndexExposure =
  | 'NASDAQ100_1X'
  | 'NASDAQ100_2X'
  | 'NASDAQ100_3X'
  | 'SP500_1X'
  | 'SP500_2X'
  | 'SP500_3X';

export type AccountId = 'DIRECT_US';

/** 레버리지 수익 계산 방식. 미국 상장만 남아 usListed 하나뿐이지만,
 *  krSynthetic 분기가 있었다는 사실 자체가 이 타입이 판별 유니온이어야
 *  하는 이유를 보여주므로 배율 없는 상품과는 여전히 분리한다. */
export type LeverageModel =
  | { kind: 'usListed'; multiplier: number }
  | { kind: 'none' };

export type Product = {
  id: string;
  ticker: string;
  displayName: string;
  exposure: IndexExposure;
  /** 이 날짜 이전은 실제 데이터가 없다 */
  listedAt: string;
  /** 연 총보수 */
  expenseRatio: number;
  leverage: LeverageModel;
  /** 백필 기준 지수 심볼. null이면 백필하지 않는다. */
  backfillIndex: string | null;
  /** 백필 시 금리에 더할 연간 스프레드(골든 테스트가 캘리브레이션) */
  backfillSpread: number;
};

/** 노출 → 상품은 지금 이 카탈로그에서 1:1이라 실패하지 않지만, v2에서
 *  노출당 여러 상품(예: 운용사가 다른 동일 노출)이 생기면 여기서 갈린다.
 *  그 확장 포인트를 지금 걷어내지 않는다. */
export type ProductResolution =
  | { available: true; product: Product }
  | { available: false; reason: 'UNKNOWN_EXPOSURE'; message: string };
