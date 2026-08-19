import { describe, it, expect, vi } from 'vitest';
import type { Dataset } from '../data/dataset';
import type { SimulationInput } from './types';
import { seekContribution } from './goal-seek';
import { baseInput } from './__fixtures__/simulation';

/**
 * `maxAchievable`가 배증 탐색 도중 나중 배수에서 계산이 막혀도
 * 그 이전에 성립했던 마지막 유효값을 보고하는지 검증한다.
 *
 * 실제 `simulate()`는 배분(allocations)만으로 ok/false가 갈리고 납입 배수(factor)에는
 * 영향받지 않는다 — `scaleSchedule`은 계좌·노출 조합을 건드리지 않기 때문이다.
 * 따라서 "작은 배수는 성공하고 더 큰 배수에서 실패하는" 상황은 현재 공개 API로는
 * 재현할 수 없다. 이 테스트는 `./engine`의 `simulate`를 배수에 따라 성공/실패가
 * 갈리도록 모킹해, goal-seek의 내부 로직(마지막 유효값 추적)만 따로 검증한다.
 */
vi.mock('./engine', () => {
  const ORIGINAL_BASE = 1_000_000;
  return {
    simulate: (input: SimulationInput) => {
      const factor = input.contribution.base / ORIGINAL_BASE;
      // factor 4 이상은 방어적 테스트를 위해 강제로 계산 불가 처리한다
      if (factor >= 4) {
        return { ok: false, blockers: [] };
      }
      return {
        ok: true,
        result: {
          ledger: { entries: [], syntheticRatio: 0 },
          yearlyTax: [],
          exitBreakdowns: [],
          finalBeforeTax: factor * 100,
          finalAfterTax: factor * 100,
          totalContributed: 0,
          totalTax: 0,
          harvest: { taxFreeGain: 0, savedTax: 0 },
          syntheticRatio: 0,
          warnings: [],
          labels: { path: null },
        },
      };
    },
  };
});

const dataset: Dataset = {
  dates: [],
  fxRates: new Float64Array(0),
  seriesById: new Map(),
  factsById: new Map(),
};

describe('seekContribution — maxAchievable 방어 로직', () => {
  it('배증 도중 나중 배수에서 계산이 막혀도 이전 유효값을 최대 달성치로 낸다', () => {
    // factor=2에서 finalAfterTax=200(성공) → factor=4에서 계산 불가(null)로 종료.
    // 고침 전에는 이 경우 maxAchievable이 0으로 나왔다.
    const input = baseInput({ years: 5 });
    const result = seekContribution({ input, dataset, target: 100_000 });

    expect(result.reachable).toBe(false);
    if (result.reachable) return;
    expect(result.maxFactor).toBe(4);
    expect(result.maxAchievable).toBe(200);
    expect(result.maxAchievable).toBeGreaterThan(0);
  });

  it('첫 배수(factor=2)부터 계산이 막히면 여전히 0을 낸다 — 유효값이 아예 없는 경우', () => {
    const input = baseInput({ years: 5, contribution: { base: 3_000_000, growthRate: 0, anchors: {} } });
    const result = seekContribution({ input, dataset, target: 100_000 });

    expect(result.reachable).toBe(false);
    if (result.reachable) return;
    expect(result.maxAchievable).toBe(0);
  });
});
