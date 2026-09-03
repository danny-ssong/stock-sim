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
import { maxBacktestMonths } from './backtest-bounds';
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

function buildCalendar(input: SimulationInput, dataset: Dataset, months: number): SimCalendar {
  return input.mode === 'backtest'
    ? buildBacktestCalendar({ dates: dataset.dates, startMonth: input.startMonth, months })
    : buildFutureCalendar({ startMonth: input.startMonth, months });
}

/**
 * 시뮬 구간의 실제 길이(개월).
 *
 * 백테스트는 데이터가 끝나는 달을 넘어갈 수 없다. 예전에는 이 상한을 **연 단위로**
 * 잡아 요청 연수를 통째로 줄였는데(maxBacktestYears), 그러면 시작월에 따라 최신
 * 데이터가 최대 11개월까지 사라졌다 — 2021-11 시작이면 2026-09까지 데이터가 있어도
 * 2025-10에서 끊기는 식이다. 잘리는 양이 `(마지막월 - 시작월 + 1) % 12`에만 달려
 * 있어 프리셋마다 제각각으로 보였다. 지금은 개월 단위로 잘라 마지막 달까지 채운다.
 *
 * 여기서 줄어드는 것은 경고 대상이 아니다. 기간 입력이 정수 연이라 잔여 개월을
 * 표현할 수 없어, 프리셋과 슬라이더가 일부러 올림값을 요청하고(backtestYearsToDataEnd)
 * 이 함수가 데이터 끝에서 정확히 자르는 구조다 — 즉 "5년을 요청했는데 4년 11개월로
 * 줄었다"는 이상 상황이 아니라 정상 동작이라, 경고를 내면 거의 항상 뜬다.
 *
 * 미래 모드는 데이터 범위와 무관하므로 요청한 길이를 그대로 쓴다.
 */
function resolvePeriodMonths(input: SimulationInput, dataset: Dataset): number {
  const requestedMonths = input.years * 12;
  if (input.mode !== 'backtest' || dataset.dates.length === 0) return requestedMonths;

  const availableMonths = maxBacktestMonths(
    input.startMonth,
    dataset.dates[dataset.dates.length - 1],
  );
  // 한 달도 없으면 줄일 곳이 없다 — hasBacktestRange가 이미 걸러낸 조합이므로
  // 여기서 요청값을 그대로 두고 buildBacktestCalendar의 명시적 크래시에 맡긴다.
  if (availableMonths < 1) return requestedMonths;

  return Math.min(requestedMonths, availableMonths);
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
 * 시뮬 구간이 시작되는 오프셋. 달력이 비어 있으면 null이다.
 *
 * 이 값 하나로 일별 축 전체가 정해진다 — `calendar.dailyDates[i]`가
 * `holding.levels[dailyWindowStart + i]`와 짝지어진다. assemble(calendar.ts)이
 * 달마다 거래일을 순서대로 이어 붙이고 buyOffset/endOffset도 같은 축의
 * 오프셋이라, 첫 달 매수일부터 마지막 달 마지막 거래일까지가 빈틈없이
 * 연속하기 때문이다. 백테스트 모드의 holding.levels는 dataset 전체 축(수십 년치)을
 * 담고 있어 이 오프셋 없이는 시뮬 구간을 짚을 수 없다.
 *
 * 이 불변식을 쓰는 곳이 둘(가격 시계열·MDD)이라 여기서 한 번만 이름 붙인다.
 */
function dailyWindowStart(calendar: SimCalendar): number | null {
  return calendar.months.length === 0 ? null : calendar.months[0].buyOffset;
}

/**
 * 포트폴리오 레벨의 일별 시계열. 계좌가 하나뿐이라 이제 이 값은 곧 "선택한
 * 상품 자체의 정규화된 가격 지수"와 같고, 결과화면 상단 "상품 가격 차트"(스펙 §6)가 쓴다.
 *
 * 월별(각 달 매수일) 스냅샷이 아니라 일별인 이유는, 낙폭이 거의 항상 월중에
 * 일어나기 때문이다 — 월별로 떨어뜨리면 카드에 표시된 MDD(buildDailyDrawdown은
 * 원래부터 일별로 계산한다)를 차트에서 확인할 방법이 없어진다.
 * 렌더 비용은 차트 쪽에서 극값 보존 다운샘플링(lib/chart/downsample.ts)으로 감당한다 —
 * 해상도를 여기서 미리 깎으면 어느 점을 버릴지 고를 기회 자체가 사라진다.
 *
 * priceUsd는 별개로, 실제 거래되는 달러 가격이다(원화 환산 없이 그대로).
 * dataset.seriesById는 원화 환산 값(build.ts)이라, 저장 당시 곱한 환율로
 * 다시 나눠 원래 달러 가격을 복원한다. 백테스트 모드는 오프셋이
 * dataset.dates·series·fxRates와 1:1로 대응하는 실제 캘린더 오프셋이라
 * series[offset] / fxRates[offset]가 곧 그 날짜의 실제 달러 가격이다.
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
  const startOffset = dailyWindowStart(calendar);
  if (startOffset === null) return [];
  const futureAnchor = calendar.mode === 'backtest' ? null : lastFiniteUsdPrice(series, fxRates);

  return calendar.dailyDates.map((date, i) => {
    const offset = startOffset + i;
    const level = holding.levels[offset] / holding.levels[startOffset];
    return {
      date,
      level,
      isSynthetic: holding.syntheticFlags[offset] === 1,
      priceUsd:
        calendar.mode === 'backtest'
          ? series[offset] / fxRates[offset]
          : futureAnchor === null
            ? null
            : futureAnchor * level,
    };
  });
}

/**
 * 시뮬 구간의 일별 가격 레벨로 MDD를 계산한다.
 * computeDrawdown은 비율만 보므로 절대 레벨을 다시 정규화할 필요는 없다.
 */
function buildDailyDrawdown(calendar: SimCalendar, holding: LedgerHolding): DrawdownResult | null {
  const startOffset = dailyWindowStart(calendar);
  if (startOffset === null) return null;

  const series: DailyPricePoint[] = calendar.dailyDates.map((date, i) => ({
    date,
    level: holding.levels[startOffset + i],
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

  // 기간 상한은 URL 파싱 시점(schema.ts)에서 대략적으로만 잡혀 있다 — 그때는
  // dataset을 몰라 정확한 상한을 계산할 수 없기 때문이다. 여기서는 dataset을
  // 알고 있으니 실제 데이터 끝에 맞춰 개월 단위로 다시 자른다.
  const periodMonths = resolvePeriodMonths(input, dataset);

  // 구간이 연 단위로 안 떨어질 수 있으므로(마지막 해가 부분 연도) 분수 연수다.
  // resolveConstantRate는 실측 CAGR을 구할 꼬리 구간 길이로만 쓰므로 분수여도 된다.
  const effectiveYears = periodMonths / 12;

  const calendar = buildCalendar(input, dataset, periodMonths);
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
