import { describe, it, expect, vi } from 'vitest';
import { simulate } from './engine';
import { buildFutureCalendar } from './calendar';
import { isaStrategy } from '../tax/strategies/isa';
import { makeDataset, baseInput } from './__fixtures__/simulation';

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

describe('환율 레벨의 출발점', () => {
  // 오늘 환율(2,733원)과 참조 구간 시작 환율(1,500원)이 크게 벌어지는 데이터셋
  const drifting = makeDataset({
    days: 3000,
    dailyReturn: 0,
    fxDailyReturn: 0.0002,
    productIds: ['QQQ'],
  });
  const todayRate = drifting.fxRates[drifting.fxRates.length - 1];
  const path = {
    type: 'historicalPath' as const,
    from: drifting.dates[0],
    to: drifting.dates[1000],
    tileMode: 'repeat' as const,
  };

  it('미래 모드는 참조 구간과 무관하게 오늘 환율에서 출발한다', () => {
    // 출발점은 환율 가정의 문제다 — 수익률 소스로 historicalPath를 골랐다고
    // 해서 몇 년 전 환율에서 미래를 시작할 이유가 없다.
    const outcome = simulate(
      baseInput({
        returnSource: path,
        fxAssumption: { type: 'drift', annualRate: 0.02 },
      }),
      drifting,
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const calendar = buildFutureCalendar({ startMonth: '2026-09', months: 24 });
    const daily = 1.02 ** (1 / calendar.daysPerYear) - 1;
    const firstMonthEnd = calendar.months[0].endOffset;
    expect(outcome.result.ledger.entries[0].fxRate).toBeCloseTo(
      todayRate * (1 + daily) ** (firstMonthEnd + 1),
      6,
    );
    // 참조 구간 시작 시점의 환율(1,500원)에서 출발하지 않는다
    expect(outcome.result.ledger.entries[0].fxRate).toBeGreaterThan(
      drifting.fxRates[0] * 1.5,
    );
  });

  it('과거 백테스트는 그 시점에 실제로 서 있던 환율에서 출발한다', () => {
    const outcome = simulate(
      baseInput({
        mode: 'backtest',
        startMonth: drifting.dates[0].slice(0, 7),
        fxAssumption: { type: 'drift', annualRate: 0.02 },
      }),
      drifting,
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    // 축의 첫 환율(1,500원) 근처에서 시작한다 — 오늘 환율이 아니다
    expect(outcome.result.ledger.entries[0].fxRate).toBeLessThan(
      drifting.fxRates[0] * 1.01,
    );
    expect(outcome.result.ledger.entries[0].fxRate).toBeGreaterThan(
      drifting.fxRates[0] * 0.99,
    );
  });
});

describe('과거 백테스트의 수익률 소스 (§13)', () => {
  const dataset = makeDataset({ days: 3000, dailyReturn: 0.0002, productIds: ['QQQ'] });

  it('CAGR을 골라도 실제 경로를 쓴다는 사실을 경고로 낸다', () => {
    const outcome = simulate(
      baseInput({
        mode: 'backtest',
        startMonth: dataset.dates[0].slice(0, 7),
        returnSource: { type: 'constantCagr', annualRate: 0.08 },
        fxAssumption: { type: 'historicalPath' },
      }),
      dataset,
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const warning = outcome.result.warnings.find(
      (w) => w.code === 'RETURN_SOURCE_IGNORED',
    );
    expect(warning).toBeDefined();
    if (warning === undefined || warning.code !== 'RETURN_SOURCE_IGNORED') return;
    expect(warning.requestedAnnualRate).toBe(0.08);
    expect(warning.message).toContain('8.0%');
  });

  it('과거 경로를 고른 백테스트에는 이 경고가 없다', () => {
    const outcome = simulate(
      baseInput({
        mode: 'backtest',
        startMonth: dataset.dates[0].slice(0, 7),
        returnSource: {
          type: 'historicalPath',
          from: dataset.dates[0],
          to: dataset.dates[1000],
          tileMode: 'repeat',
        },
        fxAssumption: { type: 'historicalPath' },
      }),
      dataset,
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(
      outcome.result.warnings.some((w) => w.code === 'RETURN_SOURCE_IGNORED'),
    ).toBe(false);
  });

  it('미래 모드에서 CAGR을 고르는 것은 정상이라 경고하지 않는다', () => {
    const outcome = simulate(
      baseInput({ returnSource: { type: 'constantCagr', annualRate: 0.08 } }),
      dataset,
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(
      outcome.result.warnings.some((w) => w.code === 'RETURN_SOURCE_IGNORED'),
    ).toBe(false);
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

  it('금융소득종합과세는 매도 연도에만 연봉을 반영해 판정한다 (테스트 케이스 #7)', () => {
    // v1은 보유 기간 중 연봉을 쓰지 않는다(§13 결정 — 연봉은 매도 시점 세금
    // 계산에만 반영). 아래 세 가지를 검증한다.
    //  (1) 매도 연도 이전에는 employmentIncome이 0이고, 매도 연도만 finalYearIncome이다
    //  (2) 분배금만 있는 해는 그 금액이 기준금액 아래라서 미발동한다
    //      — 분배금이 0인 상품으로는 이 판정이 참인지 알 수 없다
    //  (3) 매도 연도는 매매차익이 얹혀 발동한다 (finalYearIncome이 반영된다)
    const outcome = simulate(
      baseInput({
        initialAmount: 200_000_000,
        years: 3,
        contribution: { base: 5_000_000, growthRate: 0.1, anchors: {} },
        finalYearIncome: 60_000_000,
        returnSource: { type: 'constantCagr', annualRate: 0.08 },
        allocations: [
          { accountId: 'DOMESTIC_ETF', exposure: 'US_DIVIDEND_100', weight: 1 },
        ],
      }),
      makeDataset({ days: 3000, dailyReturn: 0, productIds: ['TIGER_DIVIDEND'] }),
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const years = outcome.result.yearlyTax;
    expect(years).toHaveLength(3);

    // (1) 매도 연도 이전은 0, 매도 연도만 finalYearIncome이다
    for (let yearIndex = 0; yearIndex < 2; yearIndex += 1) {
      expect(years[yearIndex].employmentIncome).toBe(0);
    }
    expect(years[2].employmentIncome).toBe(60_000_000);

    for (let yearIndex = 0; yearIndex < 3; yearIndex += 1) {
      const contributed = outcome.result.ledger.entries
        .filter((e) => Math.floor(e.monthIndex / 12) === yearIndex)
        .reduce((sum, e) => sum + e.contribution, 0);
      // 0년차에는 초기 원금이 0개월차에 함께 들어간다
      const initial = yearIndex === 0 ? 200_000_000 : 0;
      expect(contributed).toBeCloseTo(initial + 12 * 5_000_000 * 1.1 ** yearIndex, 4);
    }

    // (2) 마지막 해 이전: 분배금이 실제로 있는데도 기준금액 아래라 미발동한다
    const threshold = 20_000_000;
    for (const year of years.slice(0, -1)) {
      expect(year.financialIncome).toBeGreaterThan(0);
      expect(year.financialIncome).toBeLessThan(threshold);
      expect(year.comprehensive.applicable).toBe(false);
      expect(year.comprehensive.additionalTax).toBe(0);
    }

    // (3) 매도 연도: 매매차익이 분배금 위에 얹혀 기준금액을 넘긴다
    const finalYear = years[years.length - 1];
    expect(finalYear.financialIncome).toBeGreaterThan(threshold);
    expect(finalYear.comprehensive.applicable).toBe(true);
    expect(finalYear.comprehensive.additionalTax).toBeGreaterThan(0);
  });

  it('납입 한도 판정에 연차별 실제 납입액을 넘긴다', () => {
    // ISA는 누적 총액만 보지만, v2의 연 단위 한도(연금저축·IRP)는 연차별
    // 내역을 봐야 한다. 빈 객체를 넘기면 그때 조용히 틀린다.
    const spy = vi.spyOn(isaStrategy, 'contributionLimit');
    const outcome = simulate(
      baseInput({
        years: 4,
        contribution: { base: 1_000_000, growthRate: 0.1, anchors: {} },
        allocations: [{ accountId: 'ISA', exposure: 'NASDAQ100_1X', weight: 1 }],
      }),
      makeDataset({ days: 3000, dailyReturn: 0, productIds: ['TIGER_NASDAQ100'] }),
    );
    const calls = spy.mock.calls.map(([yearIndex, history]) => ({
      yearIndex,
      history,
    }));
    spy.mockRestore();

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const contributedIn = (yearIndex: number): number =>
      outcome.result.ledger.entries
        .filter((e) => Math.floor(e.monthIndex / 12) === yearIndex)
        .reduce((sum, e) => sum + e.contribution, 0);

    // 연차마다 납입액이 다르다 — 총액만 맞춰서는 통과할 수 없다
    expect(contributedIn(2)).toBeCloseTo(12 * 1_000_000 * 1.21, 4);
    expect(contributedIn(2)).not.toBeCloseTo(contributedIn(1), 0);

    // 3년차 판정 시점에는 0~2년차가 확정된 실제 값으로 들어와 있다
    const atYear3 = calls.find((c) => c.yearIndex === 3);
    expect(atYear3).toBeDefined();
    if (atYear3 === undefined) return;
    expect(atYear3.history.byYear[0]).toBeCloseTo(contributedIn(0), 4);
    expect(atYear3.history.byYear[1]).toBeCloseTo(contributedIn(1), 4);
    expect(atYear3.history.byYear[2]).toBeCloseTo(contributedIn(2), 4);
    expect(atYear3.history.total).toBeCloseTo(
      contributedIn(0) + contributedIn(1) + contributedIn(2),
      4,
    );
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

    // 양도소득세 = (평가액 − 취득원가 − 기본공제 250만) × 22%.
    // holdUntilExit이라 수확 step-up은 없지만, 재투자된 배당(원천징수 후 85%)은
    // 취득원가에 얹힌다 — 이미 15% 원천징수를 낸 금액에 22%를 또 물릴 수 없다.
    const reinvestedDividend = withDividend.result.ledger.entries.reduce(
      (sum, e) => sum + e.dividendReceived * (1 - 0.15),
      0,
    );
    expect(reinvestedDividend).toBeGreaterThan(0);
    const capitalGainsTax =
      (withDividend.result.finalBeforeTax -
        100_000_000 -
        reinvestedDividend -
        2_500_000) *
      0.22;
    expect(capitalGainsTax).toBeGreaterThan(0);

    // 최종 세금은 정확히 이 둘의 합이다 — 0년차 원천징수는 여기 없다(평가액에 있다)
    expect(withDividend.result.totalTax).toBeCloseTo(
      finalYearWithholding + capitalGainsTax,
      2,
    );
    expect(withDividend.result.yearlyTax[0].totalTax).toBe(0);
    expect(withDividend.result.yearlyTax[0].withheldTax).toBeGreaterThan(0);
  });

  it('재투자된 배당은 취득원가에 얹혀 양도소득세를 두 번 물지 않는다', () => {
    // 가격 시계열이 배당 재투자 총수익이라(계획 D6) 원천징수 후 남은 배당은
    // 평가액 안에서 계속 자란다. 그 금액을 취득원가에 얹지 않으면 매도 시
    // "이미 15% 원천징수를 낸 배당"에 22% 양도소득세가 한 번 더 붙는다.
    const dataset = makeDataset({
      days: 3000,
      dailyReturn: 0,
      productIds: ['SCHD', 'QQQ'],
    });
    const common = {
      initialAmount: 100_000_000,
      contribution: { base: 0, growthRate: 0, anchors: {} },
      years: 5,
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
    // 같은 가격 경로에 배당만 없는 대조군 (QQQ는 dividendYield 0)
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

    // 대조군: 배당이 없으니 취득원가는 원금 그대로다 — 공식 자체의 대조군이다
    expect(noDividend.result.exitBreakdowns[0].tax).toBeCloseTo(
      (noDividend.result.finalBeforeTax - 100_000_000 - 2_500_000) * 0.22,
      2,
    );

    const entries = withDividend.result.ledger.entries;
    const reinvestedDividend = entries.reduce(
      (sum, e) => sum + e.dividendReceived * (1 - 0.15),
      0,
    );
    expect(reinvestedDividend).toBeGreaterThan(0);

    // [1] 양도차익 = 평가액 − (원금 + 재투자 배당) − 기본공제 250만
    const expectedCapitalGainsTax =
      (withDividend.result.finalBeforeTax -
        100_000_000 -
        reinvestedDividend -
        2_500_000) *
      0.22;
    expect(withDividend.result.exitBreakdowns[0].tax).toBeCloseTo(
      expectedCapitalGainsTax,
      2,
    );

    // [2] 취득원가를 올리지 않았다면 재투자 배당에 22%가 통째로 더 붙었을 것이다
    const doubleTaxedAmount = reinvestedDividend * 0.22;
    expect(doubleTaxedAmount).toBeGreaterThan(1_000_000);
    expect(withDividend.result.exitBreakdowns[0].tax).toBeCloseTo(
      (withDividend.result.finalBeforeTax - 100_000_000 - 2_500_000) * 0.22 -
        doubleTaxedAmount,
      2,
    );

    // [3] 배당은 매년 2,000만원 기준금액 아래라 종합과세는 발동하지 않는다.
    // 그래서 총 세금은 "마지막 해 원천징수 + 양도소득세"로 정확히 닫힌다.
    for (const year of withDividend.result.yearlyTax) {
      expect(year.financialIncome).toBeGreaterThan(0);
      expect(year.comprehensive.applicable).toBe(false);
    }
    const finalYearWithholding =
      entries[entries.length - 1].dividendReceived * 0.15;
    expect(withDividend.result.totalTax).toBeCloseTo(
      finalYearWithholding + expectedCapitalGainsTax,
      2,
    );
  });

  it('국내상장 분배금도 취득원가에 얹힌다 — 원천징수 없이 전액 재투자되기 때문', () => {
    // 국내상장은 원장의 dividendWithholdingRate가 0이라 주수가 줄지 않는다.
    // 즉 분배금 100%가 평가액에 남으므로 취득원가도 전액만큼 올라야 한다.
    const outcome = simulate(
      baseInput({
        initialAmount: 200_000_000,
        contribution: { base: 0, growthRate: 0, anchors: {} },
        years: 4,
        returnSource: { type: 'constantCagr', annualRate: 0.1 },
        allocations: [
          { accountId: 'DOMESTIC_ETF', exposure: 'US_DIVIDEND_100', weight: 1 },
        ],
      }),
      makeDataset({ days: 3000, dailyReturn: 0, productIds: ['TIGER_DIVIDEND'] }),
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const dividendTotal = outcome.result.ledger.entries.reduce(
      (sum, e) => sum + e.dividendReceived,
      0,
    );
    expect(dividendTotal).toBeGreaterThan(0);

    // 매도 시 배당소득으로 계상되는 매매차익에서 재투자 분배금이 빠져 있다
    expect(outcome.result.exitBreakdowns[0].financialIncome).toBeCloseTo(
      outcome.result.finalBeforeTax - 200_000_000 - dividendTotal,
      2,
    );
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

  it('ISA 100% 배분이라도 한도 초과분은 미국 직투로 자동 라우팅되고 경고가 뜬다', () => {
    const outcome = simulate(
      baseInput({
        initialAmount: 100_000_000,
        years: 1,
        contribution: { base: 0, growthRate: 0, anchors: {} },
        allocations: [{ accountId: 'ISA', exposure: 'NASDAQ100_1X', weight: 1 }],
      }),
      // ISA(TIGER_NASDAQ100)만 명시적으로 배분했지만, 데이터셋에 QQQ(DIRECT_US)도
      // 있어야 withOverflowCatcher가 초과분을 받아줄 홀딩을 끼워 넣을 수 있다.
      makeDataset({ days: 3000, dailyReturn: 0, productIds: ['TIGER_NASDAQ100', 'QQQ'] }),
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const firstMonth = outcome.result.ledger.entries.filter((e) => e.monthIndex === 0);
    const isaContribution = firstMonth.find((e) => e.accountId === 'ISA')?.contribution;
    const directUsContribution = firstMonth.find(
      (e) => e.accountId === 'DIRECT_US',
    )?.contribution;

    // ISA 연 한도 2,000만원까지만 들어가고, 나머지 8,000만원은 그 즉시 미국 직투로
    expect(isaContribution).toBe(20_000_000);
    expect(directUsContribution).toBe(80_000_000);

    const warning = outcome.result.warnings.find(
      (w) => w.code === 'ISA_LIMIT_OVERFLOW_ROUTED',
    );
    expect(warning).toBeDefined();
    if (warning?.code !== 'ISA_LIMIT_OVERFLOW_ROUTED') return;
    expect(warning.amount).toBe(80_000_000);
    expect(warning.toAccountId).toBe('DIRECT_US');
  });

  it('ISA 기존 가입년차만큼 이월 한도가 시작 시점부터 반영된다', () => {
    const outcome = simulate(
      baseInput({
        initialAmount: 60_000_000,
        years: 1,
        contribution: { base: 0, growthRate: 0, anchors: {} },
        allocations: [{ accountId: 'ISA', exposure: 'NASDAQ100_1X', weight: 1 }],
        isaExistingYears: 2,
      }),
      makeDataset({ days: 3000, dailyReturn: 0, productIds: ['TIGER_NASDAQ100', 'QQQ'] }),
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    // 기존 가입년차 2 + 이번 해 1 = 3년치(6,000만원) 한도가 시작부터 열려 있어
    // 6,000만원 원금이 전부 ISA에 들어가고 초과분이 없다
    const firstMonth = outcome.result.ledger.entries.filter((e) => e.monthIndex === 0);
    const isaContribution = firstMonth.find((e) => e.accountId === 'ISA')?.contribution;
    expect(isaContribution).toBe(60_000_000);
    expect(
      outcome.result.warnings.some((w) => w.code === 'ISA_LIMIT_OVERFLOW_ROUTED'),
    ).toBe(false);
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

describe('portfolioIndex', () => {
  it('시작 시점 레벨은 1이고, 배분 가중으로 블렌딩된다', () => {
    const dataset = makeDataset({ days: 800, dailyReturn: 0.001, productIds: ['QQQ', 'SPY'] });
    const outcome = simulate(
      baseInput({
        mode: 'backtest',
        startMonth: dataset.dates[0].slice(0, 7),
        years: 1,
        allocations: [
          { accountId: 'DIRECT_US', exposure: 'NASDAQ100_1X', weight: 0.5 },
          { accountId: 'DIRECT_US', exposure: 'SP500_1X', weight: 0.5 },
        ],
        fxAssumption: { type: 'fixed', rate: 1500 },
        returnSource: { type: 'historicalPath', from: dataset.dates[0], to: dataset.dates[0], tileMode: 'repeat' },
      }),
      dataset,
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.result.portfolioIndex).toHaveLength(12);
    expect(outcome.result.portfolioIndex[0].level).toBeCloseTo(1, 10);
    // 두 상품이 같은 dailyReturn으로 만들어졌으므로(fixture), 블렌딩 후에도 단일 상품과 같은 성장률을 보인다
    expect(outcome.result.portfolioIndex[11].level).toBeGreaterThan(1);
  });

  it('연차 수만큼의 월별 포인트를 낸다', () => {
    const dataset = makeDataset({ days: 3000, dailyReturn: 0, productIds: ['QQQ'] });
    const outcome = simulate(baseInput({ years: 3 }), dataset);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.portfolioIndex).toHaveLength(36);
  });
});
