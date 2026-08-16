/** 누진세율 한 구간. upTo는 상한(포함), deduction은 누진공제액이다. */
export type TaxBracket = { upTo: number; rate: number; deduction: number };

/**
 * 근로소득공제처럼 "구간 하한에서의 누적값"을 나타내는 브래킷.
 * TaxBracket과 구조는 동일하지만 deduction의 의미가 다르다 — 종합소득세
 * 브래킷(progressiveTax가 소비)은 deduction을 taxBase×rate에서 뺀다.
 * 구조적 타이핑 특성상 이 별칭이 컴파일 타임에 오용을 막아주지는 않는다 —
 * 두 의미를 이름으로 구분해 가독성을 높이는 문서화 목적의 별칭이다.
 */
export type CumulativeDeductionBracket = TaxBracket;

export type TaxConstants = {
  /** 해외주식 양도소득세율 (지방소득세 포함) */
  overseasCapitalGainsRate: number;
  /** 해외주식 양도소득 기본공제 — 연 단위 초기화, 이월 불가 */
  overseasBasicDeduction: number;
  /** 해외 배당의 미국 원천징수율 (한미 조세조약) */
  overseasDividendWithholdingRate: number;
  /** 국내상장 해외ETF 배당소득 원천징수율 (지방소득세 포함) */
  domesticDividendRate: number;
  isa: {
    annualLimit: number;
    totalLimit: number;
    taxFreeIncome: number;
    excessRate: number;
    lockupYears: number;
  };
  comprehensive: {
    /** 금융소득종합과세 기준금액 */
    threshold: number;
    /** 비교과세용 분리세율 — 지방소득세 제외. 15.4%와 혼용하면 이중 계산이 된다 */
    separateRate: number;
    /** 지방소득세율 (산출세액 대비) */
    localTaxRate: number;
    incomeTaxBrackets: TaxBracket[];
    employmentDeductionBrackets: CumulativeDeductionBracket[];
    /** 인적 기본공제 */
    basicDeduction: number;
    /** 근로소득공제 한도 */
    employmentDeductionCap: number;
  };
};

const INF = Number.POSITIVE_INFINITY;

/**
 * 종합소득세율 8구간.
 * ✅ 2026-08-14 국세청 공식 자료 확인. 2026년 귀속에도 6~45% 골격 유지.
 * https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=2227&cntntsId=7667
 */
const INCOME_TAX_BRACKETS_2026: TaxBracket[] = [
  { upTo: 14_000_000, rate: 0.06, deduction: 0 },
  { upTo: 50_000_000, rate: 0.15, deduction: 1_260_000 },
  { upTo: 88_000_000, rate: 0.24, deduction: 5_760_000 },
  { upTo: 150_000_000, rate: 0.35, deduction: 15_440_000 },
  { upTo: 300_000_000, rate: 0.38, deduction: 19_940_000 },
  { upTo: 500_000_000, rate: 0.4, deduction: 25_940_000 },
  { upTo: 1_000_000_000, rate: 0.42, deduction: 35_940_000 },
  { upTo: INF, rate: 0.45, deduction: 65_940_000 },
];

/**
 * 근로소득공제 구간.
 * TaxBracket 형태를 재사용하되 의미가 다르다 — rate는 구간 내 공제율,
 * deduction은 그 구간까지의 누적 공제액(=구간 하한에서의 공제액)이다.
 * ✅ 국세청 공식 자료 확인. 한도 2,000만원.
 * https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=6435&cntntsId=7871
 */
const EMPLOYMENT_DEDUCTION_BRACKETS_2026: CumulativeDeductionBracket[] = [
  { upTo: 5_000_000, rate: 0.7, deduction: 0 },
  { upTo: 15_000_000, rate: 0.4, deduction: 3_500_000 },
  { upTo: 45_000_000, rate: 0.15, deduction: 7_500_000 },
  { upTo: 100_000_000, rate: 0.05, deduction: 12_000_000 },
  { upTo: INF, rate: 0.02, deduction: 14_750_000 },
];

const CONSTANTS_2026: TaxConstants = {
  overseasCapitalGainsRate: 0.22,
  overseasBasicDeduction: 2_500_000,
  overseasDividendWithholdingRate: 0.15,
  domesticDividendRate: 0.154,
  isa: {
    annualLimit: 20_000_000,
    totalLimit: 100_000_000,
    taxFreeIncome: 2_000_000,
    excessRate: 0.099,
    lockupYears: 3,
  },
  comprehensive: {
    threshold: 20_000_000,
    separateRate: 0.14,
    localTaxRate: 0.1,
    incomeTaxBrackets: INCOME_TAX_BRACKETS_2026,
    employmentDeductionBrackets: EMPLOYMENT_DEDUCTION_BRACKETS_2026,
    basicDeduction: 1_500_000,
    employmentDeductionCap: 20_000_000,
  },
};

/** 연도별 세법 상수. 법이 바뀌면 그 해 항목을 추가한다. */
export const TAX_CONSTANTS: Record<number, TaxConstants> = {
  2026: CONSTANTS_2026,
};

/**
 * 해당 연도에 적용할 상수를 고른다.
 * 미래 연도는 가장 최근 개정값이 유지된다고 가정한다 — 알 수 없는 미래 세법을
 * 지어내지 않고 현행 유지를 명시적 가정으로 둔다.
 */
export function getTaxConstants(year: number): TaxConstants {
  const years = Object.keys(TAX_CONSTANTS).map(Number).sort((a, b) => a - b);
  const applicable = years.filter((y) => y <= year);
  const chosen = applicable.length > 0 ? applicable[applicable.length - 1] : years[0];
  return TAX_CONSTANTS[chosen];
}
