import { describe, it, expect } from 'vitest';
import { simulate } from './engine';
import { buildFutureCalendar } from './calendar';
import type { SimulationInput } from './types';
import type { Dataset } from '../data/dataset';
import type { ProductDataFacts } from '../data/manifest';

/** 평일 축 위에 일정 수익률과 고정 환율을 깔아 검증 가능한 데이터셋을 만든다 */
function makeDataset(params: {
  days: number;
  dailyReturn: number;
  fxDailyReturn?: number;
  productIds: string[];
  availableFrom?: string;
  syntheticUntil?: string | null;
}): Dataset {
  const dates: string[] = [];
  const cursor = new Date(Date.UTC(2010, 0, 1));
  while (dates.length < params.days) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const level = (rate: number, start: number): Float64Array => {
    const out = new Float64Array(params.days);
    let value = start;
    for (let i = 0; i < params.days; i += 1) {
      out[i] = value;
      value *= 1 + rate;
    }
    return out;
  };

  const seriesById = new Map<string, Float64Array>();
  const factsById = new Map<string, ProductDataFacts>();
  for (const id of params.productIds) {
    seriesById.set(id, level(params.dailyReturn, 100));
    factsById.set(id, {
      id,
      availableFrom: params.availableFrom ?? dates[0],
      syntheticUntil: params.syntheticUntil ?? null,
      length: params.days,
      filledGapDays: 0,
    });
  }

  return {
    dates,
    fxRates: level(params.fxDailyReturn ?? 0, 1500),
    seriesById,
    factsById,
  };
}

function baseInput(overrides: Partial<SimulationInput> = {}): SimulationInput {
  return {
    mode: 'future',
    startMonth: '2026-09',
    initialAmount: 0,
    years: 2,
    contribution: { base: 1_000_000, growthRate: 0, anchors: {} },
    employmentIncome: { base: 60_000_000, growthRate: 0, anchors: {} },
    allocations: [{ accountId: 'DIRECT_US', exposure: 'NASDAQ100_1X', weight: 1 }],
    returnSource: { type: 'constantCagr', annualRate: 0 },
    fxAssumption: { type: 'fixed', rate: 1500 },
    realizationStrategy: { type: 'holdUntilExit' },
    transferEvents: [],
    displayCurrency: 'KRW',
    ...overrides,
  };
}

const DATASET = makeDataset({ days: 3000, dailyReturn: 0, productIds: ['QQQ'] });

describe('불가능한 조합 거부 (§13)', () => {
  it('ISA + 나스닥 3배는 조용히 대체하지 않고 거부한다', () => {
    const outcome = simulate(
      baseInput({
        allocations: [{ accountId: 'ISA', exposure: 'NASDAQ100_3X', weight: 1 }],
      }),
      DATASET,
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.blockers[0].code).toBe('PRODUCT_UNAVAILABLE');
  });

  it('미래 모드에서 TIGER 레버리지는 거부하고 QLD를 제안한다', () => {
    const outcome = simulate(
      baseInput({
        allocations: [{ accountId: 'ISA', exposure: 'NASDAQ100_2X', weight: 1 }],
      }),
      makeDataset({ days: 3000, dailyReturn: 0, productIds: ['TIGER_NASDAQ100_2X'] }),
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    const blocker = outcome.blockers[0];
    expect(blocker.code).toBe('FX_MODEL_UNCONFIRMED');
    if (blocker.code !== 'FX_MODEL_UNCONFIRMED') return;
    expect(blocker.alternative?.productId).toBe('QLD');
  });

  it('과거 백테스트에서는 TIGER 레버리지를 허용한다', () => {
    const dataset = makeDataset({
      days: 3000,
      dailyReturn: 0,
      productIds: ['TIGER_NASDAQ100_2X'],
    });
    const outcome = simulate(
      baseInput({
        mode: 'backtest',
        startMonth: dataset.dates[0].slice(0, 7),
        allocations: [{ accountId: 'ISA', exposure: 'NASDAQ100_2X', weight: 1 }],
        fxAssumption: { type: 'historicalPath' },
      }),
      dataset,
    );
    expect(outcome.ok).toBe(true);
  });

  it('배분이 비어 있으면 계산하지 않는다', () => {
    const outcome = simulate(baseInput({ allocations: [] }), DATASET);
    expect(outcome.ok).toBe(false);
  });
});

describe('기본 시나리오', () => {
  it('수익률 0이면 최종 평가액이 총 납입액과 같다', () => {
    const outcome = simulate(baseInput(), DATASET);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.result.totalContributed).toBeCloseTo(24_000_000, 4);
    expect(outcome.result.finalBeforeTax).toBeCloseTo(24_000_000, 4);
    expect(outcome.result.totalTax).toBeCloseTo(0, 4);
  });

  it('환율 가정 문구를 항상 낸다 (§5.6)', () => {
    const outcome = simulate(baseInput(), DATASET);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.labels.fxAssumption).toContain('1,500');
  });

  it('배당수익률을 반영하지 않는 상품은 그 사실을 경고로 낸다', () => {
    // QQQ는 dividendYield가 0이다 — 영향이 무시할 수준이라 계산에서 뺐다(계획 D6)
    const outcome = simulate(baseInput(), DATASET);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const warning = outcome.result.warnings.find(
      (w) => w.code === 'DIVIDEND_NOT_MODELED',
    );
    expect(warning).toBeDefined();
    if (warning === undefined || warning.code !== 'DIVIDEND_NOT_MODELED') return;
    expect(warning.productId).toBe('QQQ');
  });

  it('CAGR 연 10%가 2년 뒤 정확히 1.21배가 된다', () => {
    const outcome = simulate(
      baseInput({
        initialAmount: 100_000_000,
        contribution: { base: 0, growthRate: 0, anchors: {} },
        returnSource: { type: 'constantCagr', annualRate: 0.1 },
      }),
      DATASET,
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    // 매수는 첫 거래일 '종가'에 일어나 레벨이 이미 하루치 올라 있으므로,
    // 2년 뒤 배수는 정확히 1.21 / (1 + 일별수익률)이다.
    const calendar = buildFutureCalendar({ startMonth: '2026-09', months: 24 });
    const daily = 1.1 ** (1 / calendar.daysPerYear) - 1;
    expect(outcome.result.finalBeforeTax).toBeCloseTo(
      121_000_000 / (1 + daily),
      2,
    );
    // 하루치 어긋남은 0.1% 미만이다 — 사실상 1.21배다
    expect(outcome.result.finalBeforeTax / 100_000_000).toBeCloseTo(1.21, 2);
  });
});

describe('환율 가정', () => {
  const rising = makeDataset({
    days: 3000,
    dailyReturn: 0.0002,
    fxDailyReturn: 0.0002,
    productIds: ['QQQ'],
  });

  it('fixed는 환율 상승분을 제거해 historicalPath보다 결과가 작다', () => {
    const from = rising.dates[0];
    const to = rising.dates[1000];
    const path = { type: 'historicalPath' as const, from, to, tileMode: 'repeat' as const };

    const fixed = simulate(
      baseInput({ returnSource: path, fxAssumption: { type: 'fixed', rate: 1500 } }),
      rising,
    );
    const historical = simulate(
      baseInput({ returnSource: path, fxAssumption: { type: 'historicalPath' } }),
      rising,
    );

    expect(fixed.ok && historical.ok).toBe(true);
    if (!fixed.ok || !historical.ok) return;
    expect(fixed.result.finalBeforeTax).toBeLessThan(
      historical.result.finalBeforeTax,
    );
  });

  it('참조 구간 문구를 낸다 (§5.3)', () => {
    const outcome = simulate(
      baseInput({
        returnSource: {
          type: 'historicalPath',
          from: rising.dates[0],
          to: rising.dates[1000],
          tileMode: 'repeat',
        },
      }),
      rising,
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.labels.path).toContain('반복 적용');
  });

  it('과거 백테스트 + historicalPath는 실제 원화 시계열을 그대로 재현한다', () => {
    const outcome = simulate(
      baseInput({
        mode: 'backtest',
        startMonth: rising.dates[0].slice(0, 7),
        initialAmount: 100_000_000,
        contribution: { base: 0, growthRate: 0, anchors: {} },
        years: 2,
        returnSource: {
          type: 'historicalPath',
          from: rising.dates[0],
          to: rising.dates[520],
          tileMode: 'repeat',
        },
        fxAssumption: { type: 'historicalPath' },
      }),
      rising,
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const entries = outcome.result.ledger.entries;
    const first = entries[0];
    const last = entries[entries.length - 1];
    const series = rising.seriesById.get('QQQ');
    expect(series).toBeDefined();
    if (series === undefined) return;

    // 되벗기기와 씌우기가 상쇄되므로, 원장 가격 레벨의 비율이
    // 원본 원화 시계열의 같은 구간 비율과 일치해야 한다
    const firstOffset = 0;
    const lastOffset = rising.dates.indexOf(last.date);
    expect(lastOffset).toBeGreaterThan(0);
    expect(last.buyPrice / first.buyPrice).toBeCloseTo(
      series[lastOffset] / series[firstOffset],
      6,
    );
  });

  it('CAGR 모드에서 historicalPath 환율을 고르면 fixed로 폴백하고 경고한다', () => {
    const outcome = simulate(
      baseInput({
        returnSource: { type: 'constantCagr', annualRate: 0.08 },
        fxAssumption: { type: 'historicalPath' },
      }),
      DATASET,
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(
      outcome.result.warnings.some((w) => w.code === 'FX_PATH_UNAVAILABLE'),
    ).toBe(true);
    expect(outcome.result.labels.fxAssumption).toContain('고정');
  });
});

describe('상장 이전 참조 (테스트 케이스 #13)', () => {
  it('참조 구간이 상장일보다 이르면 CAGR로 자동 전환하고 경고한다', () => {
    const dataset = makeDataset({
      days: 3000,
      dailyReturn: 0,
      productIds: ['SCHD'],
      availableFrom: '2015-01-01',
    });

    const outcome = simulate(
      baseInput({
        allocations: [
          { accountId: 'DIRECT_US', exposure: 'US_DIVIDEND_100', weight: 1 },
        ],
        returnSource: {
          type: 'historicalPath',
          from: dataset.dates[0],
          to: dataset.dates[2000],
          tileMode: 'repeat',
        },
      }),
      dataset,
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const warning = outcome.result.warnings.find((w) => w.code === 'BEFORE_LISTING');
    expect(warning).toBeDefined();
    expect(outcome.result.labels.path).toBeNull();
  });

  it('참조 구간에 거래일이 없으면 REFERENCE_TOO_SHORT로 구분해 알린다', () => {
    const dataset = makeDataset({ days: 3000, dailyReturn: 0, productIds: ['QQQ'] });
    const outcome = simulate(
      baseInput({
        returnSource: {
          type: 'historicalPath',
          from: dataset.dates[0],
          to: dataset.dates[0],
          tileMode: 'repeat',
        },
      }),
      dataset,
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(
      outcome.result.warnings.some((w) => w.code === 'REFERENCE_TOO_SHORT'),
    ).toBe(true);
    expect(
      outcome.result.warnings.some((w) => w.code === 'BEFORE_LISTING'),
    ).toBe(false);
  });

  it('폴백 CAGR은 경고에 담아 보낸 제안값과 같은 수익률로 계산한다', () => {
    const dataset = makeDataset({ days: 3000, dailyReturn: 0, productIds: ['QQQ'] });
    const outcome = simulate(
      baseInput({
        initialAmount: 100_000_000,
        contribution: { base: 0, growthRate: 0, anchors: {} },
        returnSource: {
          type: 'historicalPath',
          from: dataset.dates[0],
          to: dataset.dates[0],
          tileMode: 'repeat',
        },
      }),
      dataset,
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const warning = outcome.result.warnings.find(
      (w) => w.code === 'REFERENCE_TOO_SHORT',
    );
    expect(warning).toBeDefined();
    if (warning === undefined || warning.code !== 'REFERENCE_TOO_SHORT') return;
    expect(warning.suggestion.type).toBe('constantCagr');
    if (warning.suggestion.type !== 'constantCagr') return;

    // 원본 시계열은 수익률 0이다 — 제안한 연 수익률이 실제로 적용됐다면 자란다
    const calendar = buildFutureCalendar({ startMonth: '2026-09', months: 24 });
    const daily = (1 + warning.suggestion.annualRate) ** (1 / calendar.daysPerYear) - 1;
    const expected = 100_000_000 * (1 + daily) ** (calendar.totalDays - 1);
    expect(outcome.result.finalBeforeTax).toBeCloseTo(expected, 2);
  });
});

describe('세금 연동', () => {
  const growing = makeDataset({ days: 3000, dailyReturn: 0.0005, productIds: ['QQQ'] });

  it('해외직투 최종 매도에 양도소득세가 붙는다', () => {
    const outcome = simulate(
      baseInput({
        initialAmount: 100_000_000,
        contribution: { base: 0, growthRate: 0, anchors: {} },
        years: 5,
        returnSource: { type: 'constantCagr', annualRate: 0.15 },
      }),
      growing,
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.totalTax).toBeGreaterThan(0);
    expect(outcome.result.finalAfterTax).toBeLessThan(
      outcome.result.finalBeforeTax,
    );
    expect(outcome.result.exitBreakdowns).toHaveLength(1);
    expect(outcome.result.exitBreakdowns[0].accountId).toBe('DIRECT_US');
  });

  it('공제 소진 전략이 holdUntilExit보다 세금이 적다 (테스트 케이스 #2)', () => {
    const build = (strategy: 'annualDeductionHarvest' | 'holdUntilExit') =>
      simulate(
        baseInput({
          initialAmount: 100_000_000,
          contribution: { base: 0, growthRate: 0, anchors: {} },
          years: 20,
          returnSource: { type: 'constantCagr', annualRate: 0.1 },
          realizationStrategy: { type: strategy },
        }),
        makeDataset({ days: 8000, dailyReturn: 0, productIds: ['QQQ'] }),
      );

    const harvest = build('annualDeductionHarvest');
    const hold = build('holdUntilExit');
    expect(harvest.ok && hold.ok).toBe(true);
    if (!harvest.ok || !hold.ok) return;

    expect(harvest.result.totalTax).toBeLessThan(hold.result.totalTax);
    expect(harvest.result.harvest.taxFreeGain).toBeGreaterThan(0);
    expect(harvest.result.harvest.savedTax).toBeCloseTo(
      hold.result.totalTax - harvest.result.totalTax,
      2,
    );
  });

  it('금융소득종합과세를 매 연도 판정한다 (테스트 케이스 #7)', () => {
    const outcome = simulate(
      baseInput({
        years: 3,
        allocations: [
          { accountId: 'DOMESTIC_ETF', exposure: 'NASDAQ100_1X', weight: 1 },
        ],
      }),
      makeDataset({ days: 3000, dailyReturn: 0, productIds: ['TIGER_NASDAQ100'] }),
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.yearlyTax).toHaveLength(3);
    for (const year of outcome.result.yearlyTax) {
      expect(year.employmentIncome).toBe(60_000_000);
    }
    // 분배금만 있는 해는 미발동, 매도 연도만 발동
    expect(outcome.result.yearlyTax[0].comprehensive.applicable).toBe(false);
  });

  it('국내상장 대량 매도는 금융소득종합과세를 발동시킨다', () => {
    const outcome = simulate(
      baseInput({
        initialAmount: 300_000_000,
        contribution: { base: 0, growthRate: 0, anchors: {} },
        years: 10,
        returnSource: { type: 'constantCagr', annualRate: 0.12 },
        allocations: [
          { accountId: 'DOMESTIC_ETF', exposure: 'NASDAQ100_1X', weight: 1 },
        ],
      }),
      makeDataset({ days: 4000, dailyReturn: 0, productIds: ['TIGER_NASDAQ100'] }),
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const finalYear = outcome.result.yearlyTax[outcome.result.yearlyTax.length - 1];
    expect(finalYear.comprehensive.applicable).toBe(true);
    expect(finalYear.comprehensive.additionalTax).toBeGreaterThan(0);
    expect(finalYear.totalTax).toBeGreaterThan(finalYear.withheldTax);
  });

  it('해외직투 배당 원천징수를 원장과 세금에서 이중으로 빼지 않는다', () => {
    // SCHD(dividendYield 3.6%)를 해외직투로 담고 수익률·환율을 0으로 고정한다.
    //
    // 원장은 연말마다 원천징수분만큼 주수를 줄인다(drag = 0.036 × 0.15 = 0.54%).
    // 2년차 연말 행의 평가액은 1년차 drag만 반영된 스냅샷이므로
    //   finalBeforeTax = 1억 × (1 − 0.0054) = 99,460,000원
    // 이 금액에는 원천징수가 이미 빠져 있다. 여기서 세금으로 또 빼면 안 된다.
    const outcome = simulate(
      baseInput({
        initialAmount: 100_000_000,
        contribution: { base: 0, growthRate: 0, anchors: {} },
        years: 2,
        allocations: [
          { accountId: 'DIRECT_US', exposure: 'US_DIVIDEND_100', weight: 1 },
        ],
      }),
      makeDataset({ days: 3000, dailyReturn: 0, productIds: ['SCHD'] }),
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const drag = 0.036 * 0.15;
    const afterOneDrag = 100_000_000 * (1 - drag);
    expect(outcome.result.finalBeforeTax).toBeCloseTo(afterOneDrag, 2);

    // 0년차 원천징수는 이미 평가액에서 빠졌으므로 세금으로 또 빼지 않는다
    expect(outcome.result.yearlyTax[0].totalTax).toBe(0);
    // 마지막 해 원천징수는 실을 다음 달이 없어 평가액에 없다 → 세금으로 뺀다.
    // 평가액이 취득원가보다 낮아 양도차익은 없고, 금융소득도 기준금액 이하다.
    expect(outcome.result.totalTax).toBeCloseTo(afterOneDrag * drag, 2);

    // 결국 2년 × 원천징수 1회씩 — 정확히 두 번, 그 이상도 이하도 아니다
    expect(outcome.result.finalAfterTax).toBeCloseTo(
      100_000_000 * (1 - drag) ** 2,
      2,
    );

    // 원천징수 자체는 사라지지 않는다 — 종합과세 판정에 그대로 흘러들어간다
    const firstYear = outcome.result.yearlyTax[0];
    expect(firstYear.financialIncome).toBeCloseTo(3_600_000, 2);
    expect(firstYear.withheldTax).toBeCloseTo(3_600_000 * 0.15, 2);
    expect(firstYear.comprehensive.applicable).toBe(false);
  });

  it('마지막 해 배당 원천징수와 양도소득세가 모두 최종 금액에 반영된다', () => {
    // 앞선 두 테스트가 못 덮은 조합 — 배당이 있는 해외직투 + 마지막 해에
    // 실제 양도차익이 있는 경우. 원천징수가 빠지지도, 두 번 빠지지도 않아야 한다.
    const drag = 0.036 * 0.15;
    const dataset = makeDataset({
      days: 3000,
      dailyReturn: 0,
      productIds: ['SCHD', 'QQQ'],
    });
    const common = {
      initialAmount: 100_000_000,
      contribution: { base: 0, growthRate: 0, anchors: {} },
      years: 2,
      returnSource: { type: 'constantCagr' as const, annualRate: 0.1 },
    };

    const withDividend = simulate(
      baseInput({
        ...common,
        allocations: [
          { accountId: 'DIRECT_US', exposure: 'US_DIVIDEND_100', weight: 1 },
        ],
      }),
      dataset,
    );
    // 같은 시계열·같은 조건에 배당만 없는 대조군(QQQ는 dividendYield 0)
    const noDividend = simulate(
      baseInput({
        ...common,
        allocations: [
          { accountId: 'DIRECT_US', exposure: 'NASDAQ100_1X', weight: 1 },
        ],
      }),
      dataset,
    );

    expect(withDividend.ok && noDividend.ok).toBe(true);
    if (!withDividend.ok || !noDividend.ok) return;

    // 0년차 drag는 다음 달 평가액부터 실린다 — 대조군보다 정확히 한 번만큼 낮다
    expect(withDividend.result.finalBeforeTax).toBeCloseTo(
      noDividend.result.finalBeforeTax * (1 - drag),
      2,
    );

    // 마지막 해 배당은 원장에 계상되지만 그 원천징수는 평가액에 못 실린다
    const entries = withDividend.result.ledger.entries;
    const finalYearWithholding =
      entries[entries.length - 1].dividendReceived * 0.15;
    expect(finalYearWithholding).toBeGreaterThan(0);

    // 양도소득세 = (평가액 − 취득원가 1억 − 기본공제 250만) × 22%.
    // holdUntilExit이라 step-up이 없다.
    const capitalGainsTax =
      (withDividend.result.finalBeforeTax - 100_000_000 - 2_500_000) * 0.22;
    expect(capitalGainsTax).toBeGreaterThan(0);

    // 최종 세금은 정확히 이 둘의 합이다 — 0년차 원천징수는 여기 없다(평가액에 있다)
    expect(withDividend.result.totalTax).toBeCloseTo(
      finalYearWithholding + capitalGainsTax,
      2,
    );
    expect(withDividend.result.yearlyTax[0].totalTax).toBe(0);
    expect(withDividend.result.yearlyTax[0].withheldTax).toBeGreaterThan(0);
  });

  it('국내상장 배당 원천징수는 원장이 모르므로 그대로 차감한다', () => {
    // 위 케이스의 대조군. TIGER_DIVIDEND(3.5%)는 DOMESTIC_ETF라
    // dividendWithholdingRate가 0이고 원장이 주수를 줄이지 않는다.
    // 따라서 15.4% 원천징수는 오직 세금 쪽에서만 반영되어야 한다.
    const outcome = simulate(
      baseInput({
        initialAmount: 100_000_000,
        contribution: { base: 0, growthRate: 0, anchors: {} },
        years: 2,
        allocations: [
          { accountId: 'DOMESTIC_ETF', exposure: 'US_DIVIDEND_100', weight: 1 },
        ],
      }),
      makeDataset({ days: 3000, dailyReturn: 0, productIds: ['TIGER_DIVIDEND'] }),
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    // 주수가 줄지 않아 평가액은 원금 그대로다
    expect(outcome.result.finalBeforeTax).toBeCloseTo(100_000_000, 2);
    // 2년 × (1억 × 3.5% × 15.4%) = 2 × 539,000원
    const yearlyWithholding = 100_000_000 * 0.035 * 0.154;
    expect(outcome.result.totalTax).toBeCloseTo(yearlyWithholding * 2, 2);
    expect(outcome.result.finalAfterTax).toBeCloseTo(
      100_000_000 - yearlyWithholding * 2,
      2,
    );
  });

  it('마지막 해에는 기본공제 250만원을 한 번만 적용한다', () => {
    // 3년 × 공제 소진 전략. 앞 2년만 250만원씩 수확해 취득원가를 1억 500만원으로
    // 올리고, 마지막 해는 수확 없이 최종 매도에서 공제를 딱 한 번 받는다.
    // 마지막 해에도 수확하면 (2,500,000 × 3 = 750만원 step-up) + 최종 공제 250만원
    // 으로 같은 해에 공제가 두 번 들어간다.
    const outcome = simulate(
      baseInput({
        initialAmount: 100_000_000,
        contribution: { base: 0, growthRate: 0, anchors: {} },
        years: 3,
        returnSource: { type: 'constantCagr', annualRate: 0.1 },
        realizationStrategy: { type: 'annualDeductionHarvest' },
      }),
      makeDataset({ days: 3000, dailyReturn: 0, productIds: ['QQQ'] }),
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const years = outcome.result.yearlyTax;
    expect(years[0].harvestedGain).toBeCloseTo(2_500_000, 6);
    expect(years[1].harvestedGain).toBeCloseTo(2_500_000, 6);
    expect(years[2].harvestedGain).toBe(0);
    expect(outcome.result.harvest.taxFreeGain).toBeCloseTo(5_000_000, 6);

    // 최종 세액 = (평가액 − 취득원가 1억 − step-up 500만 − 기본공제 250만) × 22%
    const expectedTax =
      (outcome.result.finalBeforeTax - 100_000_000 - 5_000_000 - 2_500_000) * 0.22;
    expect(outcome.result.totalTax).toBeCloseTo(expectedTax, 2);
  });

  it('ISA 손익은 금융소득에 합산되지 않는다 (테스트 케이스 #5)', () => {
    const outcome = simulate(
      baseInput({
        initialAmount: 50_000_000,
        contribution: { base: 0, growthRate: 0, anchors: {} },
        years: 10,
        returnSource: { type: 'constantCagr', annualRate: 0.2 },
        allocations: [{ accountId: 'ISA', exposure: 'NASDAQ100_1X', weight: 1 }],
      }),
      makeDataset({ days: 4000, dailyReturn: 0, productIds: ['TIGER_NASDAQ100'] }),
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const finalYear =
      outcome.result.yearlyTax[outcome.result.yearlyTax.length - 1];
    expect(finalYear.financialIncome).toBe(0);
    expect(finalYear.comprehensive.applicable).toBe(false);
  });

  it('ISA 연 2,000만원 한도를 넘겨 납입하지 않는다 (테스트 케이스 #4)', () => {
    const outcome = simulate(
      baseInput({
        years: 2,
        contribution: { base: 5_000_000, growthRate: 0, anchors: {} },
        allocations: [{ accountId: 'ISA', exposure: 'NASDAQ100_1X', weight: 1 }],
      }),
      makeDataset({ days: 3000, dailyReturn: 0, productIds: ['TIGER_NASDAQ100'] }),
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const firstYear = outcome.result.ledger.entries.filter(
      (e) => e.monthIndex < 12,
    );
    const total = firstYear.reduce((sum, e) => sum + e.contribution, 0);
    expect(total).toBe(20_000_000);
  });

  it('ISA 총 1억원 한도는 전 기간 누적으로 걸린다', () => {
    const outcome = simulate(
      baseInput({
        years: 10,
        contribution: { base: 5_000_000, growthRate: 0, anchors: {} },
        allocations: [{ accountId: 'ISA', exposure: 'NASDAQ100_1X', weight: 1 }],
      }),
      makeDataset({ days: 4000, dailyReturn: 0, productIds: ['TIGER_NASDAQ100'] }),
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.totalContributed).toBe(100_000_000);
  });
});

describe('여러 계좌 동시 시뮬', () => {
  it('비중대로 나눠 담고 계좌마다 정산 결과를 낸다', () => {
    const dataset = makeDataset({
      days: 3000,
      dailyReturn: 0,
      productIds: ['QQQ', 'TIGER_NASDAQ100'],
    });

    const outcome = simulate(
      baseInput({
        initialAmount: 20_000_000,
        contribution: { base: 0, growthRate: 0, anchors: {} },
        years: 3,
        returnSource: { type: 'constantCagr', annualRate: 0.1 },
        allocations: [
          { accountId: 'DIRECT_US', exposure: 'NASDAQ100_1X', weight: 0.5 },
          { accountId: 'DOMESTIC_ETF', exposure: 'NASDAQ100_1X', weight: 0.5 },
        ],
      }),
      dataset,
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.exitBreakdowns).toHaveLength(2);
    expect(outcome.result.exitBreakdowns.map((b) => b.accountId)).toEqual([
      'DIRECT_US',
      'DOMESTIC_ETF',
    ]);
    expect(outcome.result.totalContributed).toBeCloseTo(20_000_000, 6);
  });
});
