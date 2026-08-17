import { describe, it, expect } from 'vitest';
import { redistributeWeights } from './allocation';

describe('redistributeWeights', () => {
  it('방금 바꾼 슬라이더 값을 그대로 확정한다', () => {
    const result = redistributeWeights({ ISA: 0.5, DIRECT_US: 0.5 }, 'ISA', 0.7);
    expect(result.ISA).toBeCloseTo(0.7, 10);
  });

  it('나머지는 기존 비율대로 남은 몫을 나눠 갖는다', () => {
    const result = redistributeWeights(
      { ISA: 0.5, DIRECT_US: 0.3, DOMESTIC_ETF: 0.2 },
      'ISA',
      0.8,
    );
    // 남은 0.2를 DIRECT_US:DOMESTIC_ETF = 3:2 비율로 나눈다
    expect(result.DIRECT_US).toBeCloseTo(0.12, 10);
    expect(result.DOMESTIC_ETF).toBeCloseTo(0.08, 10);
  });

  it('합계가 항상 1이다', () => {
    const result = redistributeWeights(
      { ISA: 0.5, DIRECT_US: 0.3, DOMESTIC_ETF: 0.2 },
      'DIRECT_US',
      0.9,
    );
    const total = Object.values(result).reduce((sum, w) => sum + w, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it('나머지 계좌가 모두 0이면 균등하게 나눈다', () => {
    const result = redistributeWeights({ ISA: 1, DIRECT_US: 0 }, 'ISA', 0.4);
    expect(result.DIRECT_US).toBeCloseTo(0.6, 10);
  });

  it('0~1 범위를 벗어난 값은 클램프한다', () => {
    expect(redistributeWeights({ ISA: 0.5, DIRECT_US: 0.5 }, 'ISA', 1.5).ISA).toBe(1);
    expect(redistributeWeights({ ISA: 0.5, DIRECT_US: 0.5 }, 'ISA', -0.5).ISA).toBe(0);
  });

  it('계좌가 하나뿐이면 그대로 1이다', () => {
    const result = redistributeWeights({ ISA: 1 }, 'ISA', 0.3);
    expect(result.ISA).toBe(0.3);
  });
});
