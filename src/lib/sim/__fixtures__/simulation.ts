import type { Dataset } from '../../data/dataset';
import type { ProductDataFacts } from '../../data/manifest';
import type { SimulationInput } from '../types';

/** 평일 축 위에 일정 수익률과 고정 환율을 깔아 검증 가능한 데이터셋을 만든다 */
export function makeDataset(params: {
  days: number;
  dailyReturn: number;
  fxDailyReturn?: number;
  productIds: string[];
  availableFrom?: string;
  syntheticUntil?: string | null;
}): Dataset {
  const dates: string[] = [];
  const cursor = new Date(Date.UTC(2010, 0, 1));
  while (dates.length < params.days) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const level = (rate: number, start: number): Float64Array => {
    const out = new Float64Array(params.days);
    let value = start;
    for (let i = 0; i < params.days; i += 1) {
      out[i] = value;
      value *= 1 + rate;
    }
    return out;
  };

  const seriesById = new Map<string, Float64Array>();
  const factsById = new Map<string, ProductDataFacts>();
  for (const id of params.productIds) {
    seriesById.set(id, level(params.dailyReturn, 100));
    factsById.set(id, {
      id,
      availableFrom: params.availableFrom ?? dates[0],
      syntheticUntil: params.syntheticUntil ?? null,
      length: params.days,
      filledGapDays: 0,
    });
  }

  return {
    dates,
    fxRates: level(params.fxDailyReturn ?? 0, 1500),
    seriesById,
    factsById,
  };
}

export function baseInput(overrides: Partial<SimulationInput> = {}): SimulationInput {
  return {
    mode: 'future',
    startMonth: '2026-09',
    initialAmount: 0,
    years: 2,
    contribution: { base: 1_000_000, growthRate: 0, anchors: {} },
    employmentIncome: { base: 60_000_000, growthRate: 0, anchors: {} },
    allocations: [{ accountId: 'DIRECT_US', exposure: 'NASDAQ100_1X', weight: 1 }],
    returnSource: { type: 'constantCagr', annualRate: 0 },
    fxAssumption: { type: 'fixed', rate: 1500 },
    realizationStrategy: { type: 'holdUntilExit' },
    transferEvents: [],
    displayCurrency: 'KRW',
    ...overrides,
  };
}
