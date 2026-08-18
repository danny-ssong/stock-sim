import { formatKrwHuman } from '../../lib/format';
import type { ScenarioOutcome } from '../../lib/sim/compare';
import { scenarioFinalAfterTax, scenarioTotalTax } from '../../lib/sim/compare';
import type { ScenarioDiff } from '../../lib/sim/scenario-diff';
import { WarningsBanner } from './WarningsBanner';

function formatSigned(amountKrw: number): string {
  const formatted = formatKrwHuman(Math.abs(amountKrw));
  if (amountKrw > 0) return `+${formatted}`;
  if (amountKrw < 0) return `-${formatted}`;
  return formatted;
}

export function ScenarioSummaryCard({
  outcome,
  diff,
}: {
  outcome: ScenarioOutcome;
  diff: ScenarioDiff | null;
}) {
  const label = outcome.config.label;

  if (outcome.kind === 'blocked') {
    return (
      <div className="flex flex-col gap-2 rounded-lg border p-4">
        <h3 className="text-sm font-medium">{label}</h3>
        <ul className="text-sm text-red-600">
          {outcome.blockers.length === 0 ? (
            <li>이 조합으로는 시뮬레이션을 계산할 수 없습니다.</li>
          ) : (
            outcome.blockers.map((blocker, i) => <li key={`${blocker.code}-${i}`}>{blocker.message}</li>)
          )}
        </ul>
      </div>
    );
  }

  const finalAfterTax = scenarioFinalAfterTax(outcome);
  const totalTax = scenarioTotalTax(outcome);
  const rawWarnings =
    outcome.kind === 'allocation'
      ? outcome.result.warnings
      : [
          ...outcome.comparison.warnings,
          ...outcome.comparison.withTransfer[0].warnings,
          ...outcome.comparison.withTransfer[1].warnings,
        ];
  // transfer 시나리오는 comparison.warnings + 이전 전/후 두 leg의 warnings를 병합하므로
  // 같은 code의 경고가 양쪽 leg에서 중복 발생할 수 있다(예: 동일 상품군 DIVIDEND_NOT_MODELED).
  // code 기준으로 중복 제거해 WarningsBanner에 같은 메시지가 두 번 뜨는 것을 막는다.
  const warnings = [...new Map(rawWarnings.map((w) => [w.code, w])).values()];
  const syntheticRatio = outcome.kind === 'allocation' ? outcome.result.syntheticRatio : 0;

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-4">
      <h3 className="text-sm font-medium">{label}</h3>
      {finalAfterTax !== null && (
        <p className="text-lg font-medium">최종 세후 {formatKrwHuman(finalAfterTax)}</p>
      )}
      {totalTax !== null && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          총 세금 {formatKrwHuman(totalTax)}
        </p>
      )}
      {diff !== null && (
        <p className="text-sm">
          추천안 대비 세금 {formatSigned(diff.totalTaxDiff)} / 최종{' '}
          {formatSigned(diff.finalAfterTaxDiff)}
        </p>
      )}
      <WarningsBanner warnings={warnings} syntheticRatio={syntheticRatio} />
    </div>
  );
}
