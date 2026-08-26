import type { SimulationWarning } from '../../lib/sim/types';

/** §13.2 — 엔진 경고를 조용히 삼키지 않고 항상 보여준다. */
export function WarningsBanner({ warnings }: { warnings: SimulationWarning[] }) {
  if (warnings.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950">
      {warnings.map((warning, i) => (
        <p key={`${warning.code}-${i}`}>{warning.message}</p>
      ))}
    </div>
  );
}
