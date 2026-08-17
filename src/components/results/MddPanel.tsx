import { computeDrawdown, type PortfolioIndexPoint } from '../../lib/sim/drawdown';

/** §8 "이 탭의 핵심 지표" — MDD와 원금 회복 소요기간 */
export function MddPanel({ portfolioIndex }: { portfolioIndex: PortfolioIndexPoint[] }) {
  const drawdown = computeDrawdown(portfolioIndex);
  if (drawdown === null) return null;

  return (
    <div className="flex flex-col gap-1 rounded-lg border p-4">
      <h3 className="text-sm font-medium">최대낙폭(MDD)</h3>
      <p className="text-lg font-medium text-red-600">
        -{(drawdown.maxDrawdown * 100).toFixed(1)}% ({drawdown.peak.date} 고점 → {drawdown.trough.date}{' '}
        저점)
      </p>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {drawdown.recovery === null
          ? '시뮬레이션 종료 시점까지 고점을 회복하지 못했습니다.'
          : `${drawdown.recovery.date}에 고점 수준을 회복했습니다(고점 이후 ${drawdown.recoveryMonths}개월 소요).`}
      </p>
    </div>
  );
}
