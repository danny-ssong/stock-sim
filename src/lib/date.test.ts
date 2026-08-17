import { describe, it, expect } from 'vitest';
import { todayInKst } from './date';

describe('todayInKst', () => {
  it('UTC 자정에는 그날 그대로 KST 날짜다', () => {
    const utcMidnight = Date.UTC(2026, 7, 17, 0, 0, 0);
    expect(todayInKst(utcMidnight)).toBe('2026-08-17');
  });

  it('KST 자정 직전(UTC 14:59)은 여전히 전날이다', () => {
    const beforeKstMidnight = Date.UTC(2026, 7, 16, 14, 59, 0);
    expect(todayInKst(beforeKstMidnight)).toBe('2026-08-16');
  });

  it('KST 자정(UTC 15:00)부터는 다음날이다', () => {
    const atKstMidnight = Date.UTC(2026, 7, 16, 15, 0, 0);
    expect(todayInKst(atKstMidnight)).toBe('2026-08-17');
  });
});
