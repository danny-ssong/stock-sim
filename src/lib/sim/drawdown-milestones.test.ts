import { describe, it, expect } from 'vitest';
import { buildDrawdownMilestones } from './drawdown-milestones';
import type { DrawdownResult, PortfolioIndexPoint } from './drawdown';

function point(date: string, level: number, priceUsd: number | null): PortfolioIndexPoint {
  return { date, level, isSynthetic: false, priceUsd };
}

const INDEX: PortfolioIndexPoint[] = [
  point('2025-02-19', 1, 59.39),
  point('2025-03-13', 0.75, 44.47),
  point('2025-04-08', 0.58, 34.58),
  point('2025-07-03', 1.01, 59.74),
];

const DRAWDOWN: DrawdownResult = {
  maxDrawdown: 0.418,
  peak: { date: '2025-02-19' },
  trough: { date: '2025-04-08' },
  recovery: { date: '2025-07-03' },
  recoveryMonths: 5,
};

describe('buildDrawdownMilestones', () => {
  it('고점·저점·회복 날짜에 그날의 달러 가격을 붙인다', () => {
    expect(buildDrawdownMilestones(DRAWDOWN, INDEX)).toEqual({
      peak: { date: '2025-02-19', priceUsd: 59.39 },
      trough: { date: '2025-04-08', priceUsd: 34.58 },
      recovery: { date: '2025-07-03', priceUsd: 59.74 },
    });
  });

  it('전고점을 회복하지 못했으면 recovery가 null이다', () => {
    const notRecovered: DrawdownResult = { ...DRAWDOWN, recovery: null, recoveryMonths: null };
    expect(buildDrawdownMilestones(notRecovered, INDEX).recovery).toBeNull();
  });

  it('미래 모드처럼 실제 가격이 없으면 priceUsd는 null이다', () => {
    const noPrice = INDEX.map((p) => ({ ...p, priceUsd: null }));
    const milestones = buildDrawdownMilestones(DRAWDOWN, noPrice);

    expect(milestones.peak).toEqual({ date: '2025-02-19', priceUsd: null });
    expect(milestones.trough).toEqual({ date: '2025-04-08', priceUsd: null });
  });

  it('portfolioIndex에 없는 날짜면 날짜만 남기고 가격은 null이다', () => {
    // 두 배열이 같은 일별 축을 쓰므로 정상 경로에서는 일어나지 않지만,
    // 축이 어긋나도 카드가 죽지 않아야 한다
    const milestones = buildDrawdownMilestones(DRAWDOWN, [INDEX[0]]);

    expect(milestones.peak.priceUsd).toBe(59.39);
    expect(milestones.trough).toEqual({ date: '2025-04-08', priceUsd: null });
  });
});
