import { getProduct } from '../data/catalog';
import type { Dataset } from '../data/dataset';
import { dailyReturns } from '../data/synthetic';
import { stripFx } from '../market/fx';
import {
  buildConstantReturns,
  describePath,
  resolvePathIndices,
  tileReturns,
  type PathReference,
} from '../market/returns';
import { getTaxConstants } from '../tax/constants';
import { getTaxStrategy } from '../tax';
import type { AccountYearState, TaxBreakdown, TaxContext } from '../tax/types';
import {
  buildBacktestCalendar,
  buildFutureCalendar,
  type SimCalendar,
  type SimMonth,
} from './calendar';
import { buildLedger, buildLevels, type LedgerHolding } from './ledger';
import type {
  MonthEntry,
  PortfolioIndexPoint,
  SimulationInput,
  SimulationOutcome,
  SimulationWarning,
  YearTaxSummary,
} from './types';

/** 과거 모드에서 쓰는 항등 경로 — 축을 그대로 밟아 되벗기기가 상쇄된다. */
function identityIndices(length: number): Int32Array {
  const out = new Int32Array(length);
  for (let i = 0; i < length; i += 1) out[i] = i;
  return out;
}

function buildCalendar(input: SimulationInput, dataset: Dataset): SimCalendar {
  const months = input.years * 12;
  return input.mode === 'backtest'
    ? buildBacktestCalendar({ dates: dataset.dates, startMonth: input.startMonth, months })
    : buildFutureCalendar({ startMonth: input.startMonth, months });
}

function yearEndMonths(calendar: SimCalendar): SimMonth[] {
  const byYear = new Map<number, SimMonth>();
  for (const month of calendar.months) byYear.set(month.yearIndex, month);
  return [...byYear.values()];
}

function entriesByMonthIndex(entries: MonthEntry[]): Map<number, MonthEntry> {
  const byMonth = new Map<number, MonthEntry>();
  for (const entry of entries) byMonth.set(entry.monthIndex, entry);
  return byMonth;
}

/**
 * 포트폴리오 레벨의 월별 시계열. 계좌가 하나뿐이라 이제 이 값은 곧 "선택한
 * 상품 자체의 정규화된 가격 지수"와 같다 — MDD 계산과 결과화면 상단 "상품
 * 가격 차트"(스펙 §6)가 이 하나의 배열을 함께 쓴다.
 */
function buildPortfolioIndex(calendar: SimCalendar, holding: LedgerHolding): PortfolioIndexPoint[] {
  if (calendar.months.length === 0) return [];
  const startOffset = calendar.months[0].buyOffset;

  return calendar.months.map((month) => ({
    monthIndex: month.monthIndex,
    date: month.month,
    level: holding.levels[month.buyOffset] / holding.levels[startOffset],
    isSynthetic: holding.syntheticFlags[month.buyOffset] === 1,
  }));
}

/**
 * 스펙 §5.1 파이프라인을 잇는다. 계좌가 하나뿐이라 여러 holding을 순회하던
 * 구조가 단일 holding으로 줄었고, 환율은 되벗기기만 하고 다시 씌우지 않는다
 * (§2 "환율 처리 방식 확정" — 원화 원금이 달러 수익률만큼 성장한다).
 */
export function simulate(input: SimulationInput, dataset: Dataset): SimulationOutcome {
  const product = getProduct(input.exposure);
  const warnings: SimulationWarning[] = [];
  const calendar = buildCalendar(input, dataset);
  const simLength = calendar.mode === 'backtest' ? dataset.dates.length : calendar.totalDays;

  let pathIndices: Int32Array | null = null;
  let pathReference: PathReference | null = null;
  let constantAnnualRate =
    input.returnSource.type === 'constantCagr' ? input.returnSource.annualRate : 0;

  if (calendar.mode === 'backtest') {
    pathIndices = identityIndices(simLength);
    if (input.returnSource.type === 'constantCagr') {
      warnings.push({
        code: 'RETURN_SOURCE_IGNORED',
        requestedAnnualRate: input.returnSource.annualRate,
        message: `과거 백테스트는 그 구간에 실제로 있었던 수익률 경로를 그대로 재현합니다. 선택한 연 ${(input.returnSource.annualRate * 100).toFixed(1)}% 직선 가정은 적용하지 않았습니다.`,
      });
    }
  } else if (input.returnSource.type === 'historicalPath') {
    const availableFrom = dataset.factsById.get(product.id)?.availableFrom ?? dataset.dates[0];
    const resolution = resolvePathIndices({
      from: input.returnSource.from,
      to: input.returnSource.to,
      dates: dataset.dates,
      availableFrom,
      productId: product.id,
      totalDays: simLength,
    });

    if (resolution.ok) {
      pathIndices = resolution.indices;
      pathReference = resolution.reference;
    } else {
      warnings.push({
        code: resolution.reason,
        productId: resolution.productId,
        message: resolution.message,
        suggestion: resolution.suggestion,
      });
      if (resolution.suggestion.type === 'constantCagr') {
        constantAnnualRate = resolution.suggestion.annualRate;
      }
    }
  }

  const series = dataset.seriesById.get(product.id);
  if (series === undefined) {
    throw new Error(`데이터셋에 없는 상품입니다: ${product.id}`);
  }

  // 원화 수익률에서 환율 몫을 빼 달러 수익률만 남긴다. 다시 씌우지 않는다.
  const historicalFxReturns = dailyReturns(dataset.fxRates);
  const localReturns =
    pathIndices === null
      ? buildConstantReturns(constantAnnualRate, simLength, calendar.daysPerYear)
      : stripFx(
          tileReturns(dailyReturns(series), pathIndices),
          tileReturns(historicalFxReturns, pathIndices),
        );

  const syntheticUntil = dataset.factsById.get(product.id)?.syntheticUntil ?? null;
  const syntheticFlags = new Uint8Array(simLength);
  if (syntheticUntil !== null && pathIndices !== null) {
    for (let i = 0; i < simLength; i += 1) {
      syntheticFlags[i] = dataset.dates[pathIndices[i]] <= syntheticUntil ? 1 : 0;
    }
  }

  const holding: LedgerHolding = {
    accountId: 'DIRECT_US',
    productId: product.id,
    levels: buildLevels(localReturns),
    syntheticFlags,
  };

  const ledger = buildLedger({
    calendar,
    holding,
    contribution: input.contribution,
    initialAmount: input.initialAmount,
  });
  const portfolioIndex = buildPortfolioIndex(calendar, holding);

  const entryByMonth = entriesByMonthIndex(ledger.entries);
  const yearEnds = yearEndMonths(calendar);
  const lastYearIndex = yearEnds.length - 1;

  const yearlyTax: YearTaxSummary[] = [];
  const exitBreakdowns: TaxBreakdown[] = [];
  let stepUp = 0;
  let harvestedGainTotal = 0;
  let totalTax = 0;
  const strategy = getTaxStrategy('DIRECT_US');

  for (let yearIndex = 0; yearIndex <= lastYearIndex; yearIndex += 1) {
    const yearEndMonth = yearEnds[yearIndex];
    const entry = entryByMonth.get(yearEndMonth.monthIndex);
    if (entry === undefined) continue;

    const calendarYear = yearEndMonth.calendarYear;
    const ctx: TaxContext = { constants: getTaxConstants(calendarYear) };
    const isFinalYear = yearIndex === lastYearIndex;

    const state: AccountYearState = {
      yearIndex, calendarYear, accountId: 'DIRECT_US', productId: product.id,
      marketValue: entry.marketValue, costBasis: entry.costBasis + stepUp,
      realizedGain: 0, heldYears: yearIndex + 1, isFinalYear,
    };

    const annual = strategy.annualTax(state, ctx);
    stepUp += annual.costBasisStepUp;
    let yearTax = annual.tax;

    if (isFinalYear) {
      const exit = strategy.exitTax({ ...state, costBasis: entry.costBasis + stepUp }, ctx);
      exitBreakdowns.push(exit);
      yearTax += exit.tax;
    }

    totalTax += yearTax;
    harvestedGainTotal += annual.realizedGain;
    yearlyTax.push({ yearIndex, calendarYear, harvestedGain: annual.realizedGain, totalTax: yearTax });
  }

  const lastMonthIndex = calendar.months[calendar.months.length - 1].monthIndex;
  const finalEntry = entryByMonth.get(lastMonthIndex);
  const finalBeforeTax = finalEntry?.marketValue ?? 0;
  const totalContributed = ledger.entries.reduce((sum, e) => sum + e.contribution, 0);

  return {
    ok: true,
    result: {
      ledger, yearlyTax, exitBreakdowns, finalBeforeTax,
      finalAfterTax: finalBeforeTax - totalTax, totalContributed, totalTax,
      harvest: {
        taxFreeGain: harvestedGainTotal,
        savedTax: harvestedGainTotal * getTaxConstants(calendar.months[0].calendarYear).overseasCapitalGainsRate,
      },
      syntheticRatio: ledger.syntheticRatio,
      portfolioIndex,
      warnings,
      labels: { path: pathReference === null ? null : describePath(pathReference) },
    },
  };
}
