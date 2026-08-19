import { describe, it, expect } from 'vitest';
import { seekContribution } from './goal-seek';
import { simulate } from './engine';
import { makeDataset, baseInput } from './__fixtures__/simulation';

const DATASET = makeDataset({ days: 6000, dailyReturn: 0, productIds: ['QQQ'] });

describe('seekContribution', () => {
  it('목표금액 ±1원 안으로 수렴한다', () => {
    const input = baseInput({
      years: 10,
      returnSource: { type: 'constantCagr', annualRate: 0.07 },
    });
    const target = 300_000_000;
    const result = seekContribution({ input, dataset: DATASET, target });

    expect(result.reachable).toBe(true);
    if (!result.reachable) return;
    expect(Math.abs(result.finalAfterTax - target)).toBeLessThan(1);
  });

  it('anchor가 있어도 수렴한다 — base만 움직였다면 실패했을 케이스', () => {
    const input = baseInput({
      years: 15,
      contribution: {
        base: 5_000_000,
        growthRate: 0.05,
        anchors: { 4: 10_000_000 },
      },
      returnSource: { type: 'constantCagr', annualRate: 0.07 },
    });
    const result = seekContribution({
      input,
      dataset: DATASET,
      target: 3_000_000_000,
    });

    expect(result.reachable).toBe(true);
    if (!result.reachable) return;
    expect(Math.abs(result.finalAfterTax - 3_000_000_000)).toBeLessThan(1);
    // 형태 보존 — anchor도 같은 배수로 커진다
    expect(result.schedule.anchors[4] / result.schedule.base).toBeCloseTo(
      10_000_000 / 5_000_000,
      10,
    );
    expect(result.schedule.growthRate).toBe(0.05);
  });

  it('찾아낸 스케줄로 다시 시뮬하면 같은 결과가 나온다', () => {
    const input = baseInput({
      years: 10,
      returnSource: { type: 'constantCagr', annualRate: 0.07 },
    });
    const result = seekContribution({
      input,
      dataset: DATASET,
      target: 300_000_000,
    });
    expect(result.reachable).toBe(true);
    if (!result.reachable) return;

    const replay = simulate(
      { ...input, contribution: result.schedule },
      DATASET,
    );
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.result.finalAfterTax).toBeCloseTo(result.finalAfterTax, 4);
  });

  it('도달 불가능하면 수렴을 시도하지 않고 최대 달성치를 낸다', () => {
    const input = baseInput({
      years: 1,
      returnSource: { type: 'constantCagr', annualRate: 0 },
    });
    const result = seekContribution({
      input,
      dataset: DATASET,
      target: 1_000_000_000_000_000,
    });

    expect(result.reachable).toBe(false);
    if (result.reachable) return;
    expect(result.maxAchievable).toBeGreaterThan(0);
    expect(result.maxAchievable).toBeLessThan(1_000_000_000_000_000);
  });

  // 참고: v1 단순화로 ISA 계좌가 제거되었으므로, 배분의 불가능함으로 인한 `ok:false`
  // 시나리오는 더 이상 존재하지 않습니다. 그 대신 `hiValue === null` 조기 탈출 경로는
  // goal-seek.max-achievable.test.ts의 첫 번째 테스트(배증 도중 계산 불가)에서
  // simulate를 모킹하여 검증합니다.

  it('연도별 변화 미리보기를 함께 낸다 (§5.7의 결과 표시)', () => {
    const input = baseInput({
      years: 15,
      contribution: {
        base: 5_000_000,
        growthRate: 0.05,
        anchors: { 4: 10_000_000 },
      },
      returnSource: { type: 'constantCagr', annualRate: 0.07 },
    });
    const result = seekContribution({
      input,
      dataset: DATASET,
      target: 3_000_000_000,
    });

    expect(result.reachable).toBe(true);
    if (!result.reachable) return;
    expect(result.preview).toHaveLength(15);
    expect(result.preview[4].isAnchor).toBe(true);
    expect(result.preview[0].isAnchor).toBe(false);
    for (const row of result.preview) {
      expect(row.after / row.before).toBeCloseTo(result.factor, 8);
    }
  });

  it('60회 반복이 브라우저에서 실용적인 시간 안에 끝난다', () => {
    const started = performance.now();
    seekContribution({
      input: baseInput({
        years: 30,
        returnSource: { type: 'constantCagr', annualRate: 0.07 },
      }),
      dataset: makeDataset({ days: 8000, dailyReturn: 0, productIds: ['QQQ'] }),
      target: 3_000_000_000,
    });
    expect(performance.now() - started).toBeLessThan(3000);
  });
});
