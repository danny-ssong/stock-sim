import { describe, it, expect } from 'vitest';
import { spliceBackfill } from './splice';

const N = Number.NaN;

describe('spliceBackfill', () => {
  it('실제 데이터 구간은 그대로 보존한다', () => {
    const actual = Float64Array.from([N, N, 100, 110]);
    const synth = Float64Array.from([N, 0.05, 0.05, 0.05]);
    const { values } = spliceBackfill(actual, synth);
    expect(values[2]).toBe(100);
    expect(values[3]).toBe(110);
  });

  it('실제 시작점에서 역방향으로 합성 수익률을 되감는다', () => {
    // 인덱스 2에서 100. 인덱스 2의 합성 수익률이 +25%였다면 인덱스 1은 80이다.
    const actual = Float64Array.from([N, N, 100]);
    const synth = Float64Array.from([N, 0.25, 0.25]);
    const { values } = spliceBackfill(actual, synth);
    expect(values[1]).toBeCloseTo(80, 10);
  });

  it('여러 구간을 연쇄적으로 되감는다', () => {
    const actual = Float64Array.from([N, N, N, 100]);
    const synth = Float64Array.from([N, 0.1, 0.1, 0.1]);
    const { values } = spliceBackfill(actual, synth);
    expect(values[2]).toBeCloseTo(100 / 1.1, 10);
    expect(values[1]).toBeCloseTo(100 / 1.1 / 1.1, 10);
  });

  it('합성 구간의 경계 인덱스를 반환한다', () => {
    const actual = Float64Array.from([N, N, 100, 110]);
    const synth = Float64Array.from([N, 0.05, 0.05, 0.05]);
    const { syntheticBefore } = spliceBackfill(actual, synth);
    expect(syntheticBefore).toBe(2);
  });

  it('실제 데이터가 처음부터 있으면 합성 구간이 없다', () => {
    const actual = Float64Array.from([100, 110]);
    const synth = Float64Array.from([N, 0.05]);
    const { values, syntheticBefore } = spliceBackfill(actual, synth);
    expect(syntheticBefore).toBe(0);
    expect([...values]).toEqual([100, 110]);
  });

  it('실제 데이터가 전혀 없으면 예외를 던진다', () => {
    const actual = Float64Array.from([N, N]);
    const synth = Float64Array.from([N, 0.05]);
    expect(() => spliceBackfill(actual, synth)).toThrow(/실제 데이터가 없/);
  });

  it('되감기 도중 합성 수익률이 NaN이면 그 이전은 NaN이다', () => {
    const actual = Float64Array.from([N, N, N, 100]);
    const synth = Float64Array.from([N, 0.1, N, 0.1]);
    const { values } = spliceBackfill(actual, synth);
    expect(values[2]).toBeCloseTo(100 / 1.1, 10);
    expect(Number.isNaN(values[1])).toBe(true);
  });
});
