import { describe, it, expect } from 'vitest';
import {
  runScenario,
  scenarioFinalAfterTax,
  scenarioTotalTax,
  allocationsForProductIds,
  type ScenarioConfig,
} from './compare';
import { makeDataset, baseInput } from './__fixtures__/simulation';

const DATASET = makeDataset({
  days: 6000,
  dailyReturn: 0.0003,
  productIds: ['QQQ', 'TIGER_NASDAQ100'],
});

describe('runScenario — allocation 시나리오', () => {
  it('simulate()를 그대로 호출해 결과를 낸다', () => {
    const base = baseInput({ years: 5 });
    const scenario: ScenarioConfig = {
      kind: 'allocation',
      label: '시나리오 A',
      allocations: [{ accountId: 'ISA', exposure: 'NASDAQ100_1X', weight: 1 }],
    };
    const outcome = runScenario(base, scenario, DATASET);
    expect(outcome.kind).toBe('allocation');
    if (outcome.kind !== 'allocation') return;
    expect(outcome.result.finalAfterTax).toBeGreaterThan(0);
    expect(outcome.input.allocations).toEqual(scenario.allocations);
  });

  it('담을 수 없는 조합은 blocked를 낸다', () => {
    const base = baseInput({ years: 5 });
    const scenario: ScenarioConfig = {
      kind: 'allocation',
      label: '불가능',
      allocations: [{ accountId: 'ISA', exposure: 'NASDAQ100_3X', weight: 1 }],
    };
    const outcome = runScenario(base, scenario, DATASET);
    expect(outcome.kind).toBe('blocked');
  });
});

describe('runScenario — transfer 시나리오', () => {
  it('compareTransfer()를 호출해 이전/유지 비교를 낸다', () => {
    const base = baseInput({
      years: 10,
      initialAmount: 100_000_000,
      contribution: { base: 0, growthRate: 0, anchors: {} },
      returnSource: { type: 'constantCagr', annualRate: 0.1 },
      fxAssumption: { type: 'fixed', rate: 1500 },
    });
    const scenario: ScenarioConfig = {
      kind: 'transfer',
      label: 'ISA 이전',
      exposure: 'NASDAQ100_1X',
      transferYear: 3,
    };
    const outcome = runScenario(base, scenario, DATASET);
    expect(outcome.kind).toBe('transfer');
    if (outcome.kind !== 'transfer') return;
    expect(outcome.comparison.immediateTax).toBeGreaterThan(0);
  });
});

describe('scenarioFinalAfterTax / scenarioTotalTax', () => {
  const base = baseInput({
    years: 10,
    initialAmount: 100_000_000,
    contribution: { base: 0, growthRate: 0, anchors: {} },
    returnSource: { type: 'constantCagr', annualRate: 0.1 },
    fxAssumption: { type: 'fixed', rate: 1500 },
  });

  it('allocation 시나리오는 result 필드를 그대로 반환한다', () => {
    const scenario: ScenarioConfig = {
      kind: 'allocation',
      label: 'A',
      allocations: [{ accountId: 'ISA', exposure: 'NASDAQ100_1X', weight: 1 }],
    };
    const outcome = runScenario(base, scenario, DATASET);
    expect(scenarioFinalAfterTax(outcome)).toBe(
      outcome.kind === 'allocation' ? outcome.result.finalAfterTax : null,
    );
    expect(scenarioTotalTax(outcome)).toBe(
      outcome.kind === 'allocation' ? outcome.result.totalTax : null,
    );
  });

  it('transfer 시나리오는 이전 후 최종 세후금액(대기 현금 포함)을 반환한다', () => {
    const scenario: ScenarioConfig = {
      kind: 'transfer',
      label: 'B',
      exposure: 'NASDAQ100_1X',
      transferYear: 3,
    };
    const outcome = runScenario(base, scenario, DATASET);
    if (outcome.kind !== 'transfer') throw new Error('transfer expected');
    const expected =
      outcome.comparison.withTransfer[1].finalAfterTax + outcome.comparison.idleCash;
    expect(scenarioFinalAfterTax(outcome)).toBeCloseTo(expected, 6);
    const expectedTax =
      outcome.comparison.withTransfer[0].totalTax + outcome.comparison.withTransfer[1].totalTax;
    expect(scenarioTotalTax(outcome)).toBeCloseTo(expectedTax, 6);
  });

  it('blocked 시나리오는 null을 반환한다', () => {
    const scenario: ScenarioConfig = {
      kind: 'allocation',
      label: 'C',
      allocations: [{ accountId: 'ISA', exposure: 'NASDAQ100_3X', weight: 1 }],
    };
    const outcome = runScenario(base, scenario, DATASET);
    expect(scenarioFinalAfterTax(outcome)).toBeNull();
    expect(scenarioTotalTax(outcome)).toBeNull();
  });
});

describe('allocationsForProductIds', () => {
  it('allocation 시나리오는 그 배분을 그대로 담는다', () => {
    const scenarios: ScenarioConfig[] = [
      {
        kind: 'allocation',
        label: 'A',
        allocations: [{ accountId: 'ISA', exposure: 'NASDAQ100_1X', weight: 1 }],
      },
    ];
    expect(allocationsForProductIds(scenarios)).toEqual([
      { accountId: 'ISA', exposure: 'NASDAQ100_1X', weight: 1 },
    ]);
  });

  it('transfer 시나리오는 해외직투·ISA 양쪽 상품을 모두 담는다(이전받는 쪽 데이터도 필요)', () => {
    const scenarios: ScenarioConfig[] = [
      { kind: 'transfer', label: 'B', exposure: 'NASDAQ100_1X', transferYear: 3 },
    ];
    const result = allocationsForProductIds(scenarios);
    expect(result).toEqual([
      { accountId: 'DIRECT_US', exposure: 'NASDAQ100_1X', weight: 1 },
      { accountId: 'ISA', exposure: 'NASDAQ100_1X', weight: 1 },
    ]);
  });
});
