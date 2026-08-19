import { formatKrwHuman } from '../../lib/format';
import type { SimulationResult } from '../../lib/sim/types';

export function TaxBreakdown({ result }: { result: SimulationResult }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <h3 className="text-sm font-medium">세금 내역</h3>

      {result.harvest.taxFreeGain > 0 && (
        <p className="text-sm">
          연간 250만원 공제 소진으로 {formatKrwHuman(result.harvest.taxFreeGain)}을 비과세 실현해{' '}
          {formatKrwHuman(result.harvest.savedTax)}을 절세했습니다.
        </p>
      )}

      <p className="text-lg font-medium">양도소득세 {formatKrwHuman(result.totalTax)}</p>

      <p className="text-xs text-zinc-500">
        세금 계산은 참고용이며 실제 신고는 세무 전문가와 상의해야 합니다.
      </p>
    </div>
  );
}
