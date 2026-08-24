import { cagr } from '../data/calibrate';
import { TRADING_DAYS_PER_YEAR } from '../data/synthetic';
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

/** URL 직렬화(schema.ts의 roundPercent, 퍼센트 소수 4자리)와 같은 정밀도로 미리
 *  반올림해 둔다 — 미래 설계의 CAGR 자동 채움이 setInput → URL 왕복 후 재렌더되어도
 *  값이 그대로 유지되어야, "사용자가 직접 고쳤는지"를 값 비교만으로 판단할 수 있다. */
function roundToUrlPrecision(rate: number): number {
  return Number((rate * 100).toFixed(4)) / 100;
}

/**
 * 시리즈 말단 `years`년 구간의 CAGR. 실제 데이터가 `years`보다 짧으면 있는
 * 전체 기간으로 계산한다(데이터 부족 시 폴백값 대신 "짧더라도 실제 과거 성과"를
 * 보여주는 쪽을 택했다). 상품 가격이든 CPI 지수든 "레벨 시계열"이기만 하면 된다 —
 * computeHistoricalCagr(주식)와 computeHistoricalDiningRate(외식물가) 둘 다 이
 * 수학을 공유한다.
 */
function computeTrailingCagr(series: Float64Array, years: number): number | null {
  if (series.length < 2) return null;

  const requestedDays = Math.round(years * TRADING_DAYS_PER_YEAR);
  const availableDays = series.length - 1;
  const days = Math.min(requestedDays, availableDays);
  if (days < 1) return null;

  const window = series.subarray(series.length - 1 - days);
  const rate = cagr(window, days);
  return Number.isFinite(rate) ? roundToUrlPrecision(rate) : null;
}

/**
 * 선택한 상품의 과거 `years`년치 CAGR — 미래 설계의 고정 수익률 입력의 디폴트값으로 쓴다.
 */
export function computeHistoricalCagr(
  seriesById: Map<string, Float64Array>,
  productId: string,
  years: number,
): number | null {
  const series = seriesById.get(productId);
  if (series === undefined) return null;
  return computeTrailingCagr(series, years);
}

/**
 * 선택한 외식물가 품목의 과거 `years`년치 실측 CPI 평균 상승률 — 외식물가
 * 배지의 상승률 슬라이더 기본값으로 쓴다(useHistoricalDiningRateAutoFill).
 */
export function computeHistoricalDiningRate(
  diningCpiById: Map<string, Float64Array>,
  itemId: string,
  years: number,
): number | null {
  const series = diningCpiById.get(itemId);
  if (series === undefined) return null;
  return computeTrailingCagr(series, years);
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** 달력 평균 연 길이. 거래일 기준 252일/년과 표시 자릿수 안에서 일치한다. */
const CALENDAR_DAYS_PER_YEAR = 365.25;

/**
 * '과거 흐름 재생' 가정을 사용자 문장으로 설명한다(§5.3).
 *
 * 엔진이 만드는 PathReference(거래일 수 기준)가 아니라 달력 기준으로 계산한다 —
 * 이 문장을 쓰는 곳은 입력 패널이고, 입력 패널이 시뮬레이션 결과를 구독하면
 * "입력 패널은 입력만 안다"는 경계가 깨지기 때문이다.
 *
 * to가 데이터 마지막 날짜보다 늦으면 엔진은 잘라 쓰지만 이 문장은 입력값
 * 그대로 말한다. 결과 수치가 아니라 가정 설명이므로 그 오차를 허용한다.
 * from은 schema.ts의 clampToBackfillStart가 파싱 단계에서 이미 클램프한다.
 */
export function describePathAssumption(from: string, to: string, years: number): string {
  const spanDays = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MS_PER_DAY;
  const spanYears = spanDays / CALENDAR_DAYS_PER_YEAR;

  const intro = `${from}~${to}의 실제 일별 수익률을 그대로 재생합니다.`;
  if (!Number.isFinite(spanYears) || spanYears <= 0) return intro;

  const repeats = years / spanYears;
  return `${intro} 구간(${spanYears.toFixed(1)}년)을 ${repeats.toFixed(1)}회 반복해 ${years}년을 채웁니다.`;
}
