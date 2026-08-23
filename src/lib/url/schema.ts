import { z } from 'zod';
import { BACKFILL_START } from '../data/catalog';
import type { IndexExposure } from '../data/types';
import type { AnchoredSchedule, ReturnSource, SimulationInputBase } from '../sim/types';
import { MAX_BACKTEST_YEARS } from '../sim/backtest-bounds';
import { parseExposures, serializeExposures } from './exposures';

/** 미래 설계 기간의 UX 상한 — 데이터 유무와 무관한 제품 결정이다. */
export const MAX_FUTURE_YEARS = 30;

/**
 * 탭 시절에만 존재했던 쿼리 파라미터. 파싱하지 않고, 입력이 갱신될 때 URL에서
 * 지우기만 한다(use-simulation-input.ts) — nuqs는 자기가 관리하는 키만 건드리므로
 * 명시적으로 나열해야 주소창에서 사라진다.
 *
 * - `scenarios`: 노출 목록을 라벨과 함께 들고 있던 파라미터. `exp`로 통합됐다.
 * - `target`: 목표금액 역산. 기능 자체가 삭제됐다.
 */
export const LEGACY_QUERY_KEYS = ['scenarios', 'target'] as const;

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
  /** 'YYYY-MM-DD'. 미래 모드의 시작월과 참조 구간 종료일 기본값에 쓴다. */
  today: string;
};

/**
 * URL이 표현하는 것 전체. 노출은 배열이고 나머지 입력은 그 전부가 공유되므로
 * (비교는 노출만 갈린다) 두 조각으로 나뉜다.
 */
export type SimulationQuery = {
  base: SimulationInputBase;
  /** 항상 1개 이상 MAX_EXPOSURES개 이하 — parseExposures가 보장한다. */
  exposures: IndexExposure[];
};

/** 탭이 사라져 모드가 라우트에서 오지 않으므로 쿼리에서 읽는다. 도메인 타입과 같은
 *  어휘를 쓴다 — past/future 같은 두 번째 어휘를 만들면 매핑 지점이 하나 더 생긴다. */
function parseMode(raw: string | null): SimulationInputBase['mode'] {
  return raw === 'backtest' ? 'backtest' : 'future';
}

/**
 * 백테스트 모드에서 성립하지 않는 고정 수익률을 과거 구간 재생으로 바꾼다.
 *
 * 백테스트는 실제 과거 구간을 걷는 모드라 engine이 고정 수익률을 무시하고
 * RETURN_SOURCE_IGNORED 경고를 낸다. 그런데 UI는 백테스트에서 수익률 소스 토글을
 * 감추므로, 그 조합이 들어오면 사용자가 해소할 방법이 없는 경고만 남는다 — 손으로
 * 고친 공유 링크가 그 상태로 착지하는 것을 파싱 단계에서 막는다(§11 "에러 화면을
 * 띄우지 않는다").
 *
 * 왕복(parse(serialize(x)) === x)도 이것이 보장한다: startMonth는 from에서
 * 파생되는데 직렬화는 historicalPath일 때만 from을 싣기 때문에, 백테스트 + 고정
 * 수익률 조합이 남아 있으면 재파싱에서 startMonth가 BACKFILL_START로 튄다.
 */
export function coerceBacktestReturnSource(
  source: ReturnSource,
  window: { from: string; to: string },
): ReturnSource {
  if (source.type === 'historicalPath') return source;
  return { type: 'historicalPath', from: window.from, to: window.to, tileMode: 'repeat' };
}

/**
 * URLSearchParams → SimulationQuery.
 * 값이 없거나 유효하지 않으면 조용히 기본값으로 폴백한다 — 에러 화면을 띄우지 않는다(§11).
 */
export function parseSimulationQuery(
  params: URLSearchParams,
  context: QueryContext,
): SimulationQuery {
  const mode = parseMode(params.get('mode'));

  const contribution: AnchoredSchedule = {
    base: manwonToKrw(numberParam(params.get('m'), 150)),
    growthRate: numberParam(params.get('mg'), 5) / 100,
    anchors: parseAnchorsManwon(params.get('ma')),
  };

  // 백테스트는 데이터가 해마다 늘어나 30이 더 이상 실제 상한이 아니다(§13.2) —
  // 정확한 상한은 dataset을 아는 곳(backtestYearsShortfall)이 다시 계산한다.
  const yearsCap = mode === 'backtest' ? MAX_BACKTEST_YEARS : MAX_FUTURE_YEARS;
  const years = Math.max(1, Math.min(yearsCap, Math.round(numberParam(params.get('y'), 15))));

  // 백테스트의 시작월은 from에서 파생된다(D3). 클램프한 값을 한 번만 계산해
  // startMonth와, 고정 수익률이 들어온 경우의 재생 구간 시작점에 함께 쓴다.
  const backtestFrom = clampToBackfillStart(params.get('from') ?? BACKFILL_START);
  const rawReturnSource = parseReturnSource(params, { today: context.today });
  const returnSource =
    mode === 'backtest'
      ? coerceBacktestReturnSource(rawReturnSource, {
          from: backtestFrom,
          to: params.get('to') ?? context.today,
        })
      : rawReturnSource;

  const startMonth = mode === 'backtest' ? backtestFrom.slice(0, 7) : context.today.slice(0, 7);

  return {
    base: {
      mode,
      startMonth,
      initialAmount: manwonToKrw(numberParam(params.get('p'), 10_000)),
      years,
      contribution,
      returnSource,
    },
    exposures: parseExposures(params.get('exp')),
  };
}

/**
 * SimulationQuery → URLSearchParams.
 *
 * startMonth는 직렬화하지 않는다 — mode와 from으로부터 파싱 단계에서 파생되는
 * 값이라(D3) 같이 실으면 두 곳에서 계산하는 셈이 된다.
 */
export function serializeSimulationQuery(query: SimulationQuery): URLSearchParams {
  const { base, exposures } = query;
  const params = new URLSearchParams();

  params.set('mode', base.mode);
  params.set('p', String(krwToManwon(base.initialAmount)));
  params.set('m', String(krwToManwon(base.contribution.base)));
  params.set('mg', String(roundPercent(base.contribution.growthRate)));
  const ma = serializeAnchorsManwon(base.contribution.anchors);
  if (ma !== '') params.set('ma', ma);

  params.set('y', String(base.years));
  params.set('exp', serializeExposures(exposures));

  if (base.returnSource.type === 'constantCagr') {
    params.set('src', 'cagr');
    params.set('r', String(roundPercent(base.returnSource.annualRate)));
  } else {
    params.set('src', 'path');
    params.set('from', base.returnSource.from);
    params.set('to', base.returnSource.to);
  }

  return params;
}
