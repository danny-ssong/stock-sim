import { describe, it, expect } from 'vitest';
import { formatKrwHuman } from './format';

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
});
