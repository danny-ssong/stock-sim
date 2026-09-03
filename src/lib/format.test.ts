import { describe, it, expect } from 'vitest';
import { formatKrwHuman, formatUsd } from './format';

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
