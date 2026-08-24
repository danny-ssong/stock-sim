import { describe, it, expect } from 'vitest';
import { buildFutureCalendar, buildBacktestCalendar } from './calendar';

describe('buildFutureCalendar', () => {
  const calendar = buildFutureCalendar({ startMonth: '2026-09', months: 24 });

  it('요청한 개월 수만큼 만든다', () => {
    expect(calendar.months).toHaveLength(24);
    expect(calendar.months[0].month).toBe('2026-09');
    expect(calendar.months[23].month).toBe('2028-08');
  });

  it('매수일은 그 달의 첫 평일이다', () => {
    // 2026-09-01은 화요일
    expect(calendar.months[0].buyDate).toBe('2026-09-01');
    // 2026-11-01은 일요일 → 다음 평일 11-02
    const november = calendar.months.find((m) => m.month === '2026-11');
    expect(november?.buyDate).toBe('2026-11-02');
  });

  it('첫 달의 매수 오프셋은 0이다', () => {
    expect(calendar.months[0].buyOffset).toBe(0);
  });

  it('오프셋이 끊김 없이 이어진다', () => {
    for (let i = 1; i < calendar.months.length; i += 1) {
      expect(calendar.months[i].buyOffset).toBe(
        calendar.months[i - 1].endOffset + 1,
      );
    }
    const last = calendar.months[calendar.months.length - 1];
    expect(last.endOffset).toBe(calendar.totalDays - 1);
  });

  it('연차는 시작월 기준 12개월 단위로 올라간다', () => {
    expect(calendar.months[0].yearIndex).toBe(0);
    expect(calendar.months[11].yearIndex).toBe(0);
    expect(calendar.months[12].yearIndex).toBe(1);
  });

  it('각 연차의 마지막 달에만 연말 플래그가 선다', () => {
    const yearEnds = calendar.months.filter((m) => m.isYearEnd);
    expect(yearEnds).toHaveLength(2);
    expect(yearEnds[0].monthIndex).toBe(11);
    expect(yearEnds[1].monthIndex).toBe(23);
  });

  it('연평균 거래일 수가 평일 기준(약 261일)이다', () => {
    expect(calendar.daysPerYear).toBeGreaterThan(255);
    expect(calendar.daysPerYear).toBeLessThan(266);
  });

  it('연말연시 경계에서도 달이 끊기지 않는다', () => {
    const december = calendar.months.find((m) => m.month === '2026-12');
    const january = calendar.months.find((m) => m.month === '2027-01');
    expect(december?.calendarYear).toBe(2026);
    expect(january?.calendarYear).toBe(2027);
    // 2027-01-01은 금요일이라 그날이 첫 거래일이다
    expect(january?.buyDate).toBe('2027-01-01');
  });
});

describe('buildBacktestCalendar', () => {
  // 실제 미국 거래일에는 신정·독립기념일 등 휴장일이 있다
  const dates = [
    '2020-12-30', '2020-12-31',
    '2021-01-04', '2021-01-05', '2021-01-06',
    '2021-02-01', '2021-02-02',
    '2021-03-01', '2021-03-02',
  ];
  const calendar = buildBacktestCalendar({
    dates,
    startMonth: '2021-01',
    months: 3,
  });

  it('1월 1일이 휴장이면 다음 거래일에 매수한다', () => {
    expect(calendar.months[0].month).toBe('2021-01');
    expect(calendar.months[0].buyDate).toBe('2021-01-04');
  });

  it('오프셋은 dates 배열의 인덱스다', () => {
    expect(calendar.months[0].buyOffset).toBe(2);
    expect(calendar.months[0].endOffset).toBe(4);
    expect(calendar.months[1].buyOffset).toBe(5);
    expect(calendar.months[2].buyOffset).toBe(7);
  });

  it('요청한 구간에 거래일이 없는 달이 있으면 던진다', () => {
    expect(() =>
      buildBacktestCalendar({ dates, startMonth: '2021-01', months: 12 }),
    ).toThrow(/거래일/);
  });
});
