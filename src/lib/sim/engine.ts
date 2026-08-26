import { getProduct } from '../data/catalog';
import type { Dataset } from '../data/dataset';
import { dailyReturns } from '../data/synthetic';
import { stripFx } from '../market/fx';
import {
  buildConstantReturns,
  resolveConstantRate,
  resolvePathIndices,
  tileReturns,
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
import { maxBacktestYears } from './backtest-bounds';
import { computeDrawdown, type DailyPricePoint, type DrawdownResult } from './drawdown';
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

/** 말단 유효 원화 가격을 환율로 되나눠 실제 달러 가격을 구한다. build.ts의
 *  forwardFillGaps가 전진 채움을 적용하므로 유효값이 하나라도 있으면 사실상
 *  series[length-1]이지만, 앵커 하나가 NaN이면 차트 전체가 깨지므로 방어한다. */
function lastFiniteUsdPrice(series: Float64Array, fxRates: Float64Array): number | null {
  for (let i = series.length - 1; i >= 0; i -= 1) {
    if (Number.isFinite(series[i]) && fxRates[i] > 0) return series[i] / fxRates[i];
  }
  return null;
}

/**
 * 포트폴리오 레벨의 월별 시계열. 계좌가 하나뿐이라 이제 이 값은 곧 "선택한
 * 상품 자체의 정규화된 가격 지수"와 같다 — MDD 계산과 결과화면 상단 "상품
 * 가격 차트"(스펙 §6)가 이 하나의 배열을 함께 쓴다.
 *
 * priceUsd는 별개로, 실제 거래되는 달러 가격이다(원화 환산 없이 그대로).
 * dataset.seriesById는 원화 환산 값(build.ts)이라, 저장 당시 곱한 환율로
 * 다시 나눠 원래 달러 가격을 복원한다. 백테스트 모드는 buyOffset이
 * dataset.dates·series·fxRates와 1:1로 대응하는 실제 캘린더 오프셋이라
 * series[buyOffset] / fxRates[buyOffset]가 곧 그 날짜의 실제 달러 가격이다.
 *
 * 미래 모드는 가상 축이라 그 대응이 없지만, 최신 실제 종가(달러)를 앵커로
 * 정규화 레벨을 비례 확대하면 "지금 이 가격에서 출발해 이 경로대로 가면
 * 그때 이 가격"이라는 읽을 수 있는 축이 된다.
 */
function buildPortfolioIndex(
  calendar: SimCalendar,
  holding: LedgerHolding,
  series: Float64Array,
  fxRates: Float64Array,
): PortfolioIndexPoint[] {
  if (calendar.months.length === 0) return [];
  const startOffset = calendar.months[0].buyOffset;
  const futureAnchor = calendar.mode === 'backtest' ? null : lastFiniteUsdPrice(series, fxRates);

  return calendar.months.map((month) => {
    const level = holding.levels[month.buyOffset] / holding.levels[startOffset];
    return {
      monthIndex: month.monthIndex,
      date: month.month,
      level,
      isSynthetic: holding.syntheticFlags[month.buyOffset] === 1,
      priceUsd:
        calendar.mode === 'backtest'
          ? series[month.buyOffset] / fxRates[month.buyOffset]
          : futureAnchor === null
            ? null
            : futureAnchor * level,
    };
  });
}

/**
 * 시뮬 구간의 일별 가격 레벨로 MDD를 계산한다. holding.levels는 백테스트 모드에서
 * dataset 전체 축(수십 년치)을 담고 있지만, 시뮬 구간은 그 중 calendar.months[0]의
 * buyOffset부터 마지막 달의 endOffset까지다 — 이 구간만 잘라 쓴다.
 * calendar.dailyDates는 같은 구간을 같은 순서로 담고 있어(calendar.ts assemble) 인덱스가
 * 서로 맞는다. computeDrawdown은 비율만 보므로 절대 레벨을 다시 정규화할 필요는 없다.
 */
function buildDailyDrawdown(calendar: SimCalendar, holding: LedgerHolding): DrawdownResult | null {
  if (calendar.months.length === 0) return null;
  const windowStart = calendar.months[0].buyOffset;
  const windowEnd = calendar.months[calendar.months.length - 1].endOffset;
  const dailyLevels = holding.levels.subarray(windowStart, windowEnd + 1);

  const series: DailyPricePoint[] = calendar.dailyDates.map((date, i) => ({
    date,
    level: dailyLevels[i],
  }));
  return computeDrawdown(series);
}

/**
 * 스펙 §5.1 파이프라인을 잇는다. 계좌가 하나뿐이라 여러 holding을 순회하던
 * 구조가 단일 holding으로 줄었고, 환율은 되벗기기만 하고 다시 씌우지 않는다
 * (§2 "환율 처리 방식 확정" — 원화 원금이 달러 수익률만큼 성장한다).
 */
export function simulate(input: SimulationInput, dataset: Dataset): SimulationOutcome {
  const product = getProduct(input.exposure);
  const warnings: SimulationWarning[] = [];

  // years 상한은 URL 파싱 시점(schema.ts)에서 대략적으로만 잡혀 있다 — 그때는
  // dataset을 몰라 정확한 상한을 계산할 수 없기 때문이다. 여기서는 dataset을
  // 알고 있으니 실제 상한(maxBacktestYears)과 다시 비교해, 넘치면 조용히
  // 자르는 대신 경고와 함께 줄인다(§13.2, 경고를 조용히 삼키지 않는다).
  let effectiveYears = input.years;
  if (input.mode === 'backtest' && dataset.dates.length > 0) {
    const available = maxBacktestYears(input.startMonth, dataset.dates[dataset.dates.length - 1]);
    if (available >= 1 && input.years > available) {
      effectiveYears = available;
      warnings.push({
        code: 'BACKTEST_YEARS_CLAMPED',
        requestedYears: input.years,
        availableYears: available,
        message: `선택한 시작월(${input.startMonth})부터는 데이터가 ${available}년치만 있어 요청한 ${input.years}년에서 ${available}년으로 줄였습니다.`,
      });
    }
  }
  const effectiveInput = effectiveYears === input.years ? input : { ...input, years: effectiveYears };

  const calendar = buildCalendar(effectiveInput, dataset);
  const simLength = calendar.mode === 'backtest' ? dataset.dates.length : calendar.totalDays;

  let pathIndices: Int32Array | null = null;
  // null(아직 안 고름)을 여기서 한 번만 해소한다 — 엔진은 dataset을 이미 갖고
  // 있으므로 실측 CAGR을 스스로 구할 수 있다. 덕분에 결과 화면(ResultsView)은
  // 이 값을 미리 채워 넘길 필요가 없다.
  let constantAnnualRate =
    input.returnSource.type === 'constantCagr'
      ? resolveConstantRate(
          dataset.seriesById,
          product.id,
          effectiveYears,
          input.returnSource.annualRate,
        )
      : 0;

  if (calendar.mode === 'backtest') {
    pathIndices = identityIndices(simLength);
    if (input.returnSource.type === 'constantCagr') {
      warnings.push({
        code: 'RETURN_SOURCE_IGNORED',
        requestedAnnualRate: constantAnnualRate,
        message: `과거 백테스트는 그 구간에 실제로 있었던 수익률 경로를 그대로 재현합니다. 선택한 연 ${(constantAnnualRate * 100).toFixed(1)}% 직선 가정은 적용하지 않았습니다.`,
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
    } else {
      warnings.push({
        code: resolution.reason,
        productId: resolution.productId,
        message: resolution.message,
        suggestion: resolution.suggestion,
      });
      if (resolution.suggestion.type === 'constantCagr') {
        // resolution.suggestion은 항상 FALLBACK_ANNUAL_RATE를 구체값으로 담아
        // 만들어지지만(market/returns.ts), 타입상으로는 다른 constantCagr과
        // 똑같이 number | null이다. 해소 지점을 하나로 유지하려고 여기서도
        // resolveConstantRate를 거친다 — null이 아니므로 그대로 반환된다.
        constantAnnualRate = resolveConstantRate(
          dataset.seriesById,
          product.id,
          effectiveYears,
          resolution.suggestion.annualRate,
        );
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
  const portfolioIndex = buildPortfolioIndex(calendar, holding, series, dataset.fxRates);
  const drawdown = buildDailyDrawdown(calendar, holding);

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
      drawdown,
      warnings,
    },
  };
}
