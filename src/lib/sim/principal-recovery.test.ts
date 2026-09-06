import { describe, it, expect } from 'vitest';
import { computePrincipalRecovery } from './principal-recovery';
import type { MonthEntry } from './types';

function entry(monthIndex: number, date: string, costBasis: number, marketValue: number): MonthEntry {
  return {
    monthIndex,
    date,
    endDate: date,
    accountId: 'DIRECT_US',
    productId: 'QQQ',
    contribution: 0,
    buyPrice: 1,
    sharesBought: 0,
    sharesHeld: 0,
    marketValue,
    costBasis,
    realizedGain: 0,
    isSynthetic: false,
  };
}

describe('computePrincipalRecovery', () => {
  it('빈 배열이면 null이다', () => {
    expect(computePrincipalRecovery([])).toBeNull();
  });

  it('잔고가 원금 아래로 내려간 적이 없으면 null이다', () => {
    const entries = [
      entry(0, '2000-01', 100, 100),
      entry(1, '2000-02', 200, 210),
      entry(2, '2000-03', 300, 320),
    ];
    expect(computePrincipalRecovery(entries)).toBeNull();
  });

  it('가장 결손이 컸던 시점을 찾고 그 이후 회복 시점을 찾는다', () => {
    // 월1: 결손 20(가장 큼) → 월2: 결손 10 → 월3: 회복(잔고 >= 원금)
    const entries = [
      entry(0, '2000-01', 100, 100),
      entry(1, '2000-02', 200, 180), // 결손 20
      entry(2, '2000-03', 300, 290), // 결손 10
      entry(3, '2000-04', 400, 405), // 회복
    ];
    const result = computePrincipalRecovery(entries);
    expect(result).not.toBeNull();
    if (result === null) return;
    expect(result.worst.date).toBe('2000-02');
    expect(result.worst.deficit).toBeCloseTo(20, 10);
    expect(result.recovery?.date).toBe('2000-04');
    expect(result.recoveryMonths).toBe(2);
  });

  it('시뮬레이션 종료까지 회복하지 못하면 recovery가 null이다', () => {
    const entries = [entry(0, '2000-01', 100, 100), entry(1, '2000-02', 200, 150)];
    const result = computePrincipalRecovery(entries);
    expect(result?.recovery).toBeNull();
    expect(result?.recoveryMonths).toBeNull();
  });
});
