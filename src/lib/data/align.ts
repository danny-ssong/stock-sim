import type { RawSeries } from './sources/yahoo';
import type { FxSeries } from './sources/ecos';

/**
 * 정규 날짜 축을 만든다.
 * 미국 거래일을 기준으로 삼는다 — 대상 상품 대부분이 미국 상장이기 때문이다.
 */
export function buildDateAxis(source: string[], startDate: string): string[] {
  const unique = new Set(source.filter((d) => d >= startDate));
  return [...unique].sort();
}

export function alignToAxis(
  axis: string[],
  series: RawSeries,
  field: 'close' | 'adjClose',
): Float64Array {
  const values = field === 'close' ? series.close : series.adjClose;
  const lookup = new Map<string, number>();
  for (let i = 0; i < series.dates.length; i += 1) {
    lookup.set(series.dates[i], values[i]);
  }

  const out = new Float64Array(axis.length);
  for (let i = 0; i < axis.length; i += 1) {
    const value = lookup.get(axis[i]);
    out[i] = value === undefined ? Number.NaN : value;
  }
  return out;
}

/**
 * 환율을 축에 맞춘다.
 * 한국 영업일과 미국 거래일이 어긋나므로 직전 영업일 환율로 전진 채움한다.
 * 축의 첫 날짜가 환율 데이터보다 이르면 첫 환율을 사용한다.
 */
export function alignFxToAxis(axis: string[], fx: FxSeries): Float64Array {
  const out = new Float64Array(axis.length);
  if (fx.dates.length === 0) {
    out.fill(Number.NaN);
    return out;
  }

  let cursor = 0;
  let current = fx.rates[0];

  for (let i = 0; i < axis.length; i += 1) {
    while (cursor < fx.dates.length && fx.dates[cursor] <= axis[i]) {
      current = fx.rates[cursor];
      cursor += 1;
    }
    out[i] = current;
  }
  return out;
}
