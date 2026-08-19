import { describe, it, expect } from 'vitest';
import { REQUIRED_YAHOO_SYMBOLS, rawPathForSymbol, AXIS_SYMBOL, RATE_SYMBOL } from './symbols';

describe('REQUIRED_YAHOO_SYMBOLS', () => {
  it('모든 상품 티커를 포함한다', () => {
    for (const ticker of ['QQQ', 'QLD', 'TQQQ', 'SPY', 'SSO', 'SPXL']) {
      expect(REQUIRED_YAHOO_SYMBOLS).toContain(ticker);
    }
  });

  it('백필 기준 지수를 포함한다', () => {
    expect(REQUIRED_YAHOO_SYMBOLS).toContain('^NDX');
    expect(REQUIRED_YAHOO_SYMBOLS).toContain('^SP500TR');
  });

  it('날짜 축 심볼을 포함한다 — 어떤 상품도 백필 지수로 쓰지 않으므로 명시 추가가 필요하다', () => {
    expect(REQUIRED_YAHOO_SYMBOLS).toContain(AXIS_SYMBOL);
    expect(AXIS_SYMBOL).toBe('^GSPC');
  });

  it('무위험 금리 심볼을 포함한다 — 어떤 상품도 백필 지수로 쓰지 않으므로 명시 추가가 필요하다', () => {
    expect(REQUIRED_YAHOO_SYMBOLS).toContain(RATE_SYMBOL);
    expect(RATE_SYMBOL).toBe('^IRX');
  });

  it('중복이 없다', () => {
    const set = new Set(REQUIRED_YAHOO_SYMBOLS);
    expect(set.size).toBe(REQUIRED_YAHOO_SYMBOLS.length);
  });
});

describe('rawPathForSymbol', () => {
  it('파일명에 쓸 수 없는 문자를 치환한다', () => {
    expect(rawPathForSymbol('^NDX')).toMatch(/_NDX\.json$/);
    expect(rawPathForSymbol('133690.KS')).toMatch(/133690_KS\.json$/);
  });
});
