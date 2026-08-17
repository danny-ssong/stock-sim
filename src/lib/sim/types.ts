import type { AccountId, IndexExposure } from '../data/types';
import type { ComprehensiveTaxResult } from '../tax/comprehensive';
import type { RealizationStrategy, TaxBreakdown } from '../tax/types';

/**
 * 연도별 값 스케줄. 기본은 상승률로 자동 증가하되, 특정 해에 값을 고정(anchor)할 수 있다.
 * 고정한 해가 새 기준점이 되어 그 이후는 다시 상승률이 붙는다.
 * 월 납입액과 연 근로소득이 같은 구조를 요구하므로 하나로 뽑았다(§5.4).
 */
export type AnchoredSchedule = {
  /** 0년차 기준값 */
  base: number;
  /** 연 상승률 */
  growthRate: number;
  /** 연차 → 그 해의 값. 이 연도가 새 기준점이 된다 */
  anchors: Record<number, number>;
};

/**
 * 재수출이지만 위에서 import한 지역 바인딩을 다시 내보낸다.
 * `export ... from`만 쓰면 지역 바인딩이 생기지 않아 이 파일 안의
 * `SimulationInput`에서 이 이름을 쓸 수 없다.
 */
export type { RealizationStrategy };

/**
 * 미래 환율 가정(§5.6).
 *
 * 주가는 장기 우상향 경향이 있지만 환율은 등락을 반복한다. 과거 환율 경로를
 * 미래에 그대로 재생하면 "원화가 계속 약세로 간다"는 강한 방향성 가정이
 * 숨어 들어가므로, 탭 1의 기본값은 fixed다.
 */
export type FxAssumption =
  | { type: 'fixed'; rate: number }
  | { type: 'historicalPath' }
  | { type: 'drift'; annualRate: number };

/** 수익률 소스(§5.3). 두 모드는 같은 파이프라인을 통과한다. */
export type ReturnSource =
  /** 기본값: 선택한 과거 구간의 일별 수익률 시퀀스를 미래에 순서대로 적용 */
  | { type: 'historicalPath'; from: string; to: string; tileMode: 'repeat' }
  /** 토글: 연 복리 직선 */
  | { type: 'constantCagr'; annualRate: number };

/** 월별 원장의 한 줄. 계좌×상품마다 한 줄씩 생긴다(§5.2). */
export type MonthEntry = {
  monthIndex: number;
  date: string;
  accountId: AccountId;
  productId: string;

  /** 이번 달 실제 납입액 (KRW) */
  contribution: number;
  /** 매수 단가 (KRW 환산 가상 레벨. 절대 수준은 무의미하고 비율만 쓴다) */
  buyPrice: number;
  sharesBought: number;
  sharesHeld: number;
  /**
   * 월말 평가액 (KRW).
   * ⚠️ 배당 연말 행(isYearEnd && dividendYield > 0)은 예외다 — 원천징수 반영 전
   * 스냅샷이며, entry.sharesHeld × 그 달 종가와 일치하지 않는다
   * (dividendYield × dividendWithholdingRate 만큼 과대, 다음 달부터 자연히 반영된다).
   */
  marketValue: number;
  /** 누적 취득원가 (KRW). 세금의 step-up은 엔진이 따로 관리한다 */
  costBasis: number;
  /** 매도·이전으로 실현된 손익 (KRW). 원장 단계에서는 항상 0이다 */
  realizedGain: number;
  /** 그 달에 계상된 배당 총액 (원천징수 전) */
  dividendReceived: number;

  fxRate: number;
  /** 이 달의 가격이 합성값인지 */
  isSynthetic: boolean;
};

export type Ledger = {
  entries: MonthEntry[];
  /** 합성 구간이 차지하는 비율 → UI 배지에 그대로 쓴다 */
  syntheticRatio: number;
};

/** 계좌 × 노출 × 비중. 어떤 상품을 살지는 엔진이 카탈로그에서 확정한다(§5.1). */
export type Allocation = {
  accountId: AccountId;
  exposure: IndexExposure;
  /** 배분 비중. 전체 합이 1이다 */
  weight: number;
};

/** 해외직투 → ISA 이전 이벤트(§5.5). v1 엔진은 아직 처리하지 않는다. */
export type TransferEvent = {
  atMonth: number;
  from: 'DIRECT_US';
  to: 'ISA';
  amount: number | 'all';
};

export type SimulationInput = {
  /** future = 탭 1·3, backtest = 탭 2. 스펙에 없지만 두 모드의 달력이 다르므로 명시한다 */
  mode: 'future' | 'backtest';
  /** 시뮬 시작월 'YYYY-MM' */
  startMonth: string;
  initialAmount: number;
  years: number;

  contribution: AnchoredSchedule;
  employmentIncome: AnchoredSchedule;
  taxBaseOverride?: number;

  allocations: Allocation[];

  returnSource: ReturnSource;
  fxAssumption: FxAssumption;
  realizationStrategy: RealizationStrategy;
  transferEvents: TransferEvent[];

  displayCurrency: 'KRW' | 'USD';
};

/** 사용자에게 반드시 노출해야 하는 가정·제약(§13). 조용히 삼키지 않는다. */
export type SimulationWarning =
  | {
      code: 'PRODUCT_UNAVAILABLE';
      accountId: AccountId;
      exposure: IndexExposure;
      message: string;
    }
  | {
      code: 'FX_MODEL_UNCONFIRMED';
      productId: string;
      message: string;
      alternative: { accountId: AccountId; exposure: IndexExposure; productId: string } | null;
    }
  | {
      // resolvePathIndices(Task 12)의 두 실패 사유를 그대로 옮긴다. 다르면 오분류된다.
      code: 'BEFORE_LISTING' | 'REFERENCE_TOO_SHORT';
      productId: string;
      message: string;
      suggestion: ReturnSource;
    }
  | { code: 'FX_PATH_UNAVAILABLE'; message: string }
  | { code: 'DIVIDEND_NOT_MODELED'; productId: string; message: string };

export type YearTaxSummary = {
  yearIndex: number;
  calendarYear: number;
  employmentIncome: number;
  /** 그 해 계좌 횡단 금융소득 (ISA·해외 양도차익 제외) */
  financialIncome: number;
  withheldTax: number;
  /** 기본공제 소진으로 그 해 비과세 실현한 이익 */
  harvestedGain: number;
  comprehensive: ComprehensiveTaxResult;
  /**
   * 그 해 세금 때문에 최종 금액에서 **추가로** 빠지는 금액
   * (확정 세액 + 종합과세 추가 납부).
   *
   * ⚠️ 해외직투 배당의 미국 원천징수 15%는 **마지막 해에만** 여기 들어간다.
   * 원장은 연말 행의 평가액을 원천징수 반영 전에 찍고 줄어든 주수를 다음 달부터
   * 반영하므로(MonthEntry.marketValue 주석), 마지막 해 이전의 원천징수는 이미
   * finalBeforeTax에 녹아 있어 여기 더하면 두 번 빠진다. 반대로 마지막 해는 그
   * 몫을 실을 다음 달이 없어 평가액에 끝내 반영되지 않으므로 여기서 뺀다.
   * 어느 해든 원천징수 금액 자체는 withheldTax에서 확인할 수 있다.
   * 국내상장·ISA의 원천징수는 원장이 아예 모르므로 매년 포함된다.
   */
  totalTax: number;
};

export type SimulationResult = {
  ledger: Ledger;
  yearlyTax: YearTaxSummary[];
  exitBreakdowns: TaxBreakdown[];
  finalBeforeTax: number;
  finalAfterTax: number;
  totalContributed: number;
  /** yearlyTax[].totalTax의 합. `finalAfterTax = finalBeforeTax - totalTax`가 성립한다 */
  totalTax: number;
  /** §6.3의 두 숫자를 분리해 낸다 — 사용자가 보고 싶은 것은 절세액 쪽이다 */
  harvest: { taxFreeGain: number; savedTax: number };
  syntheticRatio: number;
  warnings: SimulationWarning[];
  labels: { fxAssumption: string; path: string | null };
};

export type SimulationOutcome =
  | { ok: true; result: SimulationResult }
  | { ok: false; blockers: SimulationWarning[] };
