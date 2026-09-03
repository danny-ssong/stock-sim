import { describe, it, expect } from 'vitest';
import { downsampleExtrema, downsampleByKeys, MAX_RENDERED_POINTS } from './downsample';

/** 한 시리즈짜리 행을 값 배열로 만든다 */
function single(values: number[]): { v: number }[] {
  return values.map((v) => ({ v }));
}
const oneSeries = (row: { v: number }) => [row.v];

describe('downsampleExtrema', () => {
  it('maxPoints 이하면 원본을 그대로 낸다', () => {
    const rows = single([1, 2, 3, 4]);
    expect(downsampleExtrema(rows, oneSeries, 4)).toEqual(rows);
  });

  it('각 버킷의 최고·최저 행만 남긴다', () => {
    // 8행을 버킷 2개(각 4행)로 나눈다 — maxPoints 4 / (2 × 시리즈 1) = 버킷 2개
    const rows = single([10, 5, 20, 12, 8, 30, 3, 15]);
    // 버킷0(10,5,20,12): 최저 5, 최고 20 · 버킷1(8,30,3,15): 최고 30, 최저 3
    // 첫 행(10)과 마지막 행(15)은 항상 남는다
    expect(downsampleExtrema(rows, oneSeries, 4).map((r) => r.v)).toEqual([10, 5, 20, 30, 3, 15]);
  });

  it('전역 최고점과 최저점은 어떤 경우에도 탈락하지 않는다', () => {
    // 완만한 배경에 하루짜리 급등·급락을 심는다 — 균등 샘플링이라면 놓칠 위치다
    const values = Array.from({ length: 400 }, (_, i) => 100 + i * 0.1);
    values[137] = 999;
    values[298] = 1;
    const kept = downsampleExtrema(single(values), oneSeries, 40).map((r) => r.v);

    expect(kept).toContain(999);
    expect(kept).toContain(1);
  });

  it('첫 행과 마지막 행을 남긴다', () => {
    const rows = single([50, 10, 90, 20, 80, 30, 70, 40]);
    const kept = downsampleExtrema(rows, oneSeries, 4);
    expect(kept[0]).toBe(rows[0]);
    expect(kept[kept.length - 1]).toBe(rows[rows.length - 1]);
  });

  it('원본 순서를 지키고 같은 행을 두 번 내지 않는다', () => {
    const rows = single([5, 1, 9, 3, 7, 2, 8, 4, 6, 0, 10, 5]);
    const kept = downsampleExtrema(rows, oneSeries, 6);
    const indices = kept.map((row) => rows.indexOf(row));

    expect(indices).toEqual([...indices].sort((a, b) => a - b));
    expect(new Set(indices).size).toBe(indices.length);
  });

  it('시리즈가 여러 개면 각 시리즈의 극값을 모두 남긴다', () => {
    // 16행 · 2시리즈 · maxPoints 8 → 버킷 2개(각 8행).
    // 앞 버킷에 a의 전역 최고를, 뒤 버킷에 b의 전역 최저를 심어 둘 다 살아남는지 본다.
    const rows = Array.from({ length: 16 }, (_, i) => ({ a: 10 + i, b: 50 - i }));
    rows[2] = { a: 999, b: 48 };
    rows[11] = { a: 21, b: -999 };
    const kept = downsampleExtrema(rows, (row) => [row.a, row.b], 8);

    expect(kept.map((r) => r.a)).toContain(999);
    expect(kept.map((r) => r.b)).toContain(-999);
  });

  it('null과 NaN은 극값 판정에서 무시한다', () => {
    const rows = [
      { v: 10 as number | null },
      { v: null },
      { v: Number.NaN },
      { v: 3 },
      { v: null },
      { v: 50 },
      { v: null },
      { v: 20 },
    ];
    const kept = downsampleExtrema(rows, (row) => [row.v], 4).map((r) => r.v);

    expect(kept).toContain(3);
    expect(kept).toContain(50);
  });

  it('한 버킷이 전부 null이어도 그 버킷만 비우고 넘어간다', () => {
    // 뒤쪽 버킷(4~7)이 통째로 null이다
    const rows = [
      { v: 1 as number | null },
      { v: 2 },
      { v: 7 },
      { v: 4 },
      { v: null },
      { v: null },
      { v: null },
      { v: null },
    ];
    const kept = downsampleExtrema(rows, (row) => [row.v], 4);

    expect(kept.map((r) => r.v)).toEqual([1, 7, null]);
  });

  it('빈 배열이면 빈 배열이다', () => {
    expect(downsampleExtrema<{ v: number }>([], oneSeries, 100)).toEqual([]);
  });

  it('출력이 maxPoints + 2를 넘지 않는다', () => {
    const rows = single(Array.from({ length: 7541 }, () => Math.random()));
    expect(downsampleExtrema(rows, oneSeries, 800).length).toBeLessThanOrEqual(802);
  });
});

describe('downsampleByKeys', () => {
  /** SimLineChart가 넘기는 wide 포맷 한 행 */
  function row(x: string, s0: number | null, s1: number | null) {
    return { x, s0, s1, isSynthetic: false };
  }

  it('지정한 key의 값으로 극값을 판정한다', () => {
    const rows = Array.from({ length: 2000 }, (_, i) => row(`d${i}`, 100 + i * 0.01, 50));
    rows[742] = row('d742', 9999, 50);
    rows[1500] = row('d1500', -9999, 50);

    const kept = downsampleByKeys(rows, ['s0'], 40);
    expect(kept.map((r) => r.x)).toContain('d742');
    expect(kept.map((r) => r.x)).toContain('d1500');
  });

  it('키를 여러 개 주면 각 시리즈의 극값을 모두 남긴다', () => {
    const rows = Array.from({ length: 2000 }, (_, i) => row(`d${i}`, 100, 100));
    rows[300] = row('d300', 9999, 100);
    rows[1700] = row('d1700', 100, -9999);

    const kept = downsampleByKeys(rows, ['s0', 's1'], 40).map((r) => r.x);
    expect(kept).toContain('d300');
    expect(kept).toContain('d1700');
  });

  it('숫자가 아닌 값은 극값 판정에서 제외한다', () => {
    // isSynthetic(boolean)처럼 숫자가 아닌 열을 key로 잘못 넘겨도 터지지 않는다
    const rows = Array.from({ length: 2000 }, (_, i) => row(`d${i}`, i, null));
    expect(() => downsampleByKeys(rows, ['s1', 'isSynthetic'], 40)).not.toThrow();
  });

  it('기본 상한은 MAX_RENDERED_POINTS이고, 그 이하면 원본을 그대로 낸다', () => {
    const rows = Array.from({ length: MAX_RENDERED_POINTS }, (_, i) => row(`d${i}`, i, i));
    expect(downsampleByKeys(rows, ['s0'])).toHaveLength(MAX_RENDERED_POINTS);

    const longer = Array.from({ length: 7541 }, (_, i) => row(`d${i}`, i, i));
    expect(downsampleByKeys(longer, ['s0']).length).toBeLessThanOrEqual(MAX_RENDERED_POINTS + 2);
  });
});
