import { exposureLabelWithTicker } from '../../lib/data/labels';
import { formatKrwHuman } from '../../lib/format';
import type { ExposureOutcome } from '../../lib/sim/compare';
import { computeDrawdown } from '../../lib/sim/drawdown';
import { WarningsBanner } from './WarningsBanner';

/**
 * 노출 하나의 요약 카드. 라벨을 사용자가 붙이지 않고 카탈로그에서 파생시킨다 —
 * 노출이 곧 비교 단위가 되면서 이름을 따로 붙일 이유가 없어졌다(D4).
 * 비교 화면과 단일 종목 화면이 모두 이 카드를 쓴다 — 노출 개수가 1↔2+로 바뀔 때
 * 카드 포맷 자체가 달라지면 레이아웃이 크게 흔들리기 때문이다.
 */
export function ExposureSummaryCard({ outcome }: { outcome: ExposureOutcome }) {
  const label = exposureLabelWithTicker(outcome.exposure);

  if (outcome.kind === 'blocked') {
    return (
      <div className="flex flex-col gap-2 rounded-lg border p-4">
        <h3 className="text-sm font-medium">{label}</h3>
        <ul className="text-sm text-red-600">
          {outcome.blockers.length === 0 ? (
            <li>이 조합으로는 시뮬레이션을 계산할 수 없습니다.</li>
          ) : (
            outcome.blockers.map((blocker, i) => (
              <li key={`${blocker.code}-${i}`}>{blocker.message}</li>
            ))
          )}
        </ul>
      </div>
    );
  }

  const { result } = outcome;
  const drawdown = computeDrawdown(result.portfolioIndex);
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-4">
      <h3 className="text-sm font-medium">{label}</h3>
      <p className="text-lg font-medium">세후 {formatKrwHuman(result.finalAfterTax)}</p>
      {drawdown !== null && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {drawdown.maxDrawdown === 0
            ? '최대낙폭(MDD) 이 구간에서는 고점 대비 하락이 없었습니다.'
            : `최대낙폭(MDD) -${(drawdown.maxDrawdown * 100).toFixed(1)}% · ${
                drawdown.recoveryMonths === null ? '회복 못함' : `원금 회복 ${drawdown.recoveryMonths}개월`
              }`}
        </p>
      )}
      {drawdown !== null && drawdown.maxDrawdown > 0 && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          적자 구간 {drawdown.peak.date} ~ {drawdown.recovery === null ? '진행 중' : drawdown.recovery.date}
        </p>
      )}
      <WarningsBanner warnings={result.warnings} syntheticRatio={result.syntheticRatio} />
    </div>
  );
}
