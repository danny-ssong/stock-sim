import { Suspense } from 'react';
import { InputPanel } from '../../../components/input-panel/InputPanel';
import { ResultsView } from '../../../components/results/ResultsView';

export default function PlanPage() {
  return (
    <div className="grid flex-1 grid-cols-[360px_1fr]">
      <Suspense fallback={<div className="w-[360px]" />}>
        <InputPanel mode="future" />
      </Suspense>
      <Suspense fallback={<div className="p-4 text-zinc-500">불러오는 중…</div>}>
        <ResultsView />
      </Suspense>
    </div>
  );
}
