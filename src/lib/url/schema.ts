import { z } from 'zod';
import { BACKFILL_START } from '../data/catalog';
import type { IndexExposure } from '../data/types';
import type { AnchoredSchedule, ReturnSource, SimulationInputBase } from '../sim/types';
import { backtestYearsCap } from '../sim/backtest-bounds';
import { coerceToHistoricalPath } from '../sim/mode-transition';
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
 *  깨진 공유 링크나(§11) ReturnSourceToggle의 `min` 없는 날짜 입력이 `from`을
 *  통해 backtest 모드로 새는 경우, 데이터 없는 월을 startMonth로 넘기면
 *  buildBacktestCalendar가 크래시한다(calendar.ts) — 파싱 단계에서 조용히 클램프해 막는다. */
function clampToBackfillStart(rawFrom: string): string {
  return rawFrom < BACKFILL_START ? BACKFILL_START : rawFrom;
}

function parseReturnSource(
  params: URLSearchParams,
  context: { today: string },
): ReturnSource {
  if (params.get('src') === 'cagr') {
    // r이 없으면 null — "아직 안 고름"이라 실측 CAGR을 따라간다(sim/types.ts).
    // 예전에는 여기서 8%를 기본값으로 넣어, 사용자가 고른 8%와 자동값 8%를
    // 구분할 수 없었다.
    const rawRate = params.get('r');
    return {
      type: 'constantCagr',
      annualRate: rawRate === null || rawRate === '' ? null : numberParam(rawRate, 8) / 100,
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

  // 백테스트는 데이터가 해마다 늘어나므로 상한도 오늘 기준으로 다시 구한다(§13.2) —
  // 고정 상수를 쓰면 그 해를 넘긴 뒤부터 최신 구간이 잘린다. 여기서는 dataset을
  // 모르므로 "데이터가 있을 수 있는 최대 구간"까지만 좁히고, dataset을 아는 곳
  // (BacktestYearsInput)과 엔진이 실제 데이터 끝에 맞춰 더 좁힌다.
  const yearsCap = mode === 'backtest' ? backtestYearsCap(context.today) : MAX_FUTURE_YEARS;
  const years = Math.max(1, Math.min(yearsCap, Math.round(numberParam(params.get('y'), 15))));

  // 노출을 먼저 파싱한다 — 아래 returnSource 교정이 "몇 개를 비교하는가"를 알아야 한다.
  const exposures = parseExposures(params.get('exp'));

  // 백테스트의 시작월은 from에서 파생된다(D3). 클램프한 값을 한 번만 계산해
  // startMonth와, 고정 수익률이 들어온 경우의 재생 구간 시작점에 함께 쓴다.
  const backtestFrom = clampToBackfillStart(params.get('from') ?? BACKFILL_START);
  const rawReturnSource = parseReturnSource(params, { today: context.today });
  const returnSource =
    mode === 'backtest'
      ? coerceToHistoricalPath(rawReturnSource, {
          from: backtestFrom,
          to: params.get('to') ?? context.today,
        })
      : // 노출 2개 이상을 비교할 때도 고정 수익률은 성립하지 않는다 — 엔진이 상품을
        // 보지 않고 원금에 그대로 복리로 붙어(engine.ts), 어떤 노출을 골라도 카드가
        // 바이트 단위로 동일해진다. 백테스트와 같은 이유로 파싱 단계에서 교정한다.
        exposures.length > 1
        ? coerceToHistoricalPath(rawReturnSource, { from: BACKFILL_START, to: context.today })
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
    exposures,
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
    // null(아직 안 고름)은 URL에 싣지 않는다 — 그래야 다시 파싱했을 때도
    // null로 돌아와 실측 CAGR 추적이 이어진다.
    if (base.returnSource.annualRate !== null) {
      params.set('r', String(roundPercent(base.returnSource.annualRate)));
    }
  } else {
    params.set('src', 'path');
    params.set('from', base.returnSource.from);
    params.set('to', base.returnSource.to);
  }

  return params;
}
