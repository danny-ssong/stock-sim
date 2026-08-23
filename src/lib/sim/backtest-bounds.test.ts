import { describe, it, expect } from 'vitest';
import { maxBacktestYears, backtestYearsShortfall } from './backtest-bounds';

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

describe('backtestYearsShortfall', () => {
  /** 이 함수는 첫 날짜와 마지막 날짜만 보므로 두 원소로 경계를 표현한다. */
  const dates = ['2006-01-03', '2026-08-21'];

  it('미래 모드는 항상 null이다 — 데이터 범위와 무관하다', () => {
    expect(
      backtestYearsShortfall({ mode: 'future', startMonth: '2026-08', years: 30 }, dates),
    ).toBeNull();
  });

  it('기간이 데이터 안에 들어오면 null이다', () => {
    expect(
      backtestYearsShortfall({ mode: 'backtest', startMonth: '2016-08', years: 10 }, dates),
    ).toBeNull();
  });

  it('기간이 데이터를 넘으면 감당 가능한 최대 연수를 낸다', () => {
    expect(
      backtestYearsShortfall({ mode: 'backtest', startMonth: '2016-08', years: 30 }, dates),
    ).toBe(10);
  });

  it('시작월이 데이터 첫 월보다 이르면 0을 낸다', () => {
    expect(
      backtestYearsShortfall({ mode: 'backtest', startMonth: '1999-01', years: 5 }, dates),
    ).toBe(0);
  });

  it('데이터가 비어 있으면 0을 낸다 — 첫 원소 접근이 크래시하지 않는다', () => {
    expect(
      backtestYearsShortfall({ mode: 'backtest', startMonth: '2016-08', years: 5 }, []),
    ).toBe(0);
  });
});
