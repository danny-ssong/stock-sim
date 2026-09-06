import type { AccountId, IndexExposure } from '../data/types';
import type { TaxBreakdown } from '../tax/types';
import type { DrawdownResult, PortfolioIndexPoint } from './drawdown';
export type { PortfolioIndexPoint };

/**
 * 연도별 값 스케줄. 기본은 상승률로 자동 증가하되, 특정 해에 값을 고정(anchor)할 수 있다.
 */
export type AnchoredSchedule = {
  base: number;
  growthRate: number;
  anchors: Record<number, number>;
};

/** 수익률 소스. 두 모드는 같은 파이프라인을 통과한다. */
export type ReturnSource =
  | { type: 'historicalPath'; from: string; to: string; tileMode: 'repeat' }
  /** annualRate가 null이면 "사용자가 아직 직접 고르지 않았다"는 뜻이다 — 선택한
   *  상품의 과거 실측 CAGR을 따라간다. 해소는 resolveConstantRate 한 곳에서만
   *  한다(market/returns.ts). 0과 음수는 유효한 사용자 선택이므로 null과 구분된다. */
  | { type: 'constantCagr'; annualRate: number | null };

/** 월별 원장의 한 줄. 계좌가 하나뿐이라 매달 한 줄만 생긴다. */
export type MonthEntry = {
  monthIndex: number;
  /** 매수 시점('YYYY-MM-DD'). 휴장이면 그 달의 다음 거래일이다 */
  date: string;
  /** 평가 시점('YYYY-MM-DD'). 그 달 마지막 거래일이며 marketValue의 기준이다 */
  endDate: string;
  accountId: AccountId;
  productId: string;
  contribution: number;
  buyPrice: number;
  sharesBought: number;
  sharesHeld: number;
  marketValue: number;
  costBasis: number;
  /** 매도로 실현된 손익. 원장 단계에서는 항상 0이다 */
  realizedGain: number;
  isSynthetic: boolean;
};

export type Ledger = {
  entries: MonthEntry[];
  syntheticRatio: number;
};

export type SimulationInput = {
  /** future = 미래 설계, backtest = 과거 백테스트 */
  mode: 'future' | 'backtest';
  startMonth: string;
  initialAmount: number;
  years: number;
  contribution: AnchoredSchedule;
  /** 엔진은 노출 하나만 받는다 — 계좌가 하나뿐이라 시뮬레이션 한 번은 상품 하나를
   *  산다. UI는 여러 노출을 비교할 수 있지만(ExposureSelector), 그 비교는 이
   *  타입을 노출별로 하나씩 채워 여러 번 실행하는 방식이다(SimulationInputBase 참고). */
  exposure: IndexExposure;
  returnSource: ReturnSource;
};

/**
 * 노출을 제외한 시뮬레이션 입력.
 *
 * URL은 비교를 위해 노출을 배열로 들고 있고(`exp=A,B`) 엔진(simulate)은 노출
 * 하나만 받는다. 그 둘을 잇는 중간 형태가 필요하다 — `SimulationInput.exposure`에
 * 배열의 첫 값을 채워 넣는 대안은 같은 값이 두 곳에 살아 "어느 쪽이 진실인가"가
 * 흐려지므로 쓰지 않는다. 노출을 붙이는 지점은 `{ ...base, exposure }` 스프레드
 * 두 곳뿐이다 — 노출 1개 경로(ResultsView.tsx)와 비교 경로(compare.ts의
 * runExposure)로, 각각 그 분기의 자연스러운 경계다.
 */
export type SimulationInputBase = Omit<SimulationInput, 'exposure'>;

/** 사용자에게 반드시 노출해야 하는 가정·제약. 조용히 삼키지 않는다. */
export type SimulationWarning =
  | {
      code: 'BEFORE_LISTING' | 'REFERENCE_TOO_SHORT';
      productId: string;
      message: string;
      suggestion: ReturnSource;
    }
  | { code: 'RETURN_SOURCE_IGNORED'; requestedAnnualRate: number; message: string };

export type YearTaxSummary = {
  yearIndex: number;
  calendarYear: number;
  harvestedGain: number;
  totalTax: number;
};

export type SimulationResult = {
  ledger: Ledger;
  yearlyTax: YearTaxSummary[];
  exitBreakdowns: TaxBreakdown[];
  finalBeforeTax: number;
  finalAfterTax: number;
  totalContributed: number;
  totalTax: number;
  harvest: { taxFreeGain: number; savedTax: number };
  syntheticRatio: number;
  portfolioIndex: PortfolioIndexPoint[];
  /** 시뮬 구간의 일별 가격 레벨 기준 MDD. portfolioIndex와 같은 일별 축을 보므로
   *  여기 담긴 peak·trough 날짜는 반드시 portfolioIndex 안에도 있다
   *  (engine.ts dailyWindowStart) — 카드의 MDD를 차트에서 짚어 확인할 수 있는 근거다 */
  drawdown: DrawdownResult | null;
  warnings: SimulationWarning[];
};

export type SimulationOutcome =
  | { ok: true; result: SimulationResult }
  | { ok: false; blockers: SimulationWarning[] };
