import { describe, it, expect } from 'vitest';
import { parseYahooChart, yahooChartUrl } from './yahoo';
import fixture from './__fixtures__/yahoo-spy-sample.json';

describe('parseYahooChart', () => {
  it('타임스탬프를 ISO 날짜로 변환한다', () => {
    const s = parseYahooChart(fixture);
    expect(s.symbol).toBe('SPY');
    expect(s.dates).toEqual(['1993-01-25', '1993-01-26', '1993-01-27']);
  });

  it('close와 adjClose를 모두 보존한다', () => {
    const s = parseYahooChart(fixture);
    expect(s.close[0]).toBe(43.9375);
    expect(s.adjClose[0]).toBe(24.11);
  });

  it('null 값이 있는 행은 제외한다', () => {
    const withNull = {
      chart: {
        result: [{
          meta: { currency: 'USD', symbol: 'X' },
          timestamp: [727920000, 728006400],
          indicators: {
            quote: [{ close: [10, null] }],
            adjclose: [{ adjclose: [10, null] }],
          },
        }],
        error: null,
      },
    };
    const s = parseYahooChart(withNull);
    expect(s.dates).toHaveLength(1);
    expect(s.close).toEqual([10]);
  });

  it('결과가 비어 있으면 예외를 던진다', () => {
    expect(() => parseYahooChart({ chart: { result: [], error: null } }))
      .toThrow(/결과가 비어/);
  });

  it('스키마에 맞지 않으면 예외를 던진다', () => {
    expect(() => parseYahooChart({ nope: true })).toThrow();
  });
});

describe('yahooChartUrl', () => {
  it('특수문자가 포함된 심볼을 인코딩한다', () => {
    expect(yahooChartUrl('^NDX')).toContain('%5ENDX');
    expect(yahooChartUrl('133690.KS')).toContain('133690.KS');
  });
});
