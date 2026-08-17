import { describe, it, expect } from 'vitest';
import { subtractYears, HISTORICAL_HIGH_PRESETS, YEARS_AGO_PRESETS } from './presets';
import { BACKFILL_START } from '../data/catalog';

describe('subtractYears', () => {
  it('연 단위로 날짜를 뺀다', () => {
    expect(subtractYears('2026-08-14', 20)).toBe('2006-08-14');
    expect(subtractYears('2026-08-14', 1)).toBe('2025-08-14');
  });

  it('데이터 시작일 이전으로는 내려가지 않는다', () => {
    expect(subtractYears('2000-01-01', 20)).toBe(BACKFILL_START);
  });
});

describe('HISTORICAL_HIGH_PRESETS', () => {
  it('전부 데이터 시작일 이후 날짜다', () => {
    for (const preset of HISTORICAL_HIGH_PRESETS) {
      expect(preset.date >= BACKFILL_START).toBe(true);
    }
  });

  it('스펙 §8의 6개 프리셋을 담는다', () => {
    expect(HISTORICAL_HIGH_PRESETS).toHaveLength(6);
  });
});

describe('YEARS_AGO_PRESETS', () => {
  it('스펙 §8의 6개 값을 담는다', () => {
    expect(YEARS_AGO_PRESETS).toEqual([1, 3, 5, 10, 15, 20]);
  });
});
