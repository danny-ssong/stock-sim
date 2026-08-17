import { InputPanel } from '../../../components/input-panel/InputPanel';

export default function PlanPage() {
  return (
    <div className="grid flex-1 grid-cols-[360px_1fr]">
      <InputPanel mode="future" />
      <div className="p-4 text-zinc-500">결과 뷰는 Plan 3b에서 구현합니다.</div>
    </div>
  );
}
