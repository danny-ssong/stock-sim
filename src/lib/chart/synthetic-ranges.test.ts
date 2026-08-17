import { describe, it, expect } from 'vitest';
import { findSyntheticRanges } from './synthetic-ranges';

describe('findSyntheticRanges', () => {
  it('연속된 합성 구간을 하나의 범위로 묶는다', () => {
    const points = [
      { label: '2000-01', isSynthetic: true },
      { label: '2000-02', isSynthetic: true },
      { label: '2000-03', isSynthetic: false },
      { label: '2000-04', isSynthetic: true },
    ];
    expect(findSyntheticRanges(points)).toEqual([
      { x1: '2000-01', x2: '2000-02' },
      { x1: '2000-04', x2: '2000-04' },
    ]);
  });

  it('전부 합성이면 하나의 범위다', () => {
    const points = [
      { label: '2000-01', isSynthetic: true },
      { label: '2000-02', isSynthetic: true },
    ];
    expect(findSyntheticRanges(points)).toEqual([{ x1: '2000-01', x2: '2000-02' }]);
  });

  it('합성 구간이 없으면 빈 배열이다', () => {
    const points = [
      { label: '2000-01', isSynthetic: false },
      { label: '2000-02', isSynthetic: false },
    ];
    expect(findSyntheticRanges(points)).toEqual([]);
  });

  it('빈 배열이면 빈 배열이다', () => {
    expect(findSyntheticRanges([])).toEqual([]);
  });
});
