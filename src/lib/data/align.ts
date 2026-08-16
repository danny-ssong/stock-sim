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
 * 시계열 중간의 결측을 직전 유효값으로 채운다.
 *
 * 선행 결측(첫 유효값 이전)은 NaN으로 남긴다 — 상장 이전 구간을 뜻하므로
 * 채우면 안 된다. 채운 개수를 함께 반환해 보정 사실을 숨기지 않는다.
 *
 * 미국 거래일 축에 국내 상장 상품을 올리면 한국 휴장일이 구멍으로 남는데,
 * alignFxToAxis가 환율에 대해 이미 같은 규칙(휴장일은 직전 영업일 값)을
 * 쓰고 있으므로 상품 시계열에도 동일하게 적용한다.
 */
export function forwardFillGaps(values: Float64Array): {
  filled: Float64Array;
  filledCount: number;
} {
  const filled = new Float64Array(values.length);
  let last = Number.NaN;
  let filledCount = 0;

  for (let i = 0; i < values.length; i += 1) {
    const v = values[i];
    if (Number.isFinite(v)) {
      last = v;
      filled[i] = v;
    } else if (Number.isFinite(last)) {
      // 직전 유효값이 있을 때만 채운다 — 선행 결측은 그대로 NaN.
      filled[i] = last;
      filledCount += 1;
    } else {
      filled[i] = Number.NaN;
    }
  }

  return { filled, filledCount };
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
