import type { AccountId, IndexExposure } from '../data/types';
import type { TaxBreakdown } from '../tax/types';
import type { PortfolioIndexPoint } from './drawdown';
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
  | { type: 'constantCagr'; annualRate: number };

/** 월별 원장의 한 줄. 계좌가 하나뿐이라 매달 한 줄만 생긴다. */
export type MonthEntry = {
  monthIndex: number;
  date: string;
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
  /** v1은 노출 하나만 고른다 — 계좌가 하나뿐이고 UI도 이미 단일 선택이다 */
  exposure: IndexExposure;
  returnSource: ReturnSource;
};

/**
 * 노출을 제외한 시뮬레이션 입력.
 *
 * URL은 비교를 위해 노출을 배열로 들고 있고(`exp=A,B`) 엔진(simulate)은 노출
 * 하나만 받는다. 그 둘을 잇는 중간 형태가 필요하다 — `SimulationInput.exposure`에
 * 배열의 첫 값을 채워 넣는 대안은 같은 값이 두 곳에 살아 "어느 쪽이 진실인가"가
 * 흐려지므로 쓰지 않는다. 노출을 붙이는 지점은 `{ ...base, exposure }` 하나다.
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
  | { code: 'RETURN_SOURCE_IGNORED'; requestedAnnualRate: number; message: string }
  | { code: 'BACKTEST_YEARS_CLAMPED'; requestedYears: number; availableYears: number; message: string };

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
  warnings: SimulationWarning[];
};

export type SimulationOutcome =
  | { ok: true; result: SimulationResult }
  | { ok: false; blockers: SimulationWarning[] };
