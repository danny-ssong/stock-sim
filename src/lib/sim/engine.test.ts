import { describe, it, expect } from 'vitest';
import { simulate } from './engine';
import { buildFutureCalendar } from './calendar';
import { maxBacktestYears } from './backtest-bounds';
import { makeDataset, baseInput } from './__fixtures__/simulation';
import type { Dataset } from '../data/dataset';

/** 1월 중순에 -80% 낙폭이 있다가 12월에 회복하는 손수 짠 데이터셋. 각 달은 거래일이
 *  하나 이상만 있으면 되므로, 1월만 여러 날을 넣고 나머지 달은 하루씩만 채운다. */
function makeMidMonthDipDataset(): Dataset {
  const dates = [
    '2018-01-01', '2018-01-02', '2018-01-03', '2018-01-04',
    '2018-02-01', '2018-03-01', '2018-04-01', '2018-05-01', '2018-06-01',
    '2018-07-01', '2018-08-01', '2018-09-01', '2018-10-01', '2018-11-01', '2018-12-01',
  ];
  // 100(매수가) → 200(1/2 고점) → 40(1/3 저점, -80%) → 180(1월말) → 이후 완만히 상승, 12월에 고점(200) 회복
  const levels = [100, 200, 40, 180, 190, 195, 198, 199, 199.5, 199.8, 199.9, 199.95, 199.99, 199.999, 250];
  const series = Float64Array.from(levels);
  const fxRates = new Float64Array(dates.length).fill(1500);

  return {
    dates,
    fxRates,
    seriesById: new Map([['QQQ', series]]),
    factsById: new Map([
      ['QQQ', { id: 'QQQ', availableFrom: dates[0], syntheticUntil: null, length: dates.length, filledGapDays: 0 }],
    ]),
  };
}

const DATASET = makeDataset({ days: 3000, dailyReturn: 0, productIds: ['QQQ'] });

describe('기본 시나리오', () => {
  it('단일 노출로 원장과 세금을 계산한다', () => {
    const outcome = simulate(
      {
        mode: 'future',
        startMonth: '2026-01',
        initialAmount: 0,
        years: 1,
        contribution: { base: 1_000_000, growthRate: 0, anchors: {} },
        exposure: 'NASDAQ100_1X',
        returnSource: { type: 'constantCagr', annualRate: 0.08 },
      },
      DATASET,
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.ledger.entries).toHaveLength(12);
    expect(outcome.result.finalAfterTax).toBeLessThanOrEqual(outcome.result.finalBeforeTax);
  });

  it('수익률 0이면 최종 평가액이 총 납입액과 같다', () => {
    const outcome = simulate(baseInput(), DATASET);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.result.totalContributed).toBeCloseTo(24_000_000, 4);
    expect(outcome.result.finalBeforeTax).toBeCloseTo(24_000_000, 4);
    expect(outcome.result.totalTax).toBeCloseTo(0, 4);
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

describe('과거 백테스트의 수익률 소스 (§13)', () => {
  const dataset = makeDataset({ days: 3000, dailyReturn: 0.0002, productIds: ['QQQ'] });

  it('CAGR을 골라도 실제 경로를 쓴다는 사실을 경고로 낸다', () => {
    const outcome = simulate(
      baseInput({
        mode: 'backtest',
        startMonth: dataset.dates[0].slice(0, 7),
        returnSource: { type: 'constantCagr', annualRate: 0.08 },
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
      productIds: ['QQQ'],
      availableFrom: '2015-01-01',
    });

    const outcome = simulate(
      baseInput({
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

  it('최종 매도에 양도소득세가 붙는다', () => {
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

  it('마지막 해에는 기본공제 250만원을 한 번만 적용한다', () => {
    // 마지막 해가 아닌 해는 매년 기본공제 범위 내로 자동 수확해 취득원가를
    // 올린다(direct-us.ts annualTax). 마지막 해는 수확을 건너뛰고 최종 매도에서
    // 공제를 딱 한 번만 받는다 — 두 곳에서 공제가 겹치면 같은 해에 두 번
    // 빠지는 버그가 된다.
    const outcome = simulate(
      baseInput({
        initialAmount: 100_000_000,
        contribution: { base: 0, growthRate: 0, anchors: {} },
        years: 3,
        returnSource: { type: 'constantCagr', annualRate: 0.1 },
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
});

describe('FX 되벗기기 회귀 테스트 (§9)', () => {
  it('원화 결합 수익률에서 환율 몫을 제거하면 달러(현지) 수익률만으로 성장한다 — 다시 씌우지 않는다', () => {
    // 원화 시계열은 "1+r_krw = (1+r_local)×(1+r_fx)"로 합성돼 있다(stripFx의 전제).
    // 여기서 r_local과 r_fx를 미리 정해 결합 r_krw를 역산해 데이터셋을 만들면,
    // stripFx가 정말로 r_fx만 제거하고 r_local을 정확히 복원하는지, 그리고 그
    // 결과에 환율을 다시 씌우는 로직이 없는지를 최종 평가액으로 검증할 수 있다.
    const localDaily = 0.001;
    const fxDaily = -0.0004;
    const krwDaily = (1 + localDaily) * (1 + fxDaily) - 1;

    const dataset = makeDataset({
      days: 3000,
      dailyReturn: krwDaily,
      fxDailyReturn: fxDaily,
      productIds: ['QQQ'],
    });

    const outcome = simulate(
      baseInput({
        initialAmount: 100_000_000,
        contribution: { base: 0, growthRate: 0, anchors: {} },
        years: 1,
        returnSource: {
          type: 'historicalPath',
          from: dataset.dates[0],
          to: dataset.dates[dataset.dates.length - 1],
          tileMode: 'repeat',
        },
      }),
      dataset,
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    // stripFx가 환율 몫을 제거했다면, 최종 평가액은 원화 결합 수익률(krwDaily)이
    // 아니라 달러(현지) 수익률(localDaily)만으로 성장해야 한다 — engine.test.ts의
    // "CAGR 연 10%가..." 테스트와 같은 매수 오프셋 논리다.
    const calendar = buildFutureCalendar({ startMonth: '2026-09', months: 12 });
    const expectedFromLocalOnly = 100_000_000 * (1 + localDaily) ** (calendar.totalDays - 1);
    expect(outcome.result.finalBeforeTax).toBeCloseTo(expectedFromLocalOnly, 2);

    // stripFx를 건너뛰고 원화 결합 수익률을 그대로 썼다면 이 값이 나왔을 것이다 —
    // 두 수익률이 뚜렷이 다르므로(하루 0.14%p 차이) stripFx 호출이 실수로
    // 삭제되거나 환율을 다시 씌우면 이 assertion이 반드시 잡아낸다.
    const expectedIfNotStripped = 100_000_000 * (1 + krwDaily) ** (calendar.totalDays - 1);
    expect(outcome.result.finalBeforeTax).not.toBeCloseTo(expectedIfNotStripped, 2);
  });
});

describe('portfolioIndex', () => {
  it('시작 시점 레벨은 1이고, 선택한 노출 그대로 성장한다', () => {
    const dataset = makeDataset({ days: 800, dailyReturn: 0.001, productIds: ['QQQ'] });
    const outcome = simulate(
      baseInput({
        mode: 'backtest',
        startMonth: dataset.dates[0].slice(0, 7),
        years: 1,
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

    expect(outcome.result.portfolioIndex).toHaveLength(12);
    expect(outcome.result.portfolioIndex[0].level).toBeCloseTo(1, 10);
    expect(outcome.result.portfolioIndex[11].level).toBeGreaterThan(1);
  });

  it('연차 수만큼의 월별 포인트를 낸다', () => {
    const dataset = makeDataset({ days: 3000, dailyReturn: 0, productIds: ['QQQ'] });
    const outcome = simulate(baseInput({ years: 3 }), dataset);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.portfolioIndex).toHaveLength(36);
  });

  it('백테스트 모드는 priceUsd에 정규화하지 않은 실제 달러 가격(원화 환산 없음)을 담는다', () => {
    const dataset = makeDataset({ days: 800, dailyReturn: 0.001, productIds: ['QQQ'] });
    const outcome = simulate(
      baseInput({
        mode: 'backtest',
        startMonth: dataset.dates[0].slice(0, 7),
        years: 1,
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

    const series = dataset.seriesById.get('QQQ');
    if (series === undefined) throw new Error('series 없음');

    // priceUsd는 정규화된 level(=1에서 시작)과 달리 series(원화 환산)를 환율로
    // 되나눈 실제 달러 스케일을 그대로 보여줘야 한다
    expect(outcome.result.portfolioIndex[0].priceUsd).toBeCloseTo(series[0] / dataset.fxRates[0], 6);
  });

  it('미래 모드는 최신 실제 종가(달러)를 앵커로 priceUsd를 채운다', () => {
    const dataset = makeDataset({ days: 3000, dailyReturn: 0.001, productIds: ['QQQ'] });
    const outcome = simulate(
      baseInput({ years: 2, returnSource: { type: 'constantCagr', annualRate: 0.1 } }),
      dataset,
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const series = dataset.seriesById.get('QQQ');
    if (series === undefined) throw new Error('series 없음');
    const anchor = series[series.length - 1] / dataset.fxRates[dataset.fxRates.length - 1];

    const points = outcome.result.portfolioIndex;

    // 첫 달은 level=1이라 앵커(=최신 실제 종가, 달러) 그대로여야 한다.
    expect(points[0].priceUsd).toBeCloseTo(anchor, 6);

    // 이후는 정규화 레벨에 앵커를 비례 적용한 값이다.
    for (const point of points) {
      expect(point.priceUsd).not.toBeNull();
      if (point.priceUsd === null) continue;
      expect(point.priceUsd).toBeCloseTo(anchor * point.level, 6);
    }

    // series[0](=100, 원화 환산 전 스케일)을 앵커로 잘못 쓰면 이 단언이 깨진다.
    expect(points[0].priceUsd).not.toBeCloseTo(series[0], 6);
  });
});

describe('drawdown', () => {
  it('월중에 발생한 저점도 잡는다 — portfolioIndex(월별)로는 놓칠 낙폭', () => {
    const dataset = makeMidMonthDipDataset();
    const outcome = simulate(
      baseInput({
        mode: 'backtest',
        startMonth: '2018-01',
        years: 1,
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

    // 월별 portfolioIndex(각 달 매수일 시점 값)만 보면 단조 증가라 낙폭이 전혀 안 보인다 —
    // 옛 구현(computeDrawdown(portfolioIndex))이라면 이 케이스를 완전히 놓쳤을 것이다.
    const monthlyLevels = outcome.result.portfolioIndex.map((p) => p.level);
    for (let i = 1; i < monthlyLevels.length; i += 1) {
      expect(monthlyLevels[i]).toBeGreaterThan(monthlyLevels[i - 1]);
    }

    // 일별 기준 drawdown은 1월 중순의 -80% 낙폭을 잡아낸다
    const drawdown = outcome.result.drawdown;
    expect(drawdown).not.toBeNull();
    if (drawdown === null) return;
    expect(drawdown.maxDrawdown).toBeCloseTo(0.8, 10);
    expect(drawdown.peak.date).toBe('2018-01-02');
    expect(drawdown.trough.date).toBe('2018-01-03');
    expect(drawdown.recovery?.date).toBe('2018-12-01');
    expect(drawdown.recoveryMonths).toBe(11);
  });

  it('낙폭이 없으면 drawdown.maxDrawdown은 0이고 recoveryMonths는 null이다', () => {
    const dataset = makeDataset({ days: 3000, dailyReturn: 0, productIds: ['QQQ'] });
    const outcome = simulate(baseInput({ years: 3 }), dataset);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const drawdown = outcome.result.drawdown;
    expect(drawdown).not.toBeNull();
    if (drawdown === null) return;
    expect(drawdown.maxDrawdown).toBe(0);
    expect(drawdown.recovery).toBeNull();
    expect(drawdown.recoveryMonths).toBeNull();
  });
});

describe('백테스트 기간 상한(§13.2)', () => {
  it('요청한 years가 실제 데이터 범위를 넘으면 조용히 자르지 않고 경고와 함께 줄인다', () => {
    const dataset = makeDataset({ days: 300, dailyReturn: 0, productIds: ['QQQ'] });
    const startMonth = dataset.dates[0].slice(0, 7);
    const available = maxBacktestYears(startMonth, dataset.dates[dataset.dates.length - 1]);
    expect(available).toBeGreaterThanOrEqual(1);
    expect(available).toBeLessThan(5);

    const outcome = simulate(
      baseInput({
        mode: 'backtest',
        startMonth,
        years: 5,
        returnSource: { type: 'historicalPath', from: dataset.dates[0], to: dataset.dates[0], tileMode: 'repeat' },
      }),
      dataset,
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.result.portfolioIndex).toHaveLength(available * 12);
    const clamp = outcome.result.warnings.find((w) => w.code === 'BACKTEST_YEARS_CLAMPED');
    expect(clamp).toBeDefined();
    if (clamp?.code === 'BACKTEST_YEARS_CLAMPED') {
      expect(clamp.requestedYears).toBe(5);
      expect(clamp.availableYears).toBe(available);
    }
  });

  it('데이터 범위 안이면 조용히 지나간다 — 경고가 없다', () => {
    const dataset = makeDataset({ days: 3000, dailyReturn: 0, productIds: ['QQQ'] });
    const startMonth = dataset.dates[0].slice(0, 7);
    const outcome = simulate(
      baseInput({
        mode: 'backtest',
        startMonth,
        years: 1,
        returnSource: { type: 'historicalPath', from: dataset.dates[0], to: dataset.dates[0], tileMode: 'repeat' },
      }),
      dataset,
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.warnings.some((w) => w.code === 'BACKTEST_YEARS_CLAMPED')).toBe(false);
  });
});
