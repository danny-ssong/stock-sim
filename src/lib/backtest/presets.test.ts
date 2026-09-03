import { describe, it, expect } from 'vitest';
import {
  backtestStartForYears,
  buildHistoricalPeakPresets,
  subtractYears,
  HISTORICAL_HIGH_PRESETS,
  YEARS_AGO_PRESETS,
} from './presets';
import { BACKFILL_START } from '../data/catalog';
import { maxBacktestMonths } from '../sim/backtest-bounds';
import { buildBacktestCalendar } from '../sim/calendar';

/** 1995-01부터 매달 하루씩만 있는 거래일 축. 프리셋 날짜가 전부 이 범위 안에 든다. */
function monthlyAxis(lastMonth: string): string[] {
  const dates: string[] = [];
  for (let index = 1995 * 12; index <= Number(lastMonth.slice(0, 4)) * 12 + Number(lastMonth.slice(5, 7)) - 1; index += 1) {
    const month = String((index % 12) + 1).padStart(2, '0');
    dates.push(`${Math.floor(index / 12)}-${month}-15`);
  }
  return dates;
}

describe('backtestStartForYears', () => {
  it('구간이 데이터 마지막 달에서 끝나도록 시작월을 역산한다', () => {
    // 마지막 달이 2026-09면 10년(120개월) 구간은 2016-10 ~ 2026-09다.
    // 마지막 날짜에서 그냥 10년을 빼면 2016-09가 되어 2026-09가 구간 밖으로 밀려난다.
    expect(backtestStartForYears('2026-09-01', 10)).toBe('2016-10-01');
  });

  it('1년은 마지막 달을 포함한 12개월이다', () => {
    expect(backtestStartForYears('2026-09-01', 1)).toBe('2025-10-01');
  });

  it('데이터 시작일 이전으로는 내려가지 않는다', () => {
    expect(backtestStartForYears('2000-01-31', 20)).toBe(BACKFILL_START);
  });
});

describe('buildHistoricalPeakPresets', () => {
  // 마지막 달을 6월로 잡아 프리셋마다 잔여 개월이 제각각 남게 한다 — 예전에는
  // 이 나머지가 통째로 잘려 프리셋마다 종료 시점이 무작위로 달라 보였다.
  const dates = monthlyAxis('2023-06');
  const lastAvailableDate = dates[dates.length - 1];
  const spy = Float64Array.from(dates.map((_, i) => 100 + i));

  it('모든 프리셋이 데이터 마지막 달까지 닿는다', () => {
    const { presets } = buildHistoricalPeakPresets({ dates, spy, lastAvailableDate });
    expect(presets.length).toBeGreaterThan(0);

    for (const preset of presets) {
      const startMonth = preset.date.slice(0, 7);
      // 엔진과 같은 규칙으로 구간을 정한다: 요청 개월과 잔여 개월 중 작은 쪽
      const months = Math.min(preset.years * 12, maxBacktestMonths(startMonth, lastAvailableDate));
      const calendar = buildBacktestCalendar({ dates, startMonth, months });
      const endMonth = calendar.months[calendar.months.length - 1].month;

      expect(endMonth).toBe(lastAvailableDate.slice(0, 7));
    }
  });

  it('"N년 전" 프리셋도 데이터 마지막 달까지 닿는다 — "N년 전부터 지금까지"라는 뜻이다', () => {
    for (const years of YEARS_AGO_PRESETS) {
      const startMonth = backtestStartForYears(lastAvailableDate, years).slice(0, 7);
      const months = Math.min(years * 12, maxBacktestMonths(startMonth, lastAvailableDate));
      const calendar = buildBacktestCalendar({ dates, startMonth, months });
      const endMonth = calendar.months[calendar.months.length - 1].month;

      expect(endMonth).toBe(lastAvailableDate.slice(0, 7));
      // 클램프 없이 정확히 N년이다 — 시작월을 역산했으므로 잔여 개월이 남지 않는다
      expect(months).toBe(years * 12);
    }
  });
});

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
