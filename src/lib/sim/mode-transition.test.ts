import { describe, it, expect } from 'vitest';
import { applyMode } from './mode-transition';
import { BACKFILL_START } from '../data/catalog';
import type { SimulationInputBase } from './types';

const TODAY = '2026-08-23';

const CAGR_BASE: SimulationInputBase = {
  mode: 'future',
  startMonth: '2026-08',
  initialAmount: 100_000_000,
  years: 15,
  contribution: { base: 1_500_000, growthRate: 0.05, anchors: {} },
  returnSource: { type: 'constantCagr', annualRate: 0.08 },
};

const PATH_BASE: SimulationInputBase = {
  ...CAGR_BASE,
  returnSource: {
    type: 'historicalPath',
    from: '2011-08-01',
    to: '2026-08-01',
    tileMode: 'repeat',
  },
};

describe('applyMode', () => {
  it('백테스트로 갈 때 고정 수익률을 과거 구간 재생으로 바꾼다 — 감춰진 UI의 경고를 남기지 않는다', () => {
    const next = applyMode(CAGR_BASE, 'backtest', TODAY);
    expect(next.mode).toBe('backtest');
    expect(next.returnSource).toEqual({
      type: 'historicalPath',
      from: BACKFILL_START,
      to: TODAY,
      tileMode: 'repeat',
    });
  });

  it('이미 과거 구간 재생이면 사용자가 고른 구간을 그대로 둔다', () => {
    const next = applyMode(PATH_BASE, 'backtest', TODAY);
    expect(next.mode).toBe('backtest');
    expect(next.returnSource).toEqual(PATH_BASE.returnSource);
  });

  it('미래 설계로 돌아갈 때는 수익률 소스를 건드리지 않는다', () => {
    expect(applyMode(PATH_BASE, 'future', TODAY).returnSource).toEqual(PATH_BASE.returnSource);
    expect(applyMode(CAGR_BASE, 'future', TODAY).returnSource).toEqual(CAGR_BASE.returnSource);
  });

  it('납입 계획은 어느 방향으로도 유지된다', () => {
    const next = applyMode(CAGR_BASE, 'backtest', TODAY);
    expect(next.contribution).toEqual(CAGR_BASE.contribution);
    expect(next.initialAmount).toBe(CAGR_BASE.initialAmount);
    expect(next.years).toBe(CAGR_BASE.years);
  });

  it('원본을 변형하지 않는다', () => {
    applyMode(CAGR_BASE, 'backtest', TODAY);
    expect(CAGR_BASE.mode).toBe('future');
    expect(CAGR_BASE.returnSource.type).toBe('constantCagr');
  });
});
