import { z } from 'zod';
import { BACKFILL_START } from '../data/catalog';
import type { IndexExposure } from '../data/types';
import type { AnchoredSchedule, ReturnSource, SimulationInput } from '../sim/types';

/** IndexExposure 타입 자체가 6개 노출로 확정돼 있어(계획 D2), 이 목록은 그 6개를
 *  그대로 나열한다 — US_DIVIDEND_100 등 v1 이전 상품은 카탈로그·타입에서 완전히
 *  삭제됐으므로 여기 걸러낼 대상으로도 남아 있지 않다(구 project-dividend-exclusion-v1
 *  메모리의 "UI에서만 차단" 결정은 폐기됐다). */
export const V1_AVAILABLE_EXPOSURES: readonly IndexExposure[] = [
  'NASDAQ100_1X',
  'NASDAQ100_2X',
  'NASDAQ100_3X',
  'SP500_1X',
  'SP500_2X',
  'SP500_3X',
];
const V1_EXPOSURE_SET = new Set<string>(V1_AVAILABLE_EXPOSURES);
export const DEFAULT_EXPOSURE: IndexExposure = 'NASDAQ100_1X';

function isIndexExposure(value: string): value is IndexExposure {
  return V1_EXPOSURE_SET.has(value);
}

const MANWON = 10_000;

/** 비율(0~1)을 퍼센트 문자열로 직렬화할 때 곱셈이 남기는 부동소수점 노이즈를 자른다.
 *  예: 0.07 * 100 === 7.000000000000001 같은 표기가 URL에 그대로 남는 것을 막는다. */
function roundPercent(rate: number): number {
  return Number((rate * 100).toFixed(4));
}

function manwonToKrw(value: number): number {
  return value * MANWON;
}
function krwToManwon(value: number): number {
  return value / MANWON;
}

function numberParam(raw: string | null, fallback: number): number {
  if (raw === null || raw === '') return fallback;
  return z.coerce.number().finite().catch(fallback).parse(raw);
}

function parseAnchorsManwon(raw: string | null): Record<number, number> {
  if (raw === null || raw === '') return {};
  const anchors: Record<number, number> = {};
  for (const pair of raw.split(',')) {
    const [yearRaw, valueRaw] = pair.split(':');
    if (yearRaw === undefined || valueRaw === undefined) continue;
    const year = Number(yearRaw);
    const value = Number(valueRaw);
    if (Number.isInteger(year) && year >= 0 && Number.isFinite(value)) {
      anchors[year] = manwonToKrw(value);
    }
  }
  return anchors;
}

function serializeAnchorsManwon(anchors: Record<number, number>): string {
  return Object.entries(anchors)
    .map(([year, value]) => `${year}:${krwToManwon(value)}`)
    .join(',');
}

export function parseExposure(raw: string | null): IndexExposure {
  if (raw === null || !isIndexExposure(raw)) return DEFAULT_EXPOSURE;
  return raw;
}

/** 'from' 쿼리값이 데이터가 존재하는 최초 시점(BACKFILL_START)보다 이르면 끌어올린다.
 *  깨진 공유 링크나(§11) 탭 1 ReturnSourceToggle의 `min` 없는 날짜 입력이 `from`을
 *  통해 탭 2로 새는 경우, 데이터 없는 월을 startMonth로 넘기면 buildBacktestCalendar가
 *  크래시한다(calendar.ts) — 파싱 단계에서 조용히 클램프해 막는다. */
function clampToBackfillStart(rawFrom: string): string {
  return rawFrom < BACKFILL_START ? BACKFILL_START : rawFrom;
}

function parseReturnSource(
  params: URLSearchParams,
  context: { today: string },
): ReturnSource {
  if (params.get('src') === 'cagr') {
    return {
      type: 'constantCagr',
      annualRate: numberParam(params.get('r'), 8) / 100,
    };
  }
  return {
    type: 'historicalPath',
    from: params.get('from') ?? BACKFILL_START,
    to: params.get('to') ?? context.today,
    tileMode: 'repeat',
  };
}

export type QueryContext = {
  mode: 'future' | 'backtest';
  /** 'YYYY-MM-DD'. 미래 모드의 시작월과 참조 구간 종료일 기본값에 쓴다. */
  today: string;
};

export type ShareableQuery = {
  input: SimulationInput;
  /** 목표금액(역산 모드, 원 단위). 없으면 null */
  target: number | null;
};

/**
 * URLSearchParams → SimulationInput.
 * 값이 없거나 유효하지 않으면 조용히 기본값으로 폴백한다 — 에러 화면을 띄우지 않는다(§11).
 */
export function parseSimulationQuery(
  params: URLSearchParams,
  context: QueryContext,
): ShareableQuery {
  const contribution: AnchoredSchedule = {
    base: manwonToKrw(numberParam(params.get('m'), 150)),
    growthRate: numberParam(params.get('mg'), 5) / 100,
    anchors: parseAnchorsManwon(params.get('ma')),
  };

  const years = Math.max(1, Math.min(30, Math.round(numberParam(params.get('y'), 15))));
  const exposure = parseExposure(params.get('exp'));
  const returnSource = parseReturnSource(params, { today: context.today });

  const startMonth =
    context.mode === 'backtest'
      ? clampToBackfillStart(params.get('from') ?? BACKFILL_START).slice(0, 7)
      : context.today.slice(0, 7);

  const targetRaw = params.get('target');
  const target = targetRaw === null ? null : manwonToKrw(numberParam(targetRaw, 0));

  return {
    input: {
      mode: context.mode,
      startMonth,
      initialAmount: manwonToKrw(numberParam(params.get('p'), 10_000)),
      years,
      contribution,
      exposure,
      returnSource,
    },
    target,
  };
}

/**
 * SimulationInput → URLSearchParams.
 */
export function serializeSimulationQuery(query: ShareableQuery): URLSearchParams {
  const { input, target } = query;
  const params = new URLSearchParams();

  params.set('p', String(krwToManwon(input.initialAmount)));
  params.set('m', String(krwToManwon(input.contribution.base)));
  params.set('mg', String(roundPercent(input.contribution.growthRate)));
  const ma = serializeAnchorsManwon(input.contribution.anchors);
  if (ma !== '') params.set('ma', ma);

  params.set('y', String(input.years));
  params.set('exp', input.exposure);

  if (input.returnSource.type === 'constantCagr') {
    params.set('src', 'cagr');
    params.set('r', String(roundPercent(input.returnSource.annualRate)));
  } else {
    params.set('src', 'path');
    params.set('from', input.returnSource.from);
    params.set('to', input.returnSource.to);
  }

  if (target !== null) params.set('target', String(krwToManwon(target)));
  return params;
}
