import { describe, it, expect } from 'vitest';
import { computeDrawdown, findLastCorrectionPeak, type DailyPricePoint } from './drawdown';

function point(date: string, level: number): DailyPricePoint {
  return { date, level };
}

describe('computeDrawdown', () => {
  it('빈 배열이면 null이다', () => {
    expect(computeDrawdown([])).toBeNull();
  });

  it('전역 최대낙폭과 그 고점·저점을 찾는다', () => {
    // 1.0 → 2.0(고점) → 0.5(저점, -75%) → 1.5(작은 낙폭 -25%는 더 크지 않다) → 2.5(회복+갱신)
    const series = [
      point('2000-01-03', 1.0),
      point('2000-02-01', 2.0),
      point('2000-03-01', 0.5),
      point('2000-04-03', 1.5),
      point('2000-05-01', 2.5),
    ];
    const result = computeDrawdown(series);
    expect(result).not.toBeNull();
    if (result === null) return;
    expect(result.maxDrawdown).toBeCloseTo(0.75, 10);
    expect(result.peak.date).toBe('2000-02-01');
    expect(result.trough.date).toBe('2000-03-01');
    expect(result.recovery?.date).toBe('2000-05-01');
    expect(result.recoveryMonths).toBe(3);
  });

  it('월중 저점도 잡는다 — 같은 달 안의 하락도 놓치지 않는다', () => {
    // 3월 한 달 안에서 2.0(고점) → 0.4(저점, -80%) → 1.8(월말)
    const series = [
      point('2000-03-01', 1.0),
      point('2000-03-10', 2.0),
      point('2000-03-20', 0.4),
      point('2000-03-31', 1.8),
    ];
    const result = computeDrawdown(series);
    expect(result?.maxDrawdown).toBeCloseTo(0.8, 10);
    expect(result?.peak.date).toBe('2000-03-10');
    expect(result?.trough.date).toBe('2000-03-20');
  });

  it('시뮬레이션 종료까지 고점을 회복하지 못하면 recovery가 null이다', () => {
    const series = [point('2000-01-03', 1.0), point('2000-02-01', 2.0), point('2000-03-01', 0.3)];
    const result = computeDrawdown(series);
    expect(result?.recovery).toBeNull();
    expect(result?.recoveryMonths).toBeNull();
  });

  it('한 번도 하락하지 않으면 낙폭 0이다', () => {
    const series = [point('2000-01-03', 1.0), point('2000-02-01', 1.2), point('2000-03-01', 1.5)];
    const result = computeDrawdown(series);
    expect(result?.maxDrawdown).toBe(0);
    expect(result?.recovery).toBeNull();
  });
});

describe('findLastCorrectionPeak', () => {
  it('임계치 이상 하락한 가장 최근 고점을 찾는다', () => {
    // 100(고점1) → 85(-15%, 확정) → 120(고점2) → 90(-25%, 확정) → 110(회복 중, 미확정)
    const dates = ['d0', 'd1', 'd2', 'd3', 'd4'];
    const levels = new Float64Array([100, 85, 120, 90, 110]);
    const result = findLastCorrectionPeak(dates, levels, 0.1);
    expect(result).toEqual({ date: 'd2', index: 2 });
  });

  it('임계치를 넘는 하락이 없으면 null이다', () => {
    const dates = ['d0', 'd1', 'd2'];
    const levels = new Float64Array([100, 95, 105]);
    expect(findLastCorrectionPeak(dates, levels, 0.1)).toBeNull();
  });

  it('빈 배열이면 null이다', () => {
    expect(findLastCorrectionPeak([], new Float64Array(0), 0.1)).toBeNull();
  });
});
