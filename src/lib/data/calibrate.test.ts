import { describe, it, expect } from 'vitest';
import {
  cagr,
  compoundReturns,
  calibrateDrag,
  calibrateSpread,
  validateOutOfSample,
  stdev,
} from './calibrate';
import {
  synthesizeLeveraged,
  synthesizeLeveragedWithRates,
  TRADING_DAYS_PER_YEAR,
} from './synthetic';

describe('cagr', () => {
  it('1년 만에 2배면 100%다', () => {
    const values = Float64Array.from([100, 200]);
    expect(cagr(values, TRADING_DAYS_PER_YEAR)).toBeCloseTo(1.0, 6);
  });

  it('제자리면 0%다', () => {
    expect(cagr(Float64Array.from([100, 100]), TRADING_DAYS_PER_YEAR))
      .toBeCloseTo(0, 10);
  });
});

describe('compoundReturns', () => {
  it('NaN을 건너뛰고 누적한다', () => {
    const r = Float64Array.from([Number.NaN, 0.1, 0.1]);
    expect(compoundReturns(r)).toBeCloseTo(1.21, 10);
  });
});

describe('stdev', () => {
  it('NaN을 건너뛰고 표준편차를 계산한다', () => {
    // [1, 2, 3, 4]의 모표준편차는 sqrt(1.25) ≈ 1.1180
    const values = Float64Array.from([Number.NaN, 1, 2, 3, 4]);
    expect(stdev(values)).toBeCloseTo(Math.sqrt(1.25), 10);
  });

  it('변동성 차이를 비율로 잡아낸다 — 배율을 절반으로 잘못 넣으면 표준편차도 절반이다', () => {
    const base = Float64Array.from([0.02, -0.03, 0.01, -0.015, 0.025]);
    const halved = Float64Array.from(base.map((v) => v / 2));
    expect(stdev(halved) / stdev(base)).toBeCloseTo(0.5, 10);
  });
});

describe('calibrateDrag', () => {
  it('알고 있는 드래그를 역으로 찾아낸다', () => {
    const trueDrag = 0.0125;
    const idxReturns = new Float64Array(TRADING_DAYS_PER_YEAR * 5);
    idxReturns[0] = Number.NaN;
    for (let i = 1; i < idxReturns.length; i += 1) {
      // 결정적인 톱니 패턴 — 변동성이 있어야 의미 있는 검증이 된다
      idxReturns[i] = i % 2 === 0 ? 0.008 : -0.005;
    }

    const synth = synthesizeLeveraged(idxReturns, 2, trueDrag);
    const actual = new Float64Array(idxReturns.length);
    actual[0] = 100;
    for (let i = 1; i < actual.length; i += 1) {
      actual[i] = actual[i - 1] * (1 + synth[i]);
    }

    const { drag, errorCagr } = calibrateDrag(idxReturns, actual, 2);
    expect(drag).toBeCloseTo(trueDrag, 3);
    expect(Math.abs(errorCagr)).toBeLessThan(0.001);
  });
});

describe('calibrateSpread', () => {
  it('알고 있는 스프레드를 역으로 찾아낸다 (금리 연동 모델)', () => {
    const trueSpread = 0.01;
    const length = TRADING_DAYS_PER_YEAR * 5;
    const idxReturns = new Float64Array(length);
    const rates = new Float64Array(length);
    idxReturns[0] = Number.NaN;
    rates[0] = Number.NaN;
    for (let i = 1; i < length; i += 1) {
      // 결정적인 톱니 패턴 — 변동성이 있어야 의미 있는 검증이 된다
      idxReturns[i] = i % 2 === 0 ? 0.008 : -0.005;
      rates[i] = 0.03; // 일정한 금리
    }

    const synth = synthesizeLeveragedWithRates(idxReturns, rates, 2, trueSpread);
    const actual = new Float64Array(length);
    actual[0] = 100;
    for (let i = 1; i < length; i += 1) {
      actual[i] = actual[i - 1] * (1 + synth[i]);
    }

    const { spread, errorCagr } = calibrateSpread(idxReturns, rates, actual, 2);
    expect(spread).toBeCloseTo(trueSpread, 3);
    expect(Math.abs(errorCagr)).toBeLessThan(0.001);
  });
});

describe('validateOutOfSample', () => {
  it('스프레드와 금리가 전 구간 일정한 인공 데이터에서는 표본 외 오차가 0에 가깝다', () => {
    const trueSpread = 0.0125;
    const length = TRADING_DAYS_PER_YEAR * 10;
    const idxReturns = new Float64Array(length);
    const rates = new Float64Array(length);
    idxReturns[0] = Number.NaN;
    rates[0] = Number.NaN;
    for (let i = 1; i < length; i += 1) {
      // 결정적인 톱니 패턴 — 변동성이 있어야 의미 있는 검증이 된다
      idxReturns[i] = i % 2 === 0 ? 0.008 : -0.005;
      rates[i] = 0.03; // 일정한 금리 — 체제 변화가 없으면 표본 외 오차도 0에 가까워야 한다
    }

    const synth = synthesizeLeveragedWithRates(idxReturns, rates, 2, trueSpread);
    const actual = new Float64Array(length);
    actual[0] = 100;
    for (let i = 1; i < length; i += 1) {
      actual[i] = actual[i - 1] * (1 + synth[i]);
    }

    const { calibrationSpread, holdoutErrorCagr } = validateOutOfSample(
      idxReturns,
      rates,
      actual,
      2,
    );

    // 전 구간에서 스프레드·금리가 일정하므로, 전반부에서 구한 값이 후반부에도 정확히 맞아야 한다
    expect(calibrationSpread).toBeCloseTo(trueSpread, 3);
    expect(Math.abs(holdoutErrorCagr)).toBeLessThan(0.001);
  });

  it('금리 체제가 바뀌어도(제로금리→긴축) 금리 연동 모델은 표본 외 오차가 작게 유지된다', () => {
    // 3차 개정의 존재 이유: 고정 드래그 모델은 "전반부에서 구한 상수를 후반부에
    // 그대로 쓴다"는 가정이 금리가 바뀌면 깨진다. 금리 연동 모델은 (배율−1)×금리
    // 항을 통해 후반부에서도 실제 금리를 그대로 반영하므로, 전반부 스프레드가
    // 후반부에도 통해야 한다. 이 테스트가 없으면 신규 클론(캐시 없음)에서는
    // 금리 연동 로직의 커버리지가 전무하다.
    const trueSpread = 0.01;
    const multiplier = 3;
    const length = TRADING_DAYS_PER_YEAR * 10;
    const mid = Math.floor(length / 2);

    const idxReturns = new Float64Array(length);
    const rates = new Float64Array(length);
    idxReturns[0] = Number.NaN;
    rates[0] = Number.NaN;
    for (let i = 1; i < length; i += 1) {
      // 결정적인 톱니 패턴 — 변동성이 있어야 의미 있는 검증이 된다
      idxReturns[i] = i % 2 === 0 ? 0.008 : -0.005;
      // 전반부는 제로금리(1%), 후반부는 긴축(5%) — 분할 지점과 정확히 일치시킨다
      rates[i] = i < mid ? 0.01 : 0.05;
    }

    const synth = synthesizeLeveragedWithRates(idxReturns, rates, multiplier, trueSpread);
    const actual = new Float64Array(length);
    actual[0] = 100;
    for (let i = 1; i < length; i += 1) {
      actual[i] = actual[i - 1] * (1 + synth[i]);
    }

    const { holdoutErrorCagr } = validateOutOfSample(
      idxReturns,
      rates,
      actual,
      multiplier,
    );

    // 금리 연동 모델: 금리 체제가 바뀌어도 오차가 작게 유지되어야 한다
    expect(Math.abs(holdoutErrorCagr)).toBeLessThan(0.01);

    // 대조군 — 같은 데이터에 고정 드래그 모델(calibrateDrag)을 적용하면
    // 후반부 금리 상승분을 반영하지 못해 오차가 훨씬 크게 벌어져야 한다.
    const { drag } = calibrateDrag(
      idxReturns.slice(0, mid),
      actual.slice(0, mid),
      multiplier,
    );
    const holdoutActual = actual.slice(mid);
    const holdoutReturns = idxReturns.slice(mid + 1);
    const span = holdoutActual.length - 1;
    const fixedDragSynth = synthesizeLeveraged(holdoutReturns, multiplier, drag);
    const fixedDragGrowth = compoundReturns(fixedDragSynth);
    const fixedDragCagr = fixedDragGrowth ** (TRADING_DAYS_PER_YEAR / span) - 1;
    const fixedDragError = fixedDragCagr - cagr(holdoutActual, span);

    expect(Math.abs(fixedDragError)).toBeGreaterThan(Math.abs(holdoutErrorCagr) * 5);
  });
});
