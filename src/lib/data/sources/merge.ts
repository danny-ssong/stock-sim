import type { RawSeries } from './yahoo';
import type { EcosSeries } from './ecos';

function compareDate(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * 기존 캐시와 새로 받은 구간을 날짜 기준으로 upsert 병합한다.
 * 겹치는 날짜는 incoming 값으로 덮어써 소급 수정(예: 배당락 재조정)을 반영하고,
 * 최종 결과는 항상 날짜 오름차순으로 정렬된다.
 */
export function mergeRawSeries(existing: RawSeries, incoming: RawSeries): RawSeries {
  const byDate = new Map<string, { close: number; adjClose: number }>();

  const ingest = (series: RawSeries) => {
    for (let i = 0; i < series.dates.length; i += 1) {
      byDate.set(series.dates[i], { close: series.close[i], adjClose: series.adjClose[i] });
    }
  };
  ingest(existing);
  ingest(incoming);

  const sortedEntries = [...byDate.entries()].sort(([a], [b]) => compareDate(a, b));

  return {
    symbol: incoming.symbol || existing.symbol,
    dates: sortedEntries.map(([date]) => date),
    close: sortedEntries.map(([, value]) => value.close),
    adjClose: sortedEntries.map(([, value]) => value.adjClose),
  };
}

/** RawSeries와 같은 규칙의 upsert 병합을 ECOS 시계열(fx, CPI)에 적용한다. */
export function mergeEcosSeries(existing: EcosSeries, incoming: EcosSeries): EcosSeries {
  const byDate = new Map<string, number>();

  const ingest = (series: EcosSeries) => {
    for (let i = 0; i < series.dates.length; i += 1) {
      byDate.set(series.dates[i], series.values[i]);
    }
  };
  ingest(existing);
  ingest(incoming);

  const sortedEntries = [...byDate.entries()].sort(([a], [b]) => compareDate(a, b));

  return {
    dates: sortedEntries.map(([date]) => date),
    values: sortedEntries.map(([, value]) => value),
  };
}
