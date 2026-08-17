import { describe, it, expect } from 'vitest';
import { planIsaDeposits, compareTransfer } from './transfer';
import { simulate } from './engine';
import { getTaxConstants } from '../tax/constants';
import { makeDataset, baseInput } from './__fixtures__/simulation';

const C = getTaxConstants(2026);
const DATASET = makeDataset({
  days: 6000,
  dailyReturn: 0,
  productIds: ['QQQ', 'TIGER_NASDAQ100'],
});

describe('planIsaDeposits', () => {
  it('연 2,000만원 한도를 넘는 금액은 다음 해로 이월한다', () => {
    const { deposits, leftover } = planIsaDeposits({
      proceeds: 55_000_000,
      startYearIndex: 3,
      years: 15,
      constants: C,
    });
    expect(deposits).toEqual([
      { yearIndex: 3, amount: 20_000_000 },
      { yearIndex: 4, amount: 20_000_000 },
      { yearIndex: 5, amount: 15_000_000 },
    ]);
    expect(leftover).toBe(0);
  });

  it('총 1억원을 넘는 금액은 옮기지 못하고 남는다', () => {
    const { deposits, leftover } = planIsaDeposits({
      proceeds: 150_000_000,
      startYearIndex: 0,
      years: 15,
      constants: C,
    });
    expect(deposits.reduce((s, d) => s + d.amount, 0)).toBe(100_000_000);
    expect(leftover).toBe(50_000_000);
  });

  it('남은 기간이 부족하면 옮기지 못한 금액이 남는다', () => {
    const { deposits, leftover } = planIsaDeposits({
      proceeds: 55_000_000,
      startYearIndex: 3,
      years: 5,
      constants: C,
    });
    expect(deposits).toHaveLength(2);
    expect(leftover).toBe(15_000_000);
  });
});

describe('compareTransfer', () => {
  const input = baseInput({
    years: 10,
    initialAmount: 100_000_000,
    contribution: { base: 0, growthRate: 0, anchors: {} },
    returnSource: { type: 'constantCagr', annualRate: 0.1 },
    allocations: [{ accountId: 'DIRECT_US', exposure: 'NASDAQ100_1X', weight: 1 }],
    transferEvents: [{ atMonth: 36, from: 'DIRECT_US', to: 'ISA', amount: 'all' }],
  });

  it('이전 시점에 양도소득세가 즉시 발생한다', () => {
    const comparison = compareTransfer({ input, dataset: DATASET });
    expect('blocked' in comparison).toBe(false);
    if ('blocked' in comparison) return;
    expect(comparison.immediateTax).toBeGreaterThan(0);
  });

  it('이전한 쪽과 하지 않은 쪽을 같은 경로로 병렬 시뮬한다', () => {
    const comparison = compareTransfer({ input, dataset: DATASET });
    if ('blocked' in comparison) return;
    expect(comparison.without.ledger.entries.length).toBeGreaterThan(0);
    expect(comparison.withTransfer).toHaveLength(2);
  });

  it('역전 시점을 찾는다 — 없으면 null이다', () => {
    const comparison = compareTransfer({ input, dataset: DATASET });
    if ('blocked' in comparison) return;
    if (comparison.breakEvenMonth !== null) {
      expect(comparison.breakEvenMonth).toBeGreaterThan(36);
      expect(comparison.breakEvenMonth).toBeLessThanOrEqual(120);
    }
    expect(Number.isFinite(comparison.finalDifference)).toBe(true);
  });

  it('두 구간이 빈틈없이 이어 붙는다', () => {
    const comparison = compareTransfer({ input, dataset: DATASET });
    if ('blocked' in comparison) return;
    const [firstLeg, secondLeg] = comparison.withTransfer;
    expect(
      firstLeg.ledger.entries.length + secondLeg.ledger.entries.length,
    ).toBe(comparison.without.ledger.entries.length);
  });

  it('이전 자금이 새지 않는다 — ISA 납입액은 세후 현금과 총 한도를 넘지 않는다', () => {
    const comparison = compareTransfer({ input, dataset: DATASET });
    if ('blocked' in comparison) return;
    const [firstLeg, secondLeg] = comparison.withTransfer;
    const proceeds = firstLeg.finalAfterTax;

    expect(secondLeg.totalContributed).toBeLessThanOrEqual(proceeds);
    expect(secondLeg.totalContributed).toBeLessThanOrEqual(C.isa.totalLimit);
    // 즉시세는 1구간이 낸 세금의 일부다 — 이 관계가 깨지면 세금을 두 번 뺐다는 뜻이다
    expect(comparison.immediateTax).toBeLessThanOrEqual(
      firstLeg.finalBeforeTax - firstLeg.finalAfterTax + 1,
    );
  });

  it('전액이 아닌 일부 이전은 조용히 전액으로 바꾸지 않고 거부한다', () => {
    const blocked = compareTransfer({
      input: {
        ...input,
        transferEvents: [
          { atMonth: 36, from: 'DIRECT_US', to: 'ISA', amount: 50_000_000 },
        ],
      },
      dataset: DATASET,
    });
    expect('blocked' in blocked).toBe(true);
    if (!('blocked' in blocked)) return;
    expect(blocked.blocked[0].code).toBe('TRANSFER_NOT_SUPPORTED');
  });

  it('이전 이후 구간이 남지 않으면 거부한다', () => {
    const blocked = compareTransfer({
      input: {
        ...input,
        transferEvents: [
          { atMonth: 120, from: 'DIRECT_US', to: 'ISA', amount: 'all' },
        ],
      },
      dataset: DATASET,
    });
    expect('blocked' in blocked).toBe(true);
  });

  it('ISA에 담을 수 없는 노출이면 이전을 거부한다', () => {
    const blocked = compareTransfer({
      input: {
        ...input,
        allocations: [
          { accountId: 'DIRECT_US', exposure: 'NASDAQ100_3X', weight: 1 },
        ],
      },
      dataset: makeDataset({ days: 6000, dailyReturn: 0, productIds: ['TQQQ'] }),
    });
    expect('blocked' in blocked).toBe(true);
  });
});

describe('engine의 이전 이벤트 거부', () => {
  it('simulate에 이전 이벤트를 넘기면 조용히 무시하지 않고 거부한다', () => {
    const outcome = simulate(
      baseInput({
        transferEvents: [{ atMonth: 36, from: 'DIRECT_US', to: 'ISA', amount: 'all' }],
      }),
      DATASET,
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.blockers[0].code).toBe('TRANSFER_NOT_SUPPORTED');
  });
});
