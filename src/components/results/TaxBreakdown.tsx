import { formatKrwHuman } from '../../lib/format';
import type { SimulationResult } from '../../lib/sim/types';

export function TaxBreakdown({ result }: { result: SimulationResult }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <h3 className="text-sm font-medium">세금 내역</h3>

      {result.harvest.taxFreeGain > 0 && (
        <p className="text-sm">
          연간 250만원 공제 소진으로 {formatKrwHuman(result.harvest.taxFreeGain)}을 비과세
          실현해 {formatKrwHuman(result.harvest.savedTax)}을 절세했습니다.
        </p>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-left">연차</th>
            <th className="text-right">금융소득</th>
            <th className="text-right">그 해 세금</th>
          </tr>
        </thead>
        <tbody>
          {result.yearlyTax.map((year) => (
            <tr key={year.yearIndex}>
              <td>{year.yearIndex + 1}</td>
              <td className="text-right">{formatKrwHuman(year.financialIncome)}</td>
              <td className="text-right">{formatKrwHuman(year.totalTax)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-medium">
            <td>합계</td>
            <td />
            <td className="text-right">{formatKrwHuman(result.totalTax)}</td>
          </tr>
        </tfoot>
      </table>

      <p className="text-xs text-zinc-500">
        세금 계산은 참고용이며 실제 신고는 세무 전문가와 상의해야 합니다. 과세표준은
        부양가족·연금·보험료 공제를 반영하지 않아 실제보다 높게(보수적으로)
        추정됩니다.
      </p>
    </div>
  );
}
