import { formatKrwHuman } from '../../lib/format';
import type { SimulationInput, SimulationResult } from '../../lib/sim/types';

export function ResultSummary({ input, result }: { input: SimulationInput; result: SimulationResult }) {
  const monthlyBaseManwon = Math.round(input.contribution.base / 10_000);
  const growthPercent = (input.contribution.growthRate * 100).toFixed(1);

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-4">
      <p className="text-lg font-medium">
        월 {monthlyBaseManwon.toLocaleString('ko-KR')}만원부터 시작 → 매년 {growthPercent}% 증액 → {input.years}년 뒤 세후{' '}
        {formatKrwHuman(result.finalAfterTax)}
      </p>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        누적 납입 {formatKrwHuman(result.totalContributed)} / 세전 평가 {formatKrwHuman(result.finalBeforeTax)} / 총 세금{' '}
        {formatKrwHuman(result.totalTax)}
      </p>
    </div>
  );
}
