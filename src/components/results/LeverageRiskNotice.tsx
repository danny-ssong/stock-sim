import { computeDrawdown, type PortfolioIndexPoint } from '../../lib/sim/drawdown';
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
  exposure,
  portfolioIndex,
  isHistoricalPath,
}: {
  exposure: IndexExposure;
  portfolioIndex: PortfolioIndexPoint[];
  /**
   * true면 이 결과가 실제 과거 수익률 경로를 재생한 것이다(탭 2는 항상, 탭 1은
   * historicalPath 선택 시). false면 직선 CAGR 가정이다. 낙폭 0일 때 두 경우의
   * 원인이 다르므로(전자는 "그 구간엔 진짜로 하락이 없었다", 후자는 "이 가정 자체가
   * 하락을 표현 못 한다") 메시지를 갈라야 한다 — 최종 리뷰 지적.
   */
  isHistoricalPath: boolean;
}) {
  if (!LEVERAGED_EXPOSURES.has(exposure)) return null;

  const drawdown = computeDrawdown(portfolioIndex);
  if (drawdown === null) return null;

  if (drawdown.maxDrawdown === 0) {
    return (
      <div className="flex flex-col gap-1 rounded-lg border border-red-300 bg-red-50 p-3 text-sm dark:border-red-800 dark:bg-red-950">
        <p>
          {isHistoricalPath
            ? '⚠ 레버리지 상품은 변동성이 큽니다 — 이 구간에서는 고점 대비 하락이 없었습니다.'
            : '⚠ 레버리지 상품은 변동성이 큽니다 — 직선 CAGR 가정에서는 실제 낙폭이 재현되지 않으니, 과거 경로 모드에서 확인하세요.'}
        </p>
      </div>
    );
  }

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
