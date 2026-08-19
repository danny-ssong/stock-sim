import { describe, it, expect } from 'vitest';
import { simulate } from './engine';
import { buildFutureCalendar } from './calendar';
import { makeDataset, baseInput } from './__fixtures__/simulation';

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
});
