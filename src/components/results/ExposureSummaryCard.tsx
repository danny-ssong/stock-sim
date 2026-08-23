import { exposureLabelWithTicker } from '../../lib/data/labels';
import { formatKrwHuman } from '../../lib/format';
import type { ExposureOutcome } from '../../lib/sim/compare';
import { computeDrawdown } from '../../lib/sim/drawdown';
import type { OutcomeDiff } from '../../lib/sim/outcome-diff';
import { WarningsBanner } from './WarningsBanner';

function formatSigned(amountKrw: number): string {
  const formatted = formatKrwHuman(Math.abs(amountKrw));
  if (amountKrw > 0) return `+${formatted}`;
  if (amountKrw < 0) return `-${formatted}`;
  return formatted;
}

/** 비율(0~1) diff를 %p 문자열로 부호와 함께 낸다. MDD는 이미 양수 비율이라 diff가
 *  양수면 baseline보다 더 빠졌다는 뜻이다. */
function formatSignedPercentPoint(diff: number): string {
  const formatted = `${(Math.abs(diff) * 100).toFixed(1)}%p`;
  if (diff > 0) return `+${formatted}`;
  if (diff < 0) return `-${formatted}`;
  return formatted;
}

/**
 * 노출 하나의 비교 카드. 라벨을 사용자가 붙이지 않고 카탈로그에서 파생시킨다 —
 * 노출이 곧 비교 단위가 되면서 이름을 따로 붙일 이유가 없어졌다(D4).
 */
export function ExposureSummaryCard({
  outcome,
  diff,
  baselineLabel,
}: {
  outcome: ExposureOutcome;
  diff: OutcomeDiff | null;
  baselineLabel: string;
}) {
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
      <p className="text-lg font-medium">최종 세후 {formatKrwHuman(result.finalAfterTax)}</p>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        총 세금 {formatKrwHuman(result.totalTax)}
      </p>
      {drawdown !== null && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {drawdown.maxDrawdown === 0
            ? '최대낙폭(MDD) 이 구간에서는 고점 대비 하락이 없었습니다.'
            : `최대낙폭(MDD) -${(drawdown.maxDrawdown * 100).toFixed(1)}% · ${
                drawdown.recoveryMonths === null ? '회복 못함' : `원금 회복 ${drawdown.recoveryMonths}개월`
              }`}
        </p>
      )}
      {diff !== null && (
        <p className="text-sm">
          {baselineLabel} 대비 세금 {formatSigned(diff.totalTaxDiff)} / 최종{' '}
          {formatSigned(diff.finalAfterTaxDiff)} / MDD{' '}
          {formatSignedPercentPoint(diff.maxDrawdownDiff)}
        </p>
      )}
      <WarningsBanner warnings={result.warnings} syntheticRatio={result.syntheticRatio} />
    </div>
  );
}
