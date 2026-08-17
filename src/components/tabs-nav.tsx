'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

const TABS = [
  { href: '/plan', label: '탭 1 · 미래 설계' },
  { href: '/backtest', label: '탭 2 · 과거 백테스트' },
  { href: '/compare', label: '탭 3 · 시나리오 비교' },
] as const;

export function TabsNav() {
  const pathname = usePathname();
  // 현재 쿼리스트링(=입력 패널 상태)을 그대로 이어 붙인다 — §8 "탭 전환 시
  // 입력값이 유지된다"는 요구사항은 쿼리스트링이 nuqs 상태의 유일한 저장소인
  // 이 구조에서, 탭 링크가 쿼리를 그대로 물려줘야만 성립한다.
  const queryString = useSearchParams().toString();

  return (
    <nav className="flex gap-4 border-b p-4">
      {TABS.map((tab) => {
        const href = queryString === '' ? tab.href : `${tab.href}?${queryString}`;
        return (
          <Link
            key={tab.href}
            href={href}
            className={pathname === tab.href ? 'font-semibold underline' : 'text-zinc-500'}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
