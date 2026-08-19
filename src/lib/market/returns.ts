import type { ReturnSource } from '../sim/types';

export type PathReference = {
  from: string;
  to: string;
  /** 참조 구간의 일별 수익률 개수 */
  tradingDays: number;
  /** 시뮬 기간이 참조 구간의 몇 배인지 */
  repeats: number;
};

export type PathResolution =
  | { ok: true; indices: Int32Array; reference: PathReference }
  | {
      ok: false;
      reason: 'BEFORE_LISTING' | 'REFERENCE_TOO_SHORT';
      productId: string;
      availableFrom: string;
      message: string;
      suggestion: ReturnSource;
    };

/** 참조 구간이 못 쓰일 때 제안할 기본 CAGR. 사용자가 즉시 고칠 수 있는 출발점이다. */
const FALLBACK_ANNUAL_RATE = 0.08;

function firstIndexAtOrAfter(dates: string[], date: string): number {
  const index = dates.findIndex((d) => d >= date);
  return index === -1 ? dates.length : index;
}

function lastIndexAtOrBefore(dates: string[], date: string): number {
  for (let i = dates.length - 1; i >= 0; i -= 1) {
    if (dates[i] <= date) return i;
  }
  return -1;
}

/**
 * 참조 구간의 일별 수익률 인덱스를 시뮬 길이만큼 순환시켜 만든다(§5.3).
 *
 * 반환하는 인덱스는 **수익률 배열**의 인덱스다. 수익률 t는 레벨 t와 t−1로
 * 계산되므로 구간 시작일 자체는 쓸 수 없고, 그 다음 날부터 시작한다.
 * 그래서 인덱스는 항상 1 이상이며 NaN인 0번을 밟지 않는다.
 *
 * 상품 수익률과 환율 수익률이 **같은 인덱스 배열**을 공유해야 stripFx가 같은
 * 날짜쌍의 몫을 나눠 환율을 정확히 되벗긴다(Task 11) — 되씌우기는 더 이상
 * 하지 않는다(§2 "환율 처리 방식 확정").
 */
export function resolvePathIndices(params: {
  from: string;
  to: string;
  dates: string[];
  /** 참조 구간에 포함된 모든 상품 중 가장 늦은 데이터 시작일 */
  availableFrom: string;
  productId: string;
  totalDays: number;
}): PathResolution {
  const { from, to, dates, availableFrom, productId, totalDays } = params;

  if (from < availableFrom) {
    return {
      ok: false,
      reason: 'BEFORE_LISTING',
      productId,
      availableFrom,
      message: `${productId}는 ${availableFrom}부터 실제 데이터가 있습니다. ${from}~${to} 구간의 경로가 없어 CAGR 모드로 전환했습니다.`,
      suggestion: { type: 'constantCagr', annualRate: FALLBACK_ANNUAL_RATE },
    };
  }

  const startIndex = firstIndexAtOrAfter(dates, from);
  const endIndex = lastIndexAtOrBefore(dates, to);

  // 수익률은 startIndex + 1 부터 endIndex 까지 존재한다
  const firstReturn = startIndex + 1;
  const referenceLength = endIndex - firstReturn + 1;

  if (referenceLength < 1) {
    return {
      ok: false,
      reason: 'REFERENCE_TOO_SHORT',
      productId,
      availableFrom,
      message: `${from}~${to} 구간에 거래일이 부족해 경로를 재생할 수 없습니다.`,
      suggestion: { type: 'constantCagr', annualRate: FALLBACK_ANNUAL_RATE },
    };
  }

  const indices = new Int32Array(totalDays);
  for (let i = 0; i < totalDays; i += 1) {
    indices[i] = firstReturn + (i % referenceLength);
  }

  return {
    ok: true,
    indices,
    reference: {
      from: dates[startIndex],
      to: dates[endIndex],
      tradingDays: referenceLength,
      repeats: totalDays / referenceLength,
    },
  };
}

/**
 * 연 복리 직선의 일별 수익률.
 *
 * daysPerYear는 시뮬 축의 실제 연평균 거래일 수다. 미래 축은 평일 기준이라
 * 252가 아니라 약 261이 되는데, 252로 나누면 "연 10%"가 10%보다 커진다(계획 D4).
 */
export function buildConstantReturns(
  annualRate: number,
  totalDays: number,
  daysPerYear: number,
): Float64Array {
  const out = new Float64Array(totalDays);
  out.fill((1 + annualRate) ** (1 / daysPerYear) - 1);
  return out;
}

/** 경로 인덱스를 통해 원본 수익률을 읽어 시뮬 길이 배열로 편다. */
export function tileReturns(
  source: Float64Array,
  indices: Int32Array,
): Float64Array {
  const out = new Float64Array(indices.length);
  for (let i = 0; i < indices.length; i += 1) {
    out[i] = source[indices[i]];
  }
  return out;
}

/** "2023-08-01~2026-08-01 구간(3.0년)을 3.3회 반복 적용합니다" 문구(§5.3). */
export function describePath(reference: PathReference): string {
  const years = reference.tradingDays / 252;
  return `${reference.from}~${reference.to} 구간(${years.toFixed(1)}년)을 ${reference.repeats.toFixed(1)}회 반복 적용합니다`;
}
