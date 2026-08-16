import { describe, it, expect } from 'vitest';
import { employmentIncomeDeduction, approximateTaxBase } from './income';
import { getTaxConstants } from './constants';

const C = getTaxConstants(2026);

describe('employmentIncomeDeduction', () => {
  it('국세청 검증 사례를 재현한다 — 총급여 3,380만원 → 공제 1,032만원', () => {
    expect(employmentIncomeDeduction(33_800_000, C)).toBe(10_320_000);
  });

  it('5개 구간 경계값에서 공식이 연속이다', () => {
    expect(employmentIncomeDeduction(5_000_000, C)).toBe(3_500_000);
    expect(employmentIncomeDeduction(15_000_000, C)).toBe(7_500_000);
    expect(employmentIncomeDeduction(45_000_000, C)).toBe(12_000_000);
    expect(employmentIncomeDeduction(100_000_000, C)).toBe(14_750_000);
  });

  it('각 구간 내부 값이 위아래 경계 사이에 있다', () => {
    expect(employmentIncomeDeduction(3_000_000, C)).toBe(2_100_000);
    expect(employmentIncomeDeduction(10_000_000, C)).toBe(5_500_000);
    expect(employmentIncomeDeduction(60_000_000, C)).toBe(12_750_000);
  });

  it('공제 한도 2,000만원을 넘지 않는다', () => {
    expect(employmentIncomeDeduction(1_000_000_000, C)).toBe(20_000_000);
    // 한도에 정확히 닿는 총급여: 14,750,000 + (x − 1억) × 2% = 2,000만
    expect(employmentIncomeDeduction(362_500_000, C)).toBe(20_000_000);
  });

  it('총급여 0원이면 공제도 0원이다', () => {
    expect(employmentIncomeDeduction(0, C)).toBe(0);
  });

  it('음수 총급여는 0으로 취급한다', () => {
    expect(employmentIncomeDeduction(-1, C)).toBe(0);
  });
});

describe('approximateTaxBase', () => {
  it('국세청 사례의 근로소득금액에서 기본공제를 뺀 값이다', () => {
    // 3,380만 − 1,032만(공제) − 150만(기본공제) = 2,198만
    expect(
      approximateTaxBase({ grossSalary: 33_800_000, constants: C }),
    ).toBe(21_980_000);
  });

  it('과세표준 직접 입력이 있으면 총급여를 무시한다', () => {
    expect(
      approximateTaxBase({
        grossSalary: 200_000_000,
        override: 30_000_000,
        constants: C,
      }),
    ).toBe(30_000_000);
  });

  it('직접 입력이 0이면 0을 쓴다 — undefined와 구분한다', () => {
    expect(
      approximateTaxBase({ grossSalary: 60_000_000, override: 0, constants: C }),
    ).toBe(0);
  });

  it('근로소득이 0원이면 과세표준도 0원이다 — 음수로 내려가지 않는다', () => {
    expect(approximateTaxBase({ grossSalary: 0, constants: C })).toBe(0);
  });

  it('연봉 6,000만원의 근사 과세표준', () => {
    // 6,000만 − 1,275만 − 150만 = 4,575만
    expect(
      approximateTaxBase({ grossSalary: 60_000_000, constants: C }),
    ).toBe(45_750_000);
  });
});
