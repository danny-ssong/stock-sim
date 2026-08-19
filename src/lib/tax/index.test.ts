import { describe, it, expect } from 'vitest';
import { getTaxStrategy, TAX_STRATEGIES } from './index';

describe('전략 레지스트리', () => {
  it('등록된 계좌에 전략이 있다', () => {
    expect(Object.keys(TAX_STRATEGIES).sort()).toEqual(['DIRECT_US']);
  });

  it('각 전략의 accountId가 키와 일치한다', () => {
    for (const [accountId, strategy] of Object.entries(TAX_STRATEGIES)) {
      expect(strategy.accountId).toBe(accountId);
    }
  });

  it('getTaxStrategy가 해당 전략을 준다', () => {
    expect(getTaxStrategy('DIRECT_US').accountId).toBe('DIRECT_US');
  });
});
