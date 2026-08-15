import { describe, it, expect } from 'vitest';
import { cagr, compoundReturns, calibrateDrag, validateOutOfSample } from './calibrate';
import { synthesizeLeveraged, TRADING_DAYS_PER_YEAR } from './synthetic';

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

describe('validateOutOfSample', () => {
  it('드래그가 전 구간 일정한 인공 데이터에서는 표본 외 오차가 0에 가깝다', () => {
    const trueDrag = 0.0125;
    const idxReturns = new Float64Array(TRADING_DAYS_PER_YEAR * 10);
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

    const { calibrationDrag, holdoutErrorCagr } = validateOutOfSample(
      idxReturns,
      actual,
      2,
    );

    // 전 구간에서 드래그가 일정하므로, 전반부에서 구한 값이 후반부에도 정확히 맞아야 한다
    expect(calibrationDrag).toBeCloseTo(trueDrag, 3);
    expect(Math.abs(holdoutErrorCagr)).toBeLessThan(0.001);
  });
});
