import { describe, it, expect } from 'vitest';
import { exposureLabel, exposureLabelWithTicker } from './labels';
import { V1_AVAILABLE_EXPOSURES } from '../url/exposures';

describe('exposureLabel', () => {
  it('배율을 사람이 읽는 한국어로 낸다', () => {
    expect(exposureLabel('NASDAQ100_1X')).toBe('나스닥100');
    expect(exposureLabel('SP500_3X')).toBe('S&P500 3배');
  });

  it('카탈로그의 모든 노출에 라벨이 있다', () => {
    for (const exposure of V1_AVAILABLE_EXPOSURES) {
      expect(exposureLabel(exposure)).not.toBe('');
    }
  });
});

describe('exposureLabelWithTicker', () => {
  it('실제로 어떤 상품을 산 결과인지 티커로 드러낸다', () => {
    expect(exposureLabelWithTicker('NASDAQ100_3X')).toBe('나스닥100 3배 (TQQQ)');
    expect(exposureLabelWithTicker('SP500_1X')).toBe('S&P500 (SPY)');
  });
});
