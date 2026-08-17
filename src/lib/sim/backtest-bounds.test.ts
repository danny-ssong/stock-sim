import { describe, it, expect } from 'vitest';
import { maxBacktestYears } from './backtest-bounds';

describe('maxBacktestYears', () => {
  it('시작월부터 마지막 가용일까지 온전한 연 단위로 몇 년치인지 구한다', () => {
    // 2020-01 ~ 2023-06-15: 2020-01~2023-06은 42개월 → 3년(36개월)만 온전하다
    expect(maxBacktestYears('2020-01', '2023-06-15')).toBe(3);
  });

  it('12개월 미만이면 0이다(1로 올림하지 않는다 — 호출부가 크래시 방지에 이 값을 그대로 쓴다)', () => {
    expect(maxBacktestYears('2026-01', '2026-06-15')).toBe(0);
  });

  it('시작월과 마지막 달이 같은 해 같은 달이면 0이다', () => {
    expect(maxBacktestYears('2026-08', '2026-08-14')).toBe(0);
  });

  it('정확히 연 단위로 떨어지면 그대로 반환한다', () => {
    // 2020-01 ~ 2025-12: 72개월 = 정확히 6년
    expect(maxBacktestYears('2020-01', '2025-12-31')).toBe(6);
  });
});
