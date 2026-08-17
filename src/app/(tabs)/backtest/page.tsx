import { Suspense } from 'react';
import { InputPanel } from '../../../components/input-panel/InputPanel';
import { BacktestResultsView } from '../../../components/results/BacktestResultsView';

export default function BacktestPage() {
  return (
    <div className="grid flex-1 grid-cols-[360px_1fr]">
      <Suspense fallback={<div className="w-[360px]" />}>
        <InputPanel mode="backtest" />
      </Suspense>
      <Suspense fallback={<div className="p-4 text-zinc-500">불러오는 중…</div>}>
        <BacktestResultsView />
      </Suspense>
    </div>
  );
}
