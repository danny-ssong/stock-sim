import { z } from 'zod';
import { BACKFILL_START } from '../data/catalog';
import type { AccountId, IndexExposure } from '../data/types';
import { isAccountId } from '../allocation';
import type {
  Allocation,
  AnchoredSchedule,
  FxAssumption,
  ReturnSource,
  SimulationInput,
} from '../sim/types';

/** US_DIVIDEND_100은 v1에서 제외한다 — 재활성화 조건은 메모리 project-dividend-exclusion-v1 참조 */
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

type AllocEntry = { accountId: AccountId; weight: number };

/** ISA 100%를 v1 기본 배분으로 쓴다 — 별도 계좌 없이도 즉시 계산이 가능한 최소 구성이다. */
const DEFAULT_ALLOC_ENTRIES: AllocEntry[] = [{ accountId: 'ISA', weight: 1 }];

export function parseAllocEntries(raw: string | null): AllocEntry[] {
  if (raw === null || raw === '') return DEFAULT_ALLOC_ENTRIES;

  const entries: AllocEntry[] = [];
  for (const pair of raw.split(',')) {
    const [idRaw, weightRaw] = pair.split(':');
    if (idRaw === undefined || weightRaw === undefined) continue;
    const weight = Number(weightRaw);
    if (isAccountId(idRaw) && Number.isFinite(weight) && weight > 0) {
      entries.push({ accountId: idRaw, weight });
    }
  }
  if (entries.length === 0) return DEFAULT_ALLOC_ENTRIES;

  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  return entries.map((e) => ({ ...e, weight: e.weight / total }));
}

export function parseExposure(raw: string | null): IndexExposure {
  if (raw === null || !isIndexExposure(raw)) return DEFAULT_EXPOSURE;
  return raw;
}

/** {accountId, weight} 배열 → "계좌:정수퍼센트,계좌:정수퍼센트". `alloc` 쿼리
 *  파라미터와 시나리오 URL(scenarios.ts)이 같은 형식을 공유한다. */
export function serializeAllocEntries(
  allocations: readonly { accountId: AccountId; weight: number }[],
): string {
  return allocations.map((a) => `${a.accountId}:${Math.round(a.weight * 100)}`).join(',');
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

function parseFxAssumption(
  raw: string | null,
  context: { mode: 'future' | 'backtest'; defaultFixedFxRate: number },
): FxAssumption {
  const value = raw ?? (context.mode === 'future' ? 'fixed' : 'path');

  if (value === 'path') return { type: 'historicalPath' };
  if (value.startsWith('drift:')) {
    const pct = Number(value.slice('drift:'.length));
    return { type: 'drift', annualRate: Number.isFinite(pct) ? pct / 100 : 0.02 };
  }
  return { type: 'fixed', rate: context.defaultFixedFxRate };
}

function serializeFxAssumption(fx: FxAssumption): string {
  switch (fx.type) {
    case 'fixed':
      return 'fixed';
    case 'historicalPath':
      return 'path';
    case 'drift':
      return `drift:${(fx.annualRate * 100).toFixed(1)}`;
  }
}

/** 현재 모드의 기본 환율 가정과 같으면 URL에 굳이 남기지 않는다 — 탭을 옮겨도
 * 그 탭의 기본값이 자연스럽게 적용되게 한다(D2·D6). 아직 UI에 환율 선택
 * 컨트롤이 없어 input.fxAssumption은 지금은 항상 모드 기본값이지만, 나중에
 * 실제 선택 UI가 붙어도 이 판정은 그대로 유효하다. */
function isDefaultFxForMode(fx: FxAssumption, mode: 'future' | 'backtest'): boolean {
  if (mode === 'future') return fx.type === 'fixed';
  return fx.type === 'historicalPath';
}

export type QueryContext = {
  mode: 'future' | 'backtest';
  /** 'YYYY-MM-DD'. 미래 모드의 시작월과 참조 구간 종료일 기본값에 쓴다. */
  today: string;
  /** fx=fixed일 때 채울 현재 환율(D2) */
  defaultFixedFxRate: number;
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
  const finalYearIncome = manwonToKrw(numberParam(params.get('inc'), 0));
  const isaExistingYears = Math.max(0, Math.round(numberParam(params.get('isaY'), 0)));

  const taxBaseRaw = params.get('base');
  const taxBaseOverride =
    taxBaseRaw === null ? undefined : manwonToKrw(numberParam(taxBaseRaw, 0));

  const years = Math.max(1, Math.min(30, Math.round(numberParam(params.get('y'), 15))));
  const exposure = parseExposure(params.get('exp'));
  const allocations: Allocation[] = parseAllocEntries(params.get('alloc')).map(
    (entry) => ({ ...entry, exposure }),
  );

  const returnSource = parseReturnSource(params, { today: context.today });
  const fxAssumption = parseFxAssumption(params.get('fx'), {
    mode: context.mode,
    defaultFixedFxRate: context.defaultFixedFxRate,
  });

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
      finalYearIncome,
      taxBaseOverride,
      allocations,
      isaExistingYears,
      returnSource,
      fxAssumption,
      realizationStrategy:
        (params.get('harvest') ?? '1') !== '0'
          ? { type: 'annualDeductionHarvest' }
          : { type: 'holdUntilExit' },
      transferEvents: [],
      displayCurrency: params.get('cur') === 'USD' ? 'USD' : 'KRW',
    },
    target,
  };
}

/**
 * SimulationInput → URLSearchParams.
 * includeIncome: false면 inc·ig·ia·base를 아예 담지 않는다 — 소득 노출 없이 공유하는 링크용(§11).
 */
export function serializeSimulationQuery(
  query: ShareableQuery,
  options: { includeIncome?: boolean } = {},
): URLSearchParams {
  const includeIncome = options.includeIncome ?? true;
  const { input, target } = query;
  const params = new URLSearchParams();

  params.set('p', String(krwToManwon(input.initialAmount)));
  params.set('m', String(krwToManwon(input.contribution.base)));
  params.set('mg', String(roundPercent(input.contribution.growthRate)));
  const ma = serializeAnchorsManwon(input.contribution.anchors);
  if (ma !== '') params.set('ma', ma);

  if (includeIncome) {
    params.set('inc', String(krwToManwon(input.finalYearIncome)));
    if (input.taxBaseOverride !== undefined) {
      params.set('base', String(krwToManwon(input.taxBaseOverride)));
    }
  }

  params.set('y', String(input.years));
  if (input.isaExistingYears > 0) {
    params.set('isaY', String(input.isaExistingYears));
  }
  params.set('exp', input.allocations[0]?.exposure ?? DEFAULT_EXPOSURE);
  params.set('alloc', serializeAllocEntries(input.allocations));

  if (input.returnSource.type === 'constantCagr') {
    params.set('src', 'cagr');
    params.set('r', String(roundPercent(input.returnSource.annualRate)));
  } else {
    params.set('src', 'path');
    params.set('from', input.returnSource.from);
    params.set('to', input.returnSource.to);
  }

  if (!isDefaultFxForMode(input.fxAssumption, input.mode)) {
    params.set('fx', serializeFxAssumption(input.fxAssumption));
  }
  params.set(
    'harvest',
    input.realizationStrategy.type === 'annualDeductionHarvest' ? '1' : '0',
  );
  params.set('cur', input.displayCurrency);
  if (target !== null) params.set('target', String(krwToManwon(target)));

  return params;
}
