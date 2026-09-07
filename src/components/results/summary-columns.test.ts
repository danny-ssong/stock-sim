import { describe, expect, it } from 'vitest';
import { pickBestIndices, type SummaryMetrics } from '../../lib/sim/summary-metrics';
import { SUMMARY_COLUMNS, type SummaryColumn } from './summary-columns';

function columnFor(key: keyof SummaryMetrics): SummaryColumn {
  const column = SUMMARY_COLUMNS.find((candidate) => candidate.key === key);
  if (column === undefined) throw new Error(`${key} 열이 없다`);
  return column;
}

function metrics(overrides: Partial<SummaryMetrics> = {}): SummaryMetrics {
  return {
    afterTax: 0,
    returnRate: null,
    maxDrawdown: null,
    peakRecovery: null,
    principalRecovery: null,
    ...overrides,
  };
}

/** 열을 테스트 안에서 찾는다 — 모듈 로드 시점에 찾으면 열이 없을 때 수집 자체가
 *  실패해 어느 기대가 깨졌는지 보이지 않는다 */
const principal = {
  format: (m: SummaryMetrics) => columnFor('principalRecovery').format(m),
  tone: (m: SummaryMetrics) => columnFor('principalRecovery').tone?.(m) ?? null,
  sortValue: (m: SummaryMetrics) => columnFor('principalRecovery').sortValue(m),
  get direction() {
    return columnFor('principalRecovery').direction;
  },
};
const peak = {
  format: (m: SummaryMetrics) => columnFor('peakRecovery').format(m),
};

describe('원금 회복 열', () => {
  it('원금을 하회한 적이 없으면 "하회 없음"이다 — 미회복과 같은 —로 찍지 않는다', () => {
    expect(principal.format(metrics({ principalRecovery: { kind: 'never-fell' } }))).toBe(
      '하회 없음',
    );
  });

  it('회복했으면 걸린 개월을 낸다', () => {
    expect(principal.format(metrics({ principalRecovery: { kind: 'recovered', months: 20 } }))).toBe(
      '20개월',
    );
  });

  it('기간이 끝나도록 회복하지 못했으면 "미회복"이다', () => {
    expect(principal.format(metrics({ principalRecovery: { kind: 'unrecovered' } }))).toBe('미회복');
  });

  it('잴 대상이 없으면(null) —다', () => {
    expect(principal.format(metrics())).toBe('—');
  });
});

describe('전고점 회복 열', () => {
  it('하락이 없었으면 "하락 없음"이다 — 원금 열의 "하회 없음"과 다른 사실이다', () => {
    expect(peak.format(metrics({ peakRecovery: { kind: 'never-fell' } }))).toBe('하락 없음');
  });

  it('회복했으면 걸린 개월을 낸다', () => {
    expect(peak.format(metrics({ peakRecovery: { kind: 'recovered', months: 8 } }))).toBe('8개월');
  });

  it('기간이 끝나도록 회복하지 못했으면 "미회복"이다', () => {
    expect(peak.format(metrics({ peakRecovery: { kind: 'unrecovered' } }))).toBe('미회복');
  });
});

describe('회복 열의 경고 톤', () => {
  it('미회복만 경고다 — 사용자가 감수한 위험이 아직 끝나지 않았다는 뜻이다', () => {
    expect(principal.tone(metrics({ principalRecovery: { kind: 'unrecovered' } }))).toBe('warning');
  });

  it('하회 없음은 색을 주지 않는다 — 최우수 강조와 신호가 겹친다', () => {
    expect(principal.tone(metrics({ principalRecovery: { kind: 'never-fell' } }))).toBeNull();
  });

  it('회복한 개월 수에는 색을 주지 않는다', () => {
    expect(principal.tone(metrics({ principalRecovery: { kind: 'recovered', months: 20 } }))).toBeNull();
  });
});

describe('회복 열의 비교값', () => {
  it('하회 없음은 0개월보다도 좋다 — 회복할 결손 자체가 없었다', () => {
    const never = principal.sortValue(metrics({ principalRecovery: { kind: 'never-fell' } }));
    const zero = principal.sortValue(metrics({ principalRecovery: { kind: 'recovered', months: 0 } }));
    expect(never).not.toBeNull();
    expect(zero).not.toBeNull();
    if (never === null || zero === null) return;
    expect(never).toBeLessThan(zero);
  });

  it('회복한 열은 개월 수로 비교한다', () => {
    expect(principal.sortValue(metrics({ principalRecovery: { kind: 'recovered', months: 20 } }))).toBe(20);
  });

  it('미회복은 비교 후보에서 뺀다 — 둘 다 미회복인데 둘 다 최우수로 칠해지면 안 된다', () => {
    expect(principal.sortValue(metrics({ principalRecovery: { kind: 'unrecovered' } }))).toBeNull();
  });

  it('하회 없는 상품이 회복에 걸린 상품보다 최우수로 뽑힌다', () => {
    const rows = [
      metrics({ principalRecovery: { kind: 'recovered', months: 20 } }),
      metrics({ principalRecovery: { kind: 'never-fell' } }),
    ];
    const best = pickBestIndices(rows.map(principal.sortValue), principal.direction);
    expect(best).toEqual(new Set([1]));
  });
});
