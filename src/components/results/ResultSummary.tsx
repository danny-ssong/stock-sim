import { formatKrwHuman } from '../../lib/format';
import type { SimulationInput, SimulationResult } from '../../lib/sim/types';

/**
 * 결과 헤드라인. "무엇을 넣어 얼마가 됐나"를 한 줄로 말하고, 그 구성과
 * 세금을 작은 두 줄로 받친다.
 *
 * 1행의 기준은 초기 원금이 아니라 누적 납입(totalContributed)이다 — 초기
 * 원금만 쓰면 월 납입 전액이 빠져 문장이 성립하지 않는다.
 */
export function ResultSummary({
  input,
  result,
  showTaxDetail = true,
}: {
  input: SimulationInput;
  result: SimulationResult;
  /** 백테스트 결과는 별도 TaxBreakdown 카드가 이미 세금·절세 문구를 보여주므로 중복을 막기 위해 false로 넘긴다 */
  showTaxDetail?: boolean;
}) {
  const monthlyBaseManwon = Math.round(input.contribution.base / 10_000);
  const growthPercent = input.contribution.growthRate * 100;

  // 실현 세액이 0이면 절세 문구를 렌더링하지 않는다 — 커밋 52541d5가 고친
  // 회귀다. TaxBreakdown이 사라져도 이 조건은 반드시 승계돼야 한다.
  const showsSavedTax = result.harvest.taxFreeGain > 0 && result.totalTax > 0;

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-4">
      <p className="text-lg font-medium">
        총 투입 {formatKrwHuman(result.totalContributed)} → {input.years}년 뒤 세후{' '}
        {formatKrwHuman(result.finalAfterTax)}
      </p>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        원금 {formatKrwHuman(input.initialAmount)} + 월{' '}
        {monthlyBaseManwon.toLocaleString('ko-KR')}만원
        {growthPercent > 0 && `(1년차, 매년 ${growthPercent.toFixed(1)}% 증액)`}
      </p>
      {showTaxDetail && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          세전 {formatKrwHuman(result.finalBeforeTax)} · 세금 {formatKrwHuman(result.totalTax)}
          {showsSavedTax && ` (연 250만원 공제로 ${formatKrwHuman(result.harvest.savedTax)} 절세)`}
        </p>
      )}
    </div>
  );
}
