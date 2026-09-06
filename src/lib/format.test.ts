import { describe, it, expect } from 'vitest';
import { formatContributionPlan, formatKrwHuman, formatUsd } from './format';
import type { SimulationInputBase } from './sim/types';

/** 납입 계획만 보는 함수라, 나머지 필드는 형태만 맞춘 고정값이면 충분하다. */
function inputBase(overrides: {
  initialAmount: number;
  monthly: number;
  years: number;
}): SimulationInputBase {
  return {
    mode: 'future',
    startMonth: '2025-01',
    initialAmount: overrides.initialAmount,
    years: overrides.years,
    contribution: { base: overrides.monthly, growthRate: 0, anchors: {} },
    returnSource: { type: 'constantCagr', annualRate: 0.07 },
  };
}

describe('formatKrwHuman', () => {
  it('1억 이상은 억 단위 소수 둘째 자리까지 표시한다', () => {
    expect(formatKrwHuman(300_000_000)).toBe('3.00억');
    expect(formatKrwHuman(182_000_000)).toBe('1.82억');
  });

  it('1억 미만은 만원 단위 정수로 표시한다', () => {
    expect(formatKrwHuman(41_000_000)).toBe('4,100만원');
    expect(formatKrwHuman(840_000)).toBe('84만원');
  });

  it('음수는 부호를 유지한다', () => {
    expect(formatKrwHuman(-5_000_000)).toBe('-500만원');
  });

  it('0은 0만원이다', () => {
    expect(formatKrwHuman(0)).toBe('0만원');
  });

  it('만원 단위로 먼저 반올림한 뒤 억 단위를 판단한다(경계값)', () => {
    expect(formatKrwHuman(99_995_000)).toBe('1.00억');
    expect(formatKrwHuman(99_994_999)).toBe('9,999만원');
  });

  it('음수도 만원 단위로 반올림한다(0으로 뭉개지지 않는다)', () => {
    expect(formatKrwHuman(-4_000)).toBe('0만원');
    expect(formatKrwHuman(-5_000)).toBe('-1만원');
  });
});

describe('formatUsd', () => {
  it('달러 기호와 소수 둘째 자리로 표시한다', () => {
    expect(formatUsd(59.386)).toBe('$59.39');
    expect(formatUsd(34.6)).toBe('$34.60');
  });

  it('네 자리 이상이면 천 단위 구분자를 넣는다', () => {
    expect(formatUsd(1234.5)).toBe('$1,234.50');
  });
});

describe('formatContributionPlan', () => {
  it('시작 목돈은 수식어 없는 "원금"이 아니라 "초기 원금"으로 부른다', () => {
    // 수식어가 없으면 누적 납입액("총 원금", 수익률의 분모)과 구분되지 않는다.
    const text = formatContributionPlan(
      inputBase({ initialAmount: 100_000_000, monthly: 1_500_000, years: 27 }),
    );
    expect(text).toBe('초기 원금 1.00억, 월 150만원씩 27년 투자');
    expect(text).not.toMatch(/(?<!초기 )원금/);
  });

  it('월 납입이 0이면 월 납입 절을 통째로 뺀다(거치식)', () => {
    expect(formatContributionPlan(inputBase({ initialAmount: 50_000_000, monthly: 0, years: 10 }))).toBe(
      '초기 원금 5,000만원, 10년 투자',
    );
  });

  it('초기 원금이 0이면 그 절을 통째로 뺀다(적립식)', () => {
    expect(formatContributionPlan(inputBase({ initialAmount: 0, monthly: 1_000_000, years: 20 }))).toBe(
      '월 100만원씩 20년 투자',
    );
  });

  it('둘 다 0이면 기간만 남는다', () => {
    expect(formatContributionPlan(inputBase({ initialAmount: 0, monthly: 0, years: 5 }))).toBe('5년 투자');
  });
});
