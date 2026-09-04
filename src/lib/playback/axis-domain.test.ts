import { describe, expect, it } from 'vitest';
import type { PlaybackFrame } from './timeline';
import { easeDomain, niceTicks, targetDomain } from './axis-domain';

/** 값 목록을 count개만 보이는 프레임으로 만든다 */
function frame(values: readonly number[], count: number = values.length): PlaybackFrame {
  return {
    date: '2020-01-01',
    time: 0,
    visible: [
      {
        key: 'a',
        points: values.map((value, i) => ({ date: '2020-01-01', time: i, value })),
        count,
      },
    ],
  };
}

describe('targetDomain', () => {
  it('최대값에 헤드룸 8%를 붙인다', () => {
    expect(targetDomain(frame([10, 50, 100]))).toEqual({ min: 0, max: 108 });
  });

  it('count를 넘는 점은 아직 보이지 않으므로 무시한다', () => {
    expect(targetDomain(frame([10, 20, 1000], 2))).toEqual({ min: 0, max: 21.6 });
  });

  it('0을 항상 포함한다 — 원금 대비 크기를 읽는 차트다', () => {
    expect(targetDomain(frame([80, 100])).min).toBe(0);
  });

  it('음수가 있으면 아래쪽으로 넓힌다', () => {
    const domain = targetDomain(frame([-30, 100]));
    expect(domain.min).toBeLessThan(-30);
    expect(domain.max).toBeGreaterThan(100);
  });

  it('보이는 점이 없으면 안전한 기본 도메인을 낸다', () => {
    expect(targetDomain(frame([10, 20], 0))).toEqual({ min: 0, max: 1 });
  });

  it('모든 값이 0이어도 높이가 0인 도메인을 내지 않는다', () => {
    const domain = targetDomain(frame([0, 0]));
    expect(domain.max).toBeGreaterThan(domain.min);
  });

  it('값이 전부 음수여도 0을 포함한다', () => {
    const domain = targetDomain(frame([-50, -20]));
    expect(domain.max).toBe(0);
    expect(domain.min).toBeLessThan(-50);
  });

  it('유한하지 않은 값은 도메인 계산에서 건너뛴다', () => {
    expect(targetDomain(frame([10, Number.NaN, 50]))).toEqual({ min: 0, max: 54 });
  });
});

describe('easeDomain', () => {
  const previous = { min: 0, max: 100 };
  const target = { min: 0, max: 200 };

  it('factor 0이면 이전 도메인 그대로다', () => {
    expect(easeDomain(previous, target, 0)).toEqual(previous);
  });

  it('factor 1이면 목표 도메인에 도달한다', () => {
    expect(easeDomain(previous, target, 1)).toEqual(target);
  });

  it('중간 factor는 선형 보간이다', () => {
    expect(easeDomain(previous, target, 0.25)).toEqual({ min: 0, max: 125 });
  });
});

describe('niceTicks', () => {
  it('1·2·5 계열의 간격을 고른다', () => {
    expect(niceTicks(0, 100, 5)).toEqual([0, 20, 40, 60, 80, 100]);
  });

  it('도메인 안에만 눈금을 둔다', () => {
    const ticks = niceTicks(7, 93, 5);
    expect(ticks[0]).toBeGreaterThanOrEqual(7);
    expect(ticks[ticks.length - 1]).toBeLessThanOrEqual(93);
  });

  it('아주 큰 값에서도 부동소수점 찌꺼기를 남기지 않는다', () => {
    expect(niceTicks(0, 3_000_000_000, 5)).toEqual([
      0, 1_000_000_000, 2_000_000_000, 3_000_000_000,
    ]);
  });

  it('높이가 0이거나 뒤집힌 도메인이면 최소값 하나만 낸다', () => {
    expect(niceTicks(5, 5, 5)).toEqual([5]);
    expect(niceTicks(10, 1, 5)).toEqual([10]);
  });

  it('유한하지 않은 경계는 최소값 하나만 낸다', () => {
    expect(niceTicks(Number.NaN, 100, 5)).toEqual([Number.NaN]);
    expect(niceTicks(0, Number.POSITIVE_INFINITY, 5)).toEqual([0]);
  });
});
