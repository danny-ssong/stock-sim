import type { SimulationWarning } from '../../lib/sim/types';

/** §13.1·§13.2 — 합성 데이터 비중과 엔진 경고를 조용히 삼키지 않고 항상 보여준다. */
export function WarningsBanner({
  warnings,
  syntheticRatio,
}: {
  warnings: SimulationWarning[];
  syntheticRatio: number;
}) {
  if (warnings.length === 0 && syntheticRatio === 0) return null;

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950">
      {syntheticRatio > 0 && (
        <p>
          ⚠ 이 시뮬레이션의 {(syntheticRatio * 100).toFixed(0)}%가 상장 이전 합성
          데이터를 기반으로 합니다.
        </p>
      )}
      {warnings.map((warning, i) => (
        <p key={`${warning.code}-${i}`}>{warning.message}</p>
      ))}
    </div>
  );
}
