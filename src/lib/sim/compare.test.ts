import { describe, it, expect } from 'vitest';
import { runScenario, productExposuresForScenarios, type ScenarioConfig } from './compare';
import { makeDataset } from './__fixtures__/simulation';
import type { SimulationInput } from './types';

/** 계좌가 하나뿐이라 시나리오는 노출(exposure)만 바뀐다 — QQQ/TQQQ 두 상품을 담는다. */
const fixtureDataset = makeDataset({
  days: 6000,
  dailyReturn: 0.0003,
  productIds: ['QQQ', 'TQQQ'],
});

describe('runScenario', () => {
  it('시나리오가 노출만 바꿔 실행된다', () => {
    const base: SimulationInput = {
      mode: 'future',
      startMonth: '2026-01',
      initialAmount: 0,
      years: 1,
      contribution: { base: 1_000_000, growthRate: 0, anchors: {} },
      exposure: 'NASDAQ100_1X',
      returnSource: { type: 'constantCagr', annualRate: 0.08 },
    };
    const outcome = runScenario(base, { label: '시나리오 A', exposure: 'NASDAQ100_3X' }, fixtureDataset);
    expect(outcome.kind).toBe('ready');
    if (outcome.kind !== 'ready') return;
    expect(outcome.result.ledger.entries[0].productId).toBe('TQQQ');
  });
});

describe('productExposuresForScenarios', () => {
  it('시나리오들의 노출을 그대로 모은다', () => {
    const scenarios: ScenarioConfig[] = [
      { label: 'A', exposure: 'NASDAQ100_1X' },
      { label: 'B', exposure: 'SP500_3X' },
    ];
    expect(productExposuresForScenarios(scenarios)).toEqual(['NASDAQ100_1X', 'SP500_3X']);
  });
});
