import { Suspense } from 'react';
import { InputPanel } from '../../../components/input-panel/InputPanel';
import { CompareResultsView } from '../../../components/results/CompareResultsView';

export default function ComparePage() {
  return (
    <div className="grid flex-1 grid-cols-[360px_1fr]">
      <Suspense fallback={<div className="w-[360px]" />}>
        <InputPanel mode="compare" />
      </Suspense>
      <Suspense fallback={<div className="flex-1 p-4 text-zinc-500">불러오는 중…</div>}>
        <CompareResultsView />
      </Suspense>
    </div>
  );
}
