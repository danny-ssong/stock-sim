import { describe, it, expect } from 'vitest';
import { maxBacktestYears, hasBacktestRange } from './backtest-bounds';

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

describe('hasBacktestRange', () => {
  /** 이 함수는 첫 날짜와 마지막 날짜만 보므로 두 원소로 경계를 표현한다. */
  const dates = ['2006-01-03', '2026-08-21'];

  it('미래 모드는 항상 true다 — 데이터 범위와 무관하다', () => {
    expect(hasBacktestRange({ mode: 'future', startMonth: '2026-08' }, dates)).toBe(true);
  });

  it('시작월부터 1년 이상 있으면 true다', () => {
    expect(hasBacktestRange({ mode: 'backtest', startMonth: '2016-08' }, dates)).toBe(true);
  });

  it('시작월부터 1년이 안 되면 false다 — 엔진이 클램프할 수 없어 크래시한다', () => {
    // 2026-08 ~ 2026-08: maxBacktestYears가 0이라 buildBacktestCalendar가 빈 달을 만난다
    expect(hasBacktestRange({ mode: 'backtest', startMonth: '2026-08' }, dates)).toBe(false);
  });

  it('시작월이 데이터 첫 월보다 이르면 false다', () => {
    expect(hasBacktestRange({ mode: 'backtest', startMonth: '1999-01' }, dates)).toBe(false);
  });

  it('데이터가 비어 있으면 false다 — 첫 원소 접근이 크래시하지 않는다', () => {
    expect(hasBacktestRange({ mode: 'backtest', startMonth: '2016-08' }, [])).toBe(false);
  });

  it('기간이 데이터를 넘어도 true다 — 여기서 막지 않고 엔진이 줄이며 경고한다', () => {
    // 예전 backtestYearsShortfall은 이 조합을 insufficient-data로 막았다.
    // 이제는 simulate()가 effectiveYears로 줄이고 BACKTEST_YEARS_CLAMPED를 낸다.
    expect(hasBacktestRange({ mode: 'backtest', startMonth: '2016-08' }, dates)).toBe(true);
  });
});
