import { describe, it, expect } from 'vitest';
import { getTaxStrategy, TAX_STRATEGIES } from './index';

describe('전략 레지스트리', () => {
  it('세 계좌 전부에 전략이 있다', () => {
    expect(Object.keys(TAX_STRATEGIES).sort()).toEqual([
      'DIRECT_US',
      'DOMESTIC_ETF',
      'ISA',
    ]);
  });

  it('각 전략의 accountId가 키와 일치한다', () => {
    for (const [accountId, strategy] of Object.entries(TAX_STRATEGIES)) {
      expect(strategy.accountId).toBe(accountId);
    }
  });

  it('getTaxStrategy가 해당 전략을 준다', () => {
    expect(getTaxStrategy('ISA').accountId).toBe('ISA');
  });

  it('상품 매핑 규칙이 계좌별로 다르다 (테스트 케이스 #18)', () => {
    expect(getTaxStrategy('DIRECT_US').canHold('NASDAQ100_3X').available).toBe(true);
    expect(getTaxStrategy('ISA').canHold('NASDAQ100_3X').available).toBe(false);
    expect(getTaxStrategy('DOMESTIC_ETF').canHold('SP500_2X').available).toBe(false);
  });
});
