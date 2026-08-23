import { Suspense } from 'react';
import { InputPanel } from '../components/input-panel/InputPanel';
import { ResultsView } from '../components/results/ResultsView';

/**
 * 화면 하나. 탭 시절의 세 라우트는 입력 패널의 두 축(시점 세그먼트, 상품 다중선택)이
 * 됐다 — 상태를 100% 공유하던 세 목적지가 애초에 목적지가 아니었기 때문이다.
 *
 * Suspense 경계가 두 개인 이유: 두 컴포넌트가 각자 nuqs(useSearchParams)를 읽는
 * 클라이언트 컴포넌트라, 한쪽의 대기가 다른 쪽을 막지 않도록 따로 감싼다.
 */
export default function Home() {
  return (
    <div className="grid flex-1 grid-cols-[360px_1fr]">
      <Suspense fallback={<div className="w-[360px]" />}>
        <InputPanel />
      </Suspense>
      <Suspense fallback={<div className="p-4 text-zinc-500">불러오는 중…</div>}>
        <ResultsView />
      </Suspense>
    </div>
  );
}
