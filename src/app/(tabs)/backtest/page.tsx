import { InputPanel } from '../../../components/input-panel/InputPanel';

export default function BacktestPage() {
  return (
    <div className="grid flex-1 grid-cols-[360px_1fr]">
      <InputPanel mode="backtest" />
      <div className="p-4 text-zinc-500">결과 뷰는 Plan 3c에서 구현합니다.</div>
    </div>
  );
}
