import { describe, expect, it } from 'vitest';
import { formatYearTick, januaryTicks, shouldShowYearOnlyTicks } from './x-axis';

describe('shouldShowYearOnlyTicks', () => {
  it('36개월(3년) 이하면 false', () => {
    expect(shouldShowYearOnlyTicks(12)).toBe(false);
    expect(shouldShowYearOnlyTicks(36)).toBe(false);
  });

  it('37개월(3년 초과)부터 true', () => {
    expect(shouldShowYearOnlyTicks(37)).toBe(true);
    expect(shouldShowYearOnlyTicks(48)).toBe(true);
  });
});

describe('januaryTicks', () => {
  it('1월(-01)로 끝나는 값만 남긴다', () => {
    const xValues = ['2020-01', '2020-06', '2021-01', '2021-06', '2022-01'];
    expect(januaryTicks(xValues)).toEqual(['2020-01', '2021-01', '2022-01']);
  });

  it('1월 항목이 없으면 빈 배열', () => {
    expect(januaryTicks(['2020-03', '2020-06'])).toEqual([]);
  });
});

describe('formatYearTick', () => {
  it("'YYYY-MM'에서 연도만 남긴다", () => {
    expect(formatYearTick('2020-07')).toBe('2020');
  });
});
