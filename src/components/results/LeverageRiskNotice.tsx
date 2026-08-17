import { computeDrawdown, type PortfolioIndexPoint } from '../../lib/sim/drawdown';
import type { Allocation } from '../../lib/sim/types';
import type { IndexExposure } from '../../lib/data/types';

const LEVERAGED_EXPOSURES = new Set<IndexExposure>([
  'NASDAQ100_2X',
  'NASDAQ100_3X',
  'SP500_2X',
  'SP500_3X',
]);

/**
 * §13.4는 탭 구분 없는 전역 규칙이다 — 탭 1(미래 설계)도 historicalPath 모드로는
 * 실제 일별 수익률 경로를 재생하므로 계산 가능한 MDD가 존재한다(M25).
 * portfolioIndex는 탭 1·2 결과 모두에 이미 들어 있으므로 이 컴포넌트가 재사용한다.
 */
export function LeverageRiskNotice({
  allocations,
  portfolioIndex,
}: {
  allocations: Allocation[];
  portfolioIndex: PortfolioIndexPoint[];
}) {
  const hasLeverage = allocations.some((a) => LEVERAGED_EXPOSURES.has(a.exposure));
  if (!hasLeverage) return null;

  const drawdown = computeDrawdown(portfolioIndex);
  if (drawdown === null) return null;

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-red-300 bg-red-50 p-3 text-sm dark:border-red-800 dark:bg-red-950">
      <p>
        ⚠ 레버리지 상품은 변동성이 큽니다 — 이 수익률 경로를 그대로 재생하면 최대낙폭 -
        {(drawdown.maxDrawdown * 100).toFixed(1)}%,{' '}
        {drawdown.recovery === null
          ? '시뮬레이션 종료까지 원금을 회복하지 못합니다.'
          : `회복까지 ${drawdown.recoveryMonths}개월이 걸립니다.`}
      </p>
    </div>
  );
}
