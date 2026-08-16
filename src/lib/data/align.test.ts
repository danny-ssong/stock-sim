import { describe, it, expect } from 'vitest';
import { buildDateAxis, alignToAxis, alignFxToAxis, forwardFillGaps } from './align';
import type { RawSeries } from './sources/yahoo';

const N = Number.NaN;

const series: RawSeries = {
  symbol: 'X',
  dates: ['1995-01-03', '1995-01-04', '1995-01-06'],
  close: [10, 11, 12],
  adjClose: [5, 5.5, 6],
};

describe('buildDateAxis', () => {
  it('시작일 이전을 잘라낸다', () => {
    const axis = buildDateAxis(
      ['1994-12-30', '1995-01-03', '1995-01-04'],
      '1995-01-03',
    );
    expect(axis).toEqual(['1995-01-03', '1995-01-04']);
  });

  it('중복을 제거하고 오름차순으로 정렬한다', () => {
    const axis = buildDateAxis(
      ['1995-01-04', '1995-01-03', '1995-01-04'],
      '1995-01-01',
    );
    expect(axis).toEqual(['1995-01-03', '1995-01-04']);
  });
});

describe('alignToAxis', () => {
  it('축의 날짜에 해당하는 값을 채운다', () => {
    const axis = ['1995-01-03', '1995-01-04'];
    const out = alignToAxis(axis, series, 'adjClose');
    expect([...out]).toEqual([5, 5.5]);
  });

  it('데이터가 없는 날짜는 NaN이다', () => {
    const axis = ['1995-01-03', '1995-01-05'];
    const out = alignToAxis(axis, series, 'close');
    expect(out[0]).toBe(10);
    expect(Number.isNaN(out[1])).toBe(true);
  });
});

describe('alignFxToAxis', () => {
  const fx = {
    dates: ['1995-01-03', '1995-01-05'],
    rates: [788.7, 790.2],
  };

  it('정확히 일치하는 날짜는 그 값을 쓴다', () => {
    const out = alignFxToAxis(['1995-01-03'], fx);
    expect(out[0]).toBe(788.7);
  });

  it('휴장일은 직전 영업일 환율로 전진 채움한다', () => {
    const out = alignFxToAxis(['1995-01-04'], fx);
    expect(out[0]).toBe(788.7);
  });

  it('첫 환율보다 이른 날짜는 첫 환율로 채운다', () => {
    const out = alignFxToAxis(['1995-01-01'], fx);
    expect(out[0]).toBe(788.7);
  });

  it('마지막 환율 이후는 마지막 값을 유지한다', () => {
    const out = alignFxToAxis(['1995-01-09'], fx);
    expect(out[0]).toBe(790.2);
  });
});

describe('forwardFillGaps', () => {
  it('선행 NaN은 그대로 남긴다', () => {
    const { filled, filledCount } = forwardFillGaps(Float64Array.from([N, N, 10, 20]));
    expect(Number.isNaN(filled[0])).toBe(true);
    expect(Number.isNaN(filled[1])).toBe(true);
    expect(filled[2]).toBe(10);
    expect(filled[3]).toBe(20);
    expect(filledCount).toBe(0);
  });

  it('중간 NaN을 직전 유효값으로 채운다', () => {
    const { filled, filledCount } = forwardFillGaps(Float64Array.from([10, N, 20]));
    expect(filled[1]).toBe(10);
    expect(filledCount).toBe(1);
  });

  it('연속된 중간 NaN도 전부 채운다', () => {
    const { filled, filledCount } = forwardFillGaps(Float64Array.from([10, N, N, N, 20]));
    expect(filled[1]).toBe(10);
    expect(filled[2]).toBe(10);
    expect(filled[3]).toBe(10);
    expect(filledCount).toBe(3);
  });

  it('후행 NaN도 직전 유효값으로 채운다', () => {
    const { filled, filledCount } = forwardFillGaps(Float64Array.from([10, 20, N, N]));
    expect(filled[2]).toBe(20);
    expect(filled[3]).toBe(20);
    expect(filledCount).toBe(2);
  });

  it('구멍이 없으면 filledCount가 0이고 값이 그대로다', () => {
    const { filled, filledCount } = forwardFillGaps(Float64Array.from([10, 20, 30]));
    expect([...filled]).toEqual([10, 20, 30]);
    expect(filledCount).toBe(0);
  });
});
