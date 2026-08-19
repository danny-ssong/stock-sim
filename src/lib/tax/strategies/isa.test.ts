import { describe, it, expect } from 'vitest';
import { isaStrategy } from './isa';
import { getTaxConstants } from '../constants';
import type { AccountYearState, TaxContext } from '../types';

const C = getTaxConstants(2026);
const CTX: TaxContext = {
  constants: C,
  realizationStrategy: { type: 'holdUntilExit' },
  isaExistingYears: 0,
};

function state(overrides: Partial<AccountYearState> = {}): AccountYearState {
  return {
    yearIndex: 5,
    calendarYear: 2031,
    accountId: 'ISA',
    productId: 'TIGER_NASDAQ100',
    marketValue: 100_000_000,
    costBasis: 90_000_000,
    dividendIncome: 0,
    realizedGain: 0,
    heldYears: 5,
    isFinalYear: true,
    ...overrides,
  };
}

describe('정산 (exitTax)', () => {
  it('순소득 200만원까지는 비과세다', () => {
    const result = isaStrategy.exitTax(
      state({ marketValue: 92_000_000, costBasis: 90_000_000 }),
      CTX,
    );
    expect(result.tax).toBe(0);
  });

  it('순소득 300만원이면 초과분 100만원에 9.9%가 붙는다', () => {
    const result = isaStrategy.exitTax(
      state({ marketValue: 93_000_000, costBasis: 90_000_000 }),
      CTX,
    );
    expect(result.tax).toBeCloseTo(99_000, 6);
  });

  it('배당까지 통산한 순소득으로 판정한다', () => {
    const result = isaStrategy.exitTax(
      state({
        marketValue: 91_000_000,
        costBasis: 90_000_000,
        dividendIncome: 2_000_000,
      }),
      CTX,
    );
    // 순소득 300만 → (300만 − 200만) × 9.9%
    expect(result.tax).toBeCloseTo(99_000, 6);
  });

  it('통산 결과가 순손실이면 세금이 0원이다', () => {
    const result = isaStrategy.exitTax(
      state({ marketValue: 80_000_000, costBasis: 90_000_000 }),
      CTX,
    );
    expect(result.tax).toBe(0);
  });

  it('ISA 손익은 분리과세라 금융소득에 합산되지 않는다 — ISA의 숨은 장점', () => {
    const result = isaStrategy.exitTax(
      state({ marketValue: 500_000_000, costBasis: 90_000_000 }),
      CTX,
    );
    expect(result.financialIncome).toBe(0);
  });

  it('3년 의무보유를 못 채우면 일반계좌 과세로 소급한다', () => {
    const result = isaStrategy.exitTax(
      state({
        heldYears: 2,
        marketValue: 100_000_000,
        costBasis: 90_000_000,
        dividendIncome: 1_000_000,
      }),
      CTX,
    );
    // (매매차익 1,000만 + 분배금 100만) × 15.4%
    expect(result.tax).toBeCloseTo(1_694_000, 4);
    expect(result.financialIncome).toBe(11_000_000);
    expect(result.notes.some((n) => n.includes('3년'))).toBe(true);
  });

  it('보유가 정확히 3년이면 ISA 과세를 적용한다', () => {
    const result = isaStrategy.exitTax(
      state({ heldYears: 3, marketValue: 93_000_000, costBasis: 90_000_000 }),
      CTX,
    );
    expect(result.tax).toBeCloseTo(99_000, 6);
    expect(result.financialIncome).toBe(0);
  });
});

describe('보유 중 과세 (annualTax)', () => {
  it('계좌 안에서는 매년 과세하지 않는다 — 해지 시 일괄 정산한다', () => {
    const result = isaStrategy.annualTax(state({ dividendIncome: 3_000_000 }), CTX);
    expect(result.tax).toBe(0);
    expect(result.withheldTax).toBe(0);
    expect(result.financialIncome).toBe(0);
  });
});

describe('납입한도 (contributionLimit)', () => {
  it('첫 해 한도는 2,000만원이다', () => {
    expect(isaStrategy.contributionLimit(0, { byYear: {}, total: 0 }, CTX)).toBe(
      20_000_000,
    );
  });

  it('미사용분은 다음 해로 이월된다', () => {
    expect(isaStrategy.contributionLimit(1, { byYear: {}, total: 0 }, CTX)).toBe(
      40_000_000,
    );
  });

  it('이미 납입한 만큼은 한도에서 빠진다', () => {
    expect(
      isaStrategy.contributionLimit(
        1,
        { byYear: { 0: 20_000_000 }, total: 20_000_000 },
        CTX,
      ),
    ).toBe(20_000_000);
  });

  it('총 1억원을 넘지 않는다', () => {
    expect(isaStrategy.contributionLimit(10, { byYear: {}, total: 0 }, CTX)).toBe(
      100_000_000,
    );
  });

  it('총 한도에 도달하면 0원이다', () => {
    expect(
      isaStrategy.contributionLimit(
        10,
        { byYear: {}, total: 100_000_000 },
        CTX,
      ),
    ).toBe(0);
  });

  it('한도를 넘겨 납입한 이력이 있어도 음수를 내지 않는다', () => {
    expect(
      isaStrategy.contributionLimit(0, { byYear: {}, total: 50_000_000 }, CTX),
    ).toBe(0);
  });

  it('기존 가입년차만큼 이월 한도가 시작 시점에 이미 쌓여 있다', () => {
    const ctx: TaxContext = { ...CTX, isaExistingYears: 2 };
    // 0년차인데 이미 2년 지난 계좌 취급 → (0+1+2)년치 = 6,000만원
    expect(isaStrategy.contributionLimit(0, { byYear: {}, total: 0 }, ctx)).toBe(
      60_000_000,
    );
  });

  it('기존 가입년차가 있어도 총 1억원은 넘지 않는다', () => {
    const ctx: TaxContext = { ...CTX, isaExistingYears: 10 };
    expect(isaStrategy.contributionLimit(0, { byYear: {}, total: 0 }, ctx)).toBe(
      100_000_000,
    );
  });
});

describe('보유 가능 상품', () => {
  it('국내 상장 3배 레버리지는 담을 수 없다', () => {
    const resolution = isaStrategy.canHold('NASDAQ100_3X');
    expect(resolution.available).toBe(false);
    if (!resolution.available) expect(resolution.reason).toBe('NOT_LISTED_IN_KR');
  });

  it('SP500 2배는 국내에 환헤지형만 있어 거부한다', () => {
    const resolution = isaStrategy.canHold('SP500_2X');
    expect(resolution.available).toBe(false);
    if (!resolution.available) expect(resolution.reason).toBe('ONLY_HEDGED_IN_KR');
  });
});
