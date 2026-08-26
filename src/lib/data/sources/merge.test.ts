import { describe, it, expect } from 'vitest';
import { mergeRawSeries, mergeEcosSeries } from './merge';
import type { RawSeries } from './yahoo';
import type { EcosSeries } from './ecos';

describe('mergeRawSeries', () => {
  it('겹치는 날짜는 incoming 값으로 덮어쓴다', () => {
    const existing: RawSeries = {
      symbol: 'SPY',
      dates: ['2026-08-24', '2026-08-25'],
      close: [100, 101],
      adjClose: [100, 101],
    };
    const incoming: RawSeries = {
      symbol: 'SPY',
      dates: ['2026-08-25'],
      close: [999],
      adjClose: [999],
    };

    const merged = mergeRawSeries(existing, incoming);

    expect(merged.dates).toEqual(['2026-08-24', '2026-08-25']);
    expect(merged.close).toEqual([100, 999]);
    expect(merged.adjClose).toEqual([100, 999]);
  });

  it('신규 날짜를 뒤에 추가한다', () => {
    const existing: RawSeries = {
      symbol: 'SPY',
      dates: ['2026-08-24'],
      close: [100],
      adjClose: [100],
    };
    const incoming: RawSeries = {
      symbol: 'SPY',
      dates: ['2026-08-25', '2026-08-26'],
      close: [101, 102],
      adjClose: [101, 102],
    };

    const merged = mergeRawSeries(existing, incoming);

    expect(merged.dates).toEqual(['2026-08-24', '2026-08-25', '2026-08-26']);
    expect(merged.close).toEqual([100, 101, 102]);
  });

  it('입력 순서와 무관하게 오름차순으로 정렬한다', () => {
    const existing: RawSeries = {
      symbol: 'SPY',
      dates: ['2026-08-26'],
      close: [102],
      adjClose: [102],
    };
    const incoming: RawSeries = {
      symbol: 'SPY',
      dates: ['2026-08-24', '2026-08-25'],
      close: [100, 101],
      adjClose: [100, 101],
    };

    const merged = mergeRawSeries(existing, incoming);

    expect(merged.dates).toEqual(['2026-08-24', '2026-08-25', '2026-08-26']);
  });

  it('incoming이 비어 있으면 existing을 그대로 반환한다', () => {
    const existing: RawSeries = {
      symbol: 'SPY',
      dates: ['2026-08-24'],
      close: [100],
      adjClose: [100],
    };
    const incoming: RawSeries = { symbol: 'SPY', dates: [], close: [], adjClose: [] };

    const merged = mergeRawSeries(existing, incoming);

    expect(merged.dates).toEqual(['2026-08-24']);
    expect(merged.close).toEqual([100]);
  });
});

describe('mergeEcosSeries', () => {
  it('겹치는 날짜는 incoming 값으로 덮어쓴다', () => {
    const existing: EcosSeries = { dates: ['2026-08-24', '2026-08-25'], values: [1300, 1301] };
    const incoming: EcosSeries = { dates: ['2026-08-25'], values: [9999] };

    const merged = mergeEcosSeries(existing, incoming);

    expect(merged.dates).toEqual(['2026-08-24', '2026-08-25']);
    expect(merged.values).toEqual([1300, 9999]);
  });

  it('신규 날짜를 뒤에 추가한다', () => {
    const existing: EcosSeries = { dates: ['2026-08-24'], values: [1300] };
    const incoming: EcosSeries = { dates: ['2026-08-25'], values: [1301] };

    const merged = mergeEcosSeries(existing, incoming);

    expect(merged.dates).toEqual(['2026-08-24', '2026-08-25']);
    expect(merged.values).toEqual([1300, 1301]);
  });
});
