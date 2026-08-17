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
    expect('blocked' in comparison).toBe(false);
    if ('blocked' in comparison) throw new Error('계산되어야 한다');
    const [firstLeg, secondLeg] = comparison.withTransfer;
    expect(
      firstLeg.ledger.entries.length + secondLeg.ledger.entries.length,
    ).toBe(comparison.without.ledger.entries.length);
  });

  it('이전 자금이 새지 않는다 — ISA 납입액은 세후 현금과 총 한도를 넘지 않는다', () => {
    const comparison = compareTransfer({ input, dataset: DATASET });
    expect('blocked' in comparison).toBe(false);
    if ('blocked' in comparison) throw new Error('계산되어야 한다');
    const [firstLeg, secondLeg] = comparison.withTransfer;
    const proceeds = firstLeg.finalAfterTax;

    expect(secondLeg.totalContributed).toBeLessThanOrEqual(proceeds);
    expect(secondLeg.totalContributed).toBeLessThanOrEqual(C.isa.totalLimit);
    // 즉시세는 1구간이 낸 세금의 일부다 — 이 관계가 깨지면 세금을 두 번 뺐다는 뜻이다
    expect(comparison.immediateTax).toBeLessThanOrEqual(
      firstLeg.finalBeforeTax - firstLeg.finalAfterTax + 1,
    );
  });

  it('납입 계획이 실제로 2구간의 납입을 움직인다 — 한도까지 꽉 채운다', () => {
    const comparison = compareTransfer({ input, dataset: DATASET });
    expect('blocked' in comparison).toBe(false);
    if ('blocked' in comparison) throw new Error('계산되어야 한다');
    const [firstLeg, secondLeg] = comparison.withTransfer;

    // 세후 현금(약 1억 2,633만원)이 총 한도를 넘으므로 정확히 1억원이 들어가야 한다.
    // 상한만 검사하면 "한 푼도 안 넣는" 퇴행을 잡지 못한다.
    expect(secondLeg.totalContributed).toBeCloseTo(
      Math.min(firstLeg.finalAfterTax, C.isa.totalLimit),
      0,
    );

    // 어느 연차도 연 2,000만원을 넘지 않는다. 엔진의 ISA 한도가 연차(yearIndex)
    // 기준이므로 달력 연도가 아니라 연차로 묶는다 — 2구간 시작월이 1월이 아니면
    // 두 기준의 경계가 어긋난다.
    const contributedByYear = new Map<number, number>();
    for (const entry of secondLeg.ledger.entries) {
      const yearIndex = Math.floor(entry.monthIndex / 12);
      contributedByYear.set(
        yearIndex,
        (contributedByYear.get(yearIndex) ?? 0) + entry.contribution,
      );
    }
    expect(contributedByYear.size).toBe(7);
    for (const contributed of contributedByYear.values()) {
      expect(contributed).toBeLessThanOrEqual(C.isa.annualLimit + 1);
    }
  });

  it('한도 밖에서 노는 대기 현금과 빠진 정기 납입을 경고로 낸다 (§13)', () => {
    const comparison = compareTransfer({
      input: { ...input, contribution: { base: 500_000, growthRate: 0, anchors: {} } },
      dataset: DATASET,
    });
    expect('blocked' in comparison).toBe(false);
    if ('blocked' in comparison) throw new Error('계산되어야 한다');

    expect(comparison.idleCash).toBeGreaterThan(0);
    const codes = comparison.warnings.map((w) => w.code);
    expect(codes).toContain('TRANSFER_IDLE_CASH');
    expect(codes).toContain('TRANSFER_CONTRIBUTION_DROPPED');

    const idle = comparison.warnings.find((w) => w.code === 'TRANSFER_IDLE_CASH');
    if (idle?.code !== 'TRANSFER_IDLE_CASH') throw new Error('경고가 있어야 한다');
    expect(idle.amount).toBeCloseTo(comparison.idleCash, 6);
  });

  it('정기 납입이 없으면 납입 누락 경고를 내지 않는다', () => {
    const comparison = compareTransfer({ input, dataset: DATASET });
    if ('blocked' in comparison) throw new Error('계산되어야 한다');
    expect(comparison.warnings.map((w) => w.code)).not.toContain(
      'TRANSFER_CONTRIBUTION_DROPPED',
    );
  });

  it('역전 판정은 이전이 실제로 일어난 달부터 본다 — 반올림된 달은 보지 않는다', () => {
    // 30개월은 연 단위로 반올림되어 실제 이전은 36개월째에 일어난다.
    // 30~35개월은 두 시나리오가 아직 같은 자산을 들고 있는 구간이라, 여기서
    // 역전이 잡힌다면 계산 차이(달력 오차)를 역전으로 오인한 것이다.
    //
    // 2028-04 시작은 이 오차의 부호가 뒤집히는 달이다 — 1구간과 유지 쪽의
    // 연 거래일 수가 달라 이전 전인데도 1구간 곡선이 유지 곡선을 5만원가량
    // 앞선다. 이전 시점부터 보지 않으면 여기서 가짜 역전이 잡힌다.
    const comparison = compareTransfer({
      input: {
        ...input,
        startMonth: '2028-04',
        transferEvents: [
          { atMonth: 30, from: 'DIRECT_US', to: 'ISA', amount: 'all' },
        ],
      },
      dataset: DATASET,
    });
    expect('blocked' in comparison).toBe(false);
    if ('blocked' in comparison) throw new Error('계산되어야 한다');
    expect(comparison.withTransfer[0].ledger.entries).toHaveLength(36);
    if (comparison.breakEvenMonth !== null) {
      expect(comparison.breakEvenMonth).toBeGreaterThanOrEqual(36);
    }
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

describe('구간 경계의 경로 연속성 (§5.8)', () => {
  const transferEvents = [
    { atMonth: 36, from: 'DIRECT_US' as const, to: 'ISA' as const, amount: 'all' as const },
  ];
  const futureInput = baseInput({
    years: 10,
    initialAmount: 100_000_000,
    contribution: { base: 0, growthRate: 0, anchors: {} },
    allocations: [{ accountId: 'DIRECT_US', exposure: 'NASDAQ100_1X', weight: 1 }],
    transferEvents,
  });

  it('미래 모드의 과거 수익률 경로 재생은 경로가 이어지지 않으므로 거부한다', () => {
    const blocked = compareTransfer({
      input: {
        ...futureInput,
        returnSource: { type: 'historicalPath', from: '2015-01-02', to: '2020-01-02', tileMode: 'repeat' },
      },
      dataset: DATASET,
    });
    expect('blocked' in blocked).toBe(true);
    if (!('blocked' in blocked)) return;
    expect(blocked.blocked[0].code).toBe('TRANSFER_NOT_SUPPORTED');
  });

  it('미래 모드의 과거 환율 경로 재생도 거부한다', () => {
    const blocked = compareTransfer({
      input: { ...futureInput, fxAssumption: { type: 'historicalPath' } },
      dataset: DATASET,
    });
    expect('blocked' in blocked).toBe(true);
  });

  it('과거 백테스트 모드는 절대 날짜 축을 밟으므로 그대로 계산한다', () => {
    const comparison = compareTransfer({
      input: {
        ...futureInput,
        mode: 'backtest',
        startMonth: DATASET.dates[0].slice(0, 7),
        returnSource: { type: 'historicalPath', from: '', to: '', tileMode: 'repeat' },
        fxAssumption: { type: 'historicalPath' },
      },
      dataset: DATASET,
    });
    expect('blocked' in comparison).toBe(false);
    if ('blocked' in comparison) throw new Error('백테스트는 계산되어야 한다');
    expect(comparison.withTransfer[0].ledger.entries).toHaveLength(36);
  });

  it('백테스트에서는 이어 붙인 구간이 연속 시뮬과 같은 가격을 본다', () => {
    // 거부해도 되는지 판단의 근거 — 백테스트는 달력 오프셋이 날짜 축의 절대
    // 인덱스라 구간을 쪼개도 뒤 구간이 경로를 되감지 않는다.
    const common = {
      mode: 'backtest' as const,
      initialAmount: 100_000_000,
      contribution: { base: 0, growthRate: 0, anchors: {} },
      allocations: [
        { accountId: 'DIRECT_US' as const, exposure: 'NASDAQ100_1X' as const, weight: 1 },
      ],
      returnSource: { type: 'historicalPath' as const, from: '', to: '', tileMode: 'repeat' as const },
      fxAssumption: { type: 'historicalPath' as const },
    };
    const full = simulate(
      baseInput({ ...common, startMonth: DATASET.dates[0].slice(0, 7), years: 10 }),
      DATASET,
    );
    const secondLeg = simulate(
      baseInput({ ...common, startMonth: '2013-01', years: 7 }),
      DATASET,
    );
    expect(full.ok && secondLeg.ok).toBe(true);
    if (!full.ok || !secondLeg.ok) return;

    const legFirst = secondLeg.result.ledger.entries[0];
    const fullSameDate = full.result.ledger.entries.find(
      (e) => e.date === legFirst.date,
    );
    expect(fullSameDate?.buyPrice).toBe(legFirst.buyPrice);
    expect(fullSameDate?.fxRate).toBe(legFirst.fxRate);
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
