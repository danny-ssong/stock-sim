import { describe, it, expect } from 'vitest';
import { exposureLabel, exposureLabelWithTicker } from './labels';
import { V1_AVAILABLE_EXPOSURES } from '../url/exposures';

describe('exposureLabel', () => {
  it('여섯 개 노출 전부를 사람이 읽는 한국어 라벨로 낸다', () => {
    // 전량을 한 번에 못박는다 — 루프 안에서 "빈 문자열이 아니다"만 확인하면
    // 라벨 오타가 그대로 통과한다.
    expect(V1_AVAILABLE_EXPOSURES.map(exposureLabel)).toEqual([
      '나스닥100',
      '나스닥100 2배',
      '나스닥100 3배',
      'S&P500',
      'S&P500 2배',
      'S&P500 3배',
    ]);
  });
});

describe('exposureLabelWithTicker', () => {
  it('실제로 어떤 상품을 산 결과인지 티커로 드러낸다', () => {
    expect(exposureLabelWithTicker('NASDAQ100_3X')).toBe('나스닥100 3배 (TQQQ)');
    expect(exposureLabelWithTicker('SP500_1X')).toBe('S&P500 (SPY)');
  });
});
