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
  it('빈 배열이면 null이다 — 잴 대상 자체가 없다', () => {
    expect(computePrincipalRecovery([])).toBeNull();
  });

  it('잔고가 원금 아래로 내려간 적이 없으면 never-underwater다', () => {
    const entries = [
      entry(0, '2000-01', 100, 100),
      entry(1, '2000-02', 200, 210),
      entry(2, '2000-03', 300, 320),
    ];
    const result = computePrincipalRecovery(entries);
    expect(result?.kind).toBe('never-underwater');
  });

  it('never-underwater는 잔고가 원금에 가장 가까웠던 순간을 근거로 남긴다', () => {
    // 커버리지: 1.00 → 1.05 → 1.0667. 최저는 월0의 1.00
    const entries = [
      entry(0, '2000-01', 100, 100),
      entry(1, '2000-02', 200, 210),
      entry(2, '2000-03', 300, 320),
    ];
    const result = computePrincipalRecovery(entries);
    if (result?.kind !== 'never-underwater') throw new Error('never-underwater여야 한다');
    expect(result.worstCoverage?.ratio).toBeCloseTo(1, 10);
    expect(result.worstCoverage?.date).toBe('2000-01');
  });

  it('원금이 0인 달은 커버리지에서 뺀다 — 0으로 나누지 않는다', () => {
    const entries = [entry(0, '2000-01', 0, 0), entry(1, '2000-02', 200, 300)];
    const result = computePrincipalRecovery(entries);
    if (result?.kind !== 'never-underwater') throw new Error('never-underwater여야 한다');
    expect(result.worstCoverage?.date).toBe('2000-02');
    expect(result.worstCoverage?.ratio).toBeCloseTo(1.5, 10);
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
    if (result?.kind !== 'recovered') throw new Error('recovered여야 한다');
    expect(result.worst.date).toBe('2000-02');
    expect(result.worst.deficit).toBeCloseTo(20, 10);
    expect(result.recovery.date).toBe('2000-04');
    expect(result.months).toBe(2);
  });

  it('시뮬레이션 종료까지 회복하지 못하면 unrecovered다', () => {
    const entries = [entry(0, '2000-01', 100, 100), entry(1, '2000-02', 200, 150)];
    const result = computePrincipalRecovery(entries);
    expect(result?.kind).toBe('unrecovered');
  });

  it('unrecovered는 마지막 달 기준 남은 결손을 낸다 — 최저점의 결손과 다를 수 있다', () => {
    const entries = [
      entry(0, '2000-01', 100, 100),
      entry(1, '2000-02', 200, 120), // 결손 80(최저점)
      entry(2, '2000-03', 300, 270), // 결손 30(마지막, 아직 미회복)
    ];
    const result = computePrincipalRecovery(entries);
    if (result?.kind !== 'unrecovered') throw new Error('unrecovered여야 한다');
    expect(result.worst.deficit).toBeCloseTo(80, 10);
    expect(result.remainingDeficit).toBeCloseTo(30, 10);
  });
});
