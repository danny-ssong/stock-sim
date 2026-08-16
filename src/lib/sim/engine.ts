import { resolveFutureSimulation } from '../data/catalog';
import type { Dataset } from '../data/dataset';
import type { Product } from '../data/types';
import { dailyReturns } from '../data/synthetic';
import {
  applyFx,
  buildAssumedFxReturns,
  buildFxLevels,
  describeFxAssumption,
  stripFx,
} from '../market/fx';
import {
  buildConstantReturns,
  describePath,
  resolvePathIndices,
  tileReturns,
  type PathReference,
} from '../market/returns';
import { getTaxConstants } from '../tax/constants';
import { calculateComprehensiveTax } from '../tax/comprehensive';
import { getTaxStrategy } from '../tax';
import type { AccountYearState, TaxBreakdown, TaxContext } from '../tax/types';
import {
  buildBacktestCalendar,
  buildFutureCalendar,
  type SimCalendar,
  type SimMonth,
} from './calendar';
import { buildLedger, buildLevels, type LedgerHolding } from './ledger';
import { resolveAtYear } from './schedule';
import type {
  Allocation,
  FxAssumption,
  MonthEntry,
  SimulationInput,
  SimulationOutcome,
  SimulationWarning,
  YearTaxSummary,
} from './types';

type ResolvedHolding = { allocation: Allocation; product: Product };

/** [1] 계좌 × 노출 → 상품 확정. 불가능한 조합은 조용히 대체하지 않고 거부한다(§13). */
function resolveHoldings(input: SimulationInput): {
  holdings: ResolvedHolding[];
  blockers: SimulationWarning[];
} {
  const holdings: ResolvedHolding[] = [];
  const blockers: SimulationWarning[] = [];

  for (const allocation of input.allocations) {
    const resolution = getTaxStrategy(allocation.accountId).canHold(
      allocation.exposure,
    );
    if (!resolution.available) {
      blockers.push({
        code: 'PRODUCT_UNAVAILABLE',
        accountId: allocation.accountId,
        exposure: allocation.exposure,
        message: resolution.message,
      });
      continue;
    }

    if (input.mode === 'future') {
      const future = resolveFutureSimulation(resolution.product);
      if (!future.allowed) {
        blockers.push({
          code: 'FX_MODEL_UNCONFIRMED',
          productId: resolution.product.id,
          message: future.message,
          alternative: future.alternative,
        });
        continue;
      }
    }

    holdings.push({ allocation, product: resolution.product });
  }

  return { holdings, blockers };
}

function buildCalendar(input: SimulationInput, dataset: Dataset): SimCalendar {
  const months = input.years * 12;
  return input.mode === 'backtest'
    ? buildBacktestCalendar({
        dates: dataset.dates,
        startMonth: input.startMonth,
        months,
      })
    : buildFutureCalendar({ startMonth: input.startMonth, months });
}

/** 과거 모드에서 쓰는 항등 경로 — 축을 그대로 밟아 되벗기기/씌우기가 상쇄된다. */
function identityIndices(length: number): Int32Array {
  const out = new Int32Array(length);
  for (let i = 0; i < length; i += 1) out[i] = i;
  return out;
}

/** 연차별 마지막 달. 세금은 이 시점의 원장 상태로 계산한다. */
function yearEndMonths(calendar: SimCalendar): SimMonth[] {
  const byYear = new Map<number, SimMonth>();
  for (const month of calendar.months) byYear.set(month.yearIndex, month);
  return [...byYear.values()];
}

/**
 * 월 → 그 달의 원장 행들. 행은 holdings 순서 그대로 쌓이므로
 * 배열 인덱스가 곧 holding 인덱스다(같은 계좌·상품이 두 번 배분돼도 안 섞인다).
 */
function groupEntriesByMonth(entries: MonthEntry[]): Map<number, MonthEntry[]> {
  const byMonth = new Map<number, MonthEntry[]>();
  for (const entry of entries) {
    const bucket = byMonth.get(entry.monthIndex);
    if (bucket === undefined) byMonth.set(entry.monthIndex, [entry]);
    else bucket.push(entry);
  }
  return byMonth;
}

/**
 * 스펙 §5.1의 파이프라인 [1]~[7]을 잇는다.
 *
 * 새 계산 규칙을 만들지 않고 앞선 순수 함수들을 조립만 한다. 두 모드가 같은
 * 코드를 타되 배열 길이 규약만 다르다 — 과거 모드는 날짜 축 전체 위의 항등
 * 경로를, 미래 모드는 달력 길이만큼 순환시킨 경로를 쓴다. 과거 모드가 축
 * 전체를 쓰는 이유는 buildBacktestCalendar가 내는 오프셋이 dates의 절대
 * 인덱스이기 때문이다.
 */
export function simulate(
  input: SimulationInput,
  dataset: Dataset,
): SimulationOutcome {
  const { holdings, blockers } = resolveHoldings(input);
  if (blockers.length > 0 || holdings.length === 0) {
    return { ok: false, blockers };
  }

  const warnings: SimulationWarning[] = [];
  const calendar = buildCalendar(input, dataset);

  // 과거 모드는 달력 오프셋이 dates의 절대 인덱스라 축 전체 길이로 배열을 잡는다.
  const simLength =
    calendar.mode === 'backtest' ? dataset.dates.length : calendar.totalDays;

  // [2] 경로 인덱스 — 상품과 환율이 같은 배열을 공유해야 되벗기기가 상쇄된다
  let pathIndices: Int32Array | null = null;
  let pathReference: PathReference | null = null;
  /**
   * 경로를 못 밟을 때 대신 쓰는 직선 CAGR의 연 수익률.
   * 참조 구간 해석에 실패하면 resolvePathIndices가 제안한 값을 그대로 채택해,
   * 경고에 적힌 대체 가정과 실제 계산이 어긋나지 않게 한다.
   */
  let constantAnnualRate =
    input.returnSource.type === 'constantCagr' ? input.returnSource.annualRate : 0;

  if (calendar.mode === 'backtest') {
    pathIndices = identityIndices(simLength);
  } else if (input.returnSource.type === 'historicalPath') {
    // 여러 상품을 함께 담으면 가장 늦게 상장한 상품이 참조 구간을 제한한다
    const latestAvailable = holdings
      .map(
        (h) => dataset.factsById.get(h.product.id)?.availableFrom ?? dataset.dates[0],
      )
      .reduce((a, b) => (a > b ? a : b));

    const resolution = resolvePathIndices({
      from: input.returnSource.from,
      to: input.returnSource.to,
      dates: dataset.dates,
      availableFrom: latestAvailable,
      productId: holdings[0].product.id,
      totalDays: simLength,
    });

    if (resolution.ok) {
      pathIndices = resolution.indices;
      pathReference = resolution.reference;
    } else {
      // 실패 사유를 그대로 옮긴다 — 하나로 뭉뚱그리면 사용자에게 오분류된다
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

  // [2-1] 환율 가정. 재생할 경로가 없으면 fixed로 폴백하되 조용히 넘어가지 않는다
  let fxAssumption: FxAssumption = input.fxAssumption;
  if (fxAssumption.type === 'historicalPath' && pathIndices === null) {
    const todayRate = dataset.fxRates[dataset.fxRates.length - 1];
    fxAssumption = { type: 'fixed', rate: todayRate };
    warnings.push({
      code: 'FX_PATH_UNAVAILABLE',
      message: `재생할 환율 경로가 없어 오늘 환율 ${Math.round(todayRate).toLocaleString('ko-KR')}원 고정으로 계산했습니다.`,
    });
  }

  const historicalFxReturns = dailyReturns(dataset.fxRates);
  const assumedFxReturns = buildAssumedFxReturns({
    assumption: fxAssumption,
    historicalFxReturns,
    pathIndices,
    totalDays: simLength,
    daysPerYear: calendar.daysPerYear,
  });

  const startRate =
    fxAssumption.type === 'fixed'
      ? fxAssumption.rate
      : dataset.fxRates[
          pathIndices === null ? dataset.fxRates.length - 1 : pathIndices[0]
        ];
  const fxLevels = buildFxLevels(assumedFxReturns, startRate);

  const overseasWithholdingRate = getTaxConstants(calendar.months[0].calendarYear)
    .overseasDividendWithholdingRate;

  // [2-2] 상품별 시뮬 수익률 — 되벗기고 가정된 환율을 다시 씌운다
  const ledgerHoldings: LedgerHolding[] = holdings.map(({ allocation, product }) => {
    const series = dataset.seriesById.get(product.id);
    if (series === undefined) {
      throw new Error(`데이터셋에 없는 상품입니다: ${product.id}`);
    }

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

    return {
      accountId: allocation.accountId,
      productId: product.id,
      weight: allocation.weight,
      levels: buildLevels(applyFx(localReturns, assumedFxReturns)),
      syntheticFlags,
      dividendYield: product.dividendYield,
      dividendWithholdingRate:
        allocation.accountId === 'DIRECT_US' ? overseasWithholdingRate : 0,
    };
  });

  // 배당 비중이 작은 상품은 계산에 반영하지 않는다(계획 D6). 결과가 실제보다
  // 약간 낮게(보수적으로) 나올 수 있다는 사실을 조용히 삼키지 않고 알린다.
  for (const { product } of holdings) {
    if (product.dividendYield === 0) {
      warnings.push({
        code: 'DIVIDEND_NOT_MODELED',
        productId: product.id,
        message: `${product.displayName}는 배당수익률이 낮아 계산에 반영하지 않습니다. 실제로는 소액의 배당소득이 있을 수 있습니다.`,
      });
    }
  }

  // [3][4] 월별 원장. ISA 납입한도는 콜백으로 주입한다.
  // contributionLimit이 반환하는 값은 "지금 남은 여력"이므로 그대로 상한이 된다 —
  // 이미 납입한 총액(contributedTotal)을 넘겨야 총 1억원 한도가 제대로 걸린다.
  const baseCtx: TaxContext = {
    constants: getTaxConstants(calendar.months[0].calendarYear),
    realizationStrategy: input.realizationStrategy,
  };
  const ledger = buildLedger({
    calendar,
    holdings: ledgerHoldings,
    contribution: input.contribution,
    initialAmount: input.initialAmount,
    fxLevels,
    monthlyCap: (accountId, yearIndex, _contributedThisYear, contributedTotal) =>
      getTaxStrategy(accountId).contributionLimit(
        yearIndex,
        { byYear: {}, total: contributedTotal },
        baseCtx,
      ),
  });

  // [5][6] 연 단위 세금 — 계좌별 전략을 돌린 뒤 계좌 횡단으로 종합과세를 판정한다
  const entriesByMonth = groupEntriesByMonth(ledger.entries);
  const yearEnds = yearEndMonths(calendar);
  const lastYearIndex = yearEnds.length - 1;

  const yearlyTax: YearTaxSummary[] = [];
  const exitBreakdowns: TaxBreakdown[] = [];
  /** 기본공제 소진 전략이 매년 올려 둔 취득원가. 원장은 이를 모른다 */
  const stepUpByHolding = ledgerHoldings.map(() => 0);
  let harvestedGainTotal = 0;
  let totalTax = 0;

  for (let yearIndex = 0; yearIndex <= lastYearIndex; yearIndex += 1) {
    const yearEndMonth = yearEnds[yearIndex];
    const monthEntries = entriesByMonth.get(yearEndMonth.monthIndex) ?? [];

    const calendarYear = yearEndMonth.calendarYear;
    const constants = getTaxConstants(calendarYear);
    const ctx: TaxContext = {
      constants,
      realizationStrategy: input.realizationStrategy,
    };
    const isFinalYear = yearIndex === lastYearIndex;

    /**
     * 마지막 해의 annualTax에만 쓰는 컨텍스트.
     *
     * 해외주식 기본공제 250만원은 **연 1회**다. 같은 해에 '공제 소진 수확'과
     * '최종 매도'가 각각 공제를 받으면 250만원이 두 번 빠진다. 마지막 해에는
     * 실현 전략을 꺼서 수확을 건너뛰고, 남은 이익 전체를 exitTax 한 번으로
     * — 공제도 한 번만 — 정산한다. 배당·원천징수 처리는 realizationStrategy와
     * 무관하므로 이 해에도 그대로 계산된다.
     */
    const annualCtx: TaxContext = isFinalYear
      ? { constants, realizationStrategy: { type: 'holdUntilExit' } }
      : ctx;

    let financialIncome = 0;
    let withheldTax = 0;
    let confirmedTax = 0;
    let harvestedThisYear = 0;

    for (let h = 0; h < ledgerHoldings.length; h += 1) {
      const holding = ledgerHoldings[h];
      const entry = monthEntries[h];
      if (entry === undefined) continue;

      const state: AccountYearState = {
        yearIndex,
        calendarYear,
        accountId: holding.accountId,
        productId: holding.productId,
        // 연말 평가액. 배당 상품의 연말 행은 원천징수 반영 전 스냅샷이며
        // 그 차이는 다음 달 평가액에 자연히 흡수된다(MonthEntry.marketValue 주석).
        marketValue: entry.marketValue,
        costBasis: entry.costBasis + stepUpByHolding[h],
        dividendIncome: entry.dividendReceived,
        realizedGain: 0,
        heldYears: yearIndex + 1,
        isFinalYear,
      };

      const strategy = getTaxStrategy(holding.accountId);
      const annual = strategy.annualTax(state, annualCtx);
      stepUpByHolding[h] += annual.costBasisStepUp;
      harvestedThisYear += annual.realizedGain;
      financialIncome += annual.financialIncome;
      withheldTax += annual.withheldTax;
      // 배당 원천징수를 원장이 이미 '주수 감소'로 반영한 상품(해외직투 배당주)은
      // 그 세금만큼 평가액이 이미 줄어 있다. 여기서 또 빼면 같은 15%를 두 번
      // 무는 셈이라 최종 세후 금액이 과소평가된다. 국내상장·ISA는 원장이
      // 원천징수를 반영하지 않으므로(dividendWithholdingRate 0) 그대로 뺀다.
      if (holding.dividendWithholdingRate === 0) confirmedTax += annual.tax;

      if (isFinalYear) {
        // 양도소득세는 원장이 전혀 반영하지 않으므로 항상 그대로 뺀다.
        // 그 해 step-up까지 반영한 취득원가로 정산한다.
        const exit = strategy.exitTax(
          { ...state, costBasis: entry.costBasis + stepUpByHolding[h] },
          ctx,
        );
        exitBreakdowns.push(exit);
        financialIncome += exit.financialIncome;
        withheldTax += exit.withheldTax;
        confirmedTax += exit.tax;
      }
    }

    const employmentIncome = resolveAtYear(input.employmentIncome, yearIndex);
    const comprehensive = calculateComprehensiveTax(
      {
        calendarYear,
        yearIndex,
        employmentIncome,
        taxBaseOverride: input.taxBaseOverride,
        financialIncome,
        withheldTax,
      },
      constants,
    );

    // confirmedTax에 이미 원천징수분이 들어 있고 additionalTax는 그 초과분만
    // 남기므로 둘을 더해도 이중 계산이 되지 않는다.
    const yearTotal = confirmedTax + comprehensive.additionalTax;
    totalTax += yearTotal;
    harvestedGainTotal += harvestedThisYear;

    yearlyTax.push({
      yearIndex,
      calendarYear,
      employmentIncome,
      financialIncome,
      withheldTax,
      harvestedGain: harvestedThisYear,
      comprehensive,
      totalTax: yearTotal,
    });
  }

  // [7] 요약
  const lastMonthIndex = calendar.months[calendar.months.length - 1].monthIndex;
  const finalEntries = entriesByMonth.get(lastMonthIndex) ?? [];
  const finalBeforeTax = finalEntries.reduce((sum, e) => sum + e.marketValue, 0);
  const totalContributed = ledger.entries.reduce((sum, e) => sum + e.contribution, 0);

  return {
    ok: true,
    result: {
      ledger,
      yearlyTax,
      exitBreakdowns,
      finalBeforeTax,
      finalAfterTax: finalBeforeTax - totalTax,
      totalContributed,
      totalTax,
      harvest: {
        taxFreeGain: harvestedGainTotal,
        // 실현하지 않았다면 최종 매도에서 그대로 양도소득세를 물었을 금액이다
        savedTax: harvestedGainTotal * baseCtx.constants.overseasCapitalGainsRate,
      },
      syntheticRatio: ledger.syntheticRatio,
      warnings,
      labels: {
        fxAssumption: describeFxAssumption(fxAssumption),
        path: pathReference === null ? null : describePath(pathReference),
      },
    },
  };
}
