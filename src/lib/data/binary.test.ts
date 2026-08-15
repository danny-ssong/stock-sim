import { describe, it, expect } from 'vitest';
import { encodeSeries, decodeSeries } from './binary';

describe('encodeSeries / decodeSeries', () => {
  it('왕복 후 f32 정밀도 내에서 값이 보존된다', () => {
    const input = Float64Array.from([1.5, 2.25, 1000.125]);
    const decoded = decodeSeries(encodeSeries(input));
    expect(decoded[0]).toBeCloseTo(1.5, 5);
    expect(decoded[2]).toBeCloseTo(1000.125, 3);
  });

  it('값당 4바이트를 사용한다', () => {
    const buffer = encodeSeries(new Float64Array(100));
    expect(buffer.byteLength).toBe(400);
  });

  it('NaN을 보존한다 — 합성 불가 구간을 뜻한다', () => {
    const decoded = decodeSeries(encodeSeries(Float64Array.from([Number.NaN, 1])));
    expect(Number.isNaN(decoded[0])).toBe(true);
    expect(decoded[1]).toBe(1);
  });
});
