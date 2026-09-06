import { Suspense } from 'react';
import { InputPanel } from '../components/input-panel/InputPanel';
import { ResultsView } from '../components/results/ResultsView';

/**
 * 화면 하나. 탭 시절의 세 라우트는 입력 패널의 두 축(시점 세그먼트, 상품 다중선택)이
 * 됐다 — 상태를 100% 공유하던 세 목적지가 애초에 목적지가 아니었기 때문이다.
 *
 * Suspense 경계가 두 개인 이유: 두 컴포넌트가 각자 nuqs(useSearchParams)를 읽는
 * 클라이언트 컴포넌트라, 한쪽의 대기가 다른 쪽을 막지 않도록 따로 감싼다.
 *
 * 첫 칸을 360px로 고정하지 않고 auto로 두는 이유: 숏츠 화면에서는 InputPanel이
 * 스스로 null을 반환하는데(입력이 아니라 결과만 보는 화면이다), 폭을 고정해 두면
 * 빈 360px 칸이 그대로 남아 카드가 화면 중앙이 아니라 오른쪽 칸 안에서만 가운데
 * 놓인다. 폭은 InputPanel 자신이 들고 있으므로 칸은 내용에 맞춰 접히면 된다.
 * 이 페이지는 서버 컴포넌트라 URL을 읽을 수 없어, 판단을 CSS에 맡기는 게 유일한 길이다.
 */
export default function Home() {
  return (
    <div className="mx-auto grid w-full max-w-[1440px] flex-1 grid-cols-1 md:grid-cols-[auto_1fr]">
      <Suspense fallback={<div className="w-full md:w-[360px]" />}>
        <InputPanel />
      </Suspense>
      <Suspense fallback={<div className="p-4 text-zinc-500">불러오는 중…</div>}>
        <ResultsView />
      </Suspense>
    </div>
  );
}
