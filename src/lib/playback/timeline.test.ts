import { describe, expect, it } from 'vitest';
import {
  buildTimeTicks,
  frameAt,
  timelineBounds,
  toTime,
  type PlaybackSeries,
} from './timeline';

/** 'YYYY-MM-DD' 또는 'YYYY-MM' 목록을 값 1,2,3…인 시리즈로 만든다 */
function series(key: string, dates: readonly string[]): PlaybackSeries {
  return {
    key,
    points: dates.map((date, i) => ({ date, time: toTime(date), value: i + 1 })),
  };
}

describe('toTime', () => {
  it("'YYYY-MM'은 그 달의 1일로 읽는다", () => {
    expect(toTime('2020-03')).toBe(toTime('2020-03-01'));
  });

  it('시간 순서가 문자열 순서와 일치한다', () => {
    expect(toTime('2019-12-31')).toBeLessThan(toTime('2020-01-01'));
  });
});

describe('timelineBounds', () => {
  it('여러 시리즈의 합집합 경계를 낸다', () => {
    const bounds = timelineBounds([
      series('a', ['2020-01-02', '2020-06-01']),
      series('b', ['2019-05', '2021-03']),
    ]);
    expect(bounds).toEqual({ from: toTime('2019-05'), to: toTime('2021-03') });
  });

  it('점이 없는 시리즈는 건너뛴다', () => {
    const bounds = timelineBounds([{ key: 'empty', points: [] }, series('a', ['2020-01', '2020-02'])]);
    expect(bounds).toEqual({ from: toTime('2020-01'), to: toTime('2020-02') });
  });

  it('그릴 점이 하나도 없으면 null을 낸다', () => {
    expect(timelineBounds([])).toBeNull();
    expect(timelineBounds([{ key: 'empty', points: [] }])).toBeNull();
  });
});

describe('frameAt', () => {
  const daily = series('price', ['2020-01-01', '2020-04-01', '2020-07-01', '2020-10-01', '2021-01-01']);
  const monthly = series('asset', ['2020-01', '2020-04', '2020-07', '2020-10', '2021-01']);
  const bounds = { from: toTime('2020-01-01'), to: toTime('2021-01-01') };

  it('progress 0이면 첫 점만 보인다', () => {
    const frame = frameAt([daily], bounds, 0);
    expect(frame.visible[0].count).toBe(1);
  });

  it('progress 1이면 전부 보인다', () => {
    const frame = frameAt([daily], bounds, 1);
    expect(frame.visible[0].count).toBe(5);
    expect(frame.date).toBe('2021-01-01');
  });

  it('해상도가 달라도 같은 시점에서 멈춘다', () => {
    const frame = frameAt([daily, monthly], bounds, 0.5);
    // 절반 지점은 2020-07-01 언저리 — 두 시리즈 모두 3번째 점까지다
    expect(frame.visible[0].count).toBe(3);
    expect(frame.visible[1].count).toBe(3);
  });

  it('아직 시작하지 않은 시리즈는 count가 0이다', () => {
    const late = series('late', ['2020-11-01', '2020-12-01']);
    const frame = frameAt([daily, late], bounds, 0.1);
    expect(frame.visible[1].count).toBe(0);
  });

  it('progress를 0~1로 클램프한다', () => {
    expect(frameAt([daily], bounds, -3).visible[0].count).toBe(1);
    expect(frameAt([daily], bounds, 42).visible[0].count).toBe(5);
  });

  it('원본 배열을 복사하지 않고 그대로 참조한다', () => {
    expect(frameAt([daily], bounds, 0.5).visible[0].points).toBe(daily.points);
  });
});

describe('buildTimeTicks', () => {
  it('구간이 길면 연도 라벨을 낸다', () => {
    const dates = Array.from({ length: 10 }, (_, i) => `${2015 + i}-06-15`);
    const ticks = buildTimeTicks(dates);
    expect(ticks.length).toBeGreaterThan(0);
    expect(ticks.every((tick) => /^\d{4}$/.test(tick.label))).toBe(true);
    expect(ticks[ticks.length - 1].label).toBe('2024');
  });

  it('구간이 짧으면 월 라벨을 낸다', () => {
    const ticks = buildTimeTicks(['2020-01-02', '2020-02-03', '2020-03-02']);
    expect(ticks.map((tick) => tick.label)).toEqual(['2020-01', '2020-02', '2020-03']);
  });

  it('빈 배열이면 빈 배열을 낸다', () => {
    expect(buildTimeTicks([])).toEqual([]);
  });
});
