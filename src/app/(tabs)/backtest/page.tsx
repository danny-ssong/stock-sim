import { Suspense } from 'react';
import { InputPanel } from '../../../components/input-panel/InputPanel';

export default function BacktestPage() {
  return (
    <div className="grid flex-1 grid-cols-[360px_1fr]">
      <Suspense fallback={<div className="w-[360px]" />}>
        <InputPanel mode="backtest" />
      </Suspense>
      <div className="p-4 text-zinc-500">결과 뷰는 Plan 3c에서 구현합니다.</div>
    </div>
  );
}
