'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { isAccountId } from '../../lib/allocation';
import { ACCOUNT_LABELS } from '../../lib/account-labels';
import { buildContributionSeries } from '../../lib/sim/contribution-series';
import type { AccountId } from '../../lib/data/types';
import type { Ledger } from '../../lib/sim/types';

/** Recharts는 번들이 커서 결과 화면을 처음 그릴 때는 필요 없다 — 클라이언트에서만
 * 지연 로딩한다(스펙 §10 "렌더링 비용"). */
const StackedAreaChart = dynamic(() => import('./StackedAreaChart'), {
  ssr: false,
  loading: () => (
    <div className="h-[280px] w-full animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
  ),
});

export function ContributionChart({ ledger, years }: { ledger: Ledger; years: number }) {
  const series = useMemo(() => buildContributionSeries(ledger, years), [ledger, years]);

  const accountIds = useMemo(() => {
    const ids = new Set<AccountId>();
    for (const row of series) {
      for (const key of Object.keys(row.values)) {
        if (isAccountId(key)) ids.add(key);
      }
    }
    return [...ids];
  }, [series]);

  const data = useMemo(
    () => series.map((row) => ({ yearIndex: row.yearIndex + 1, ...row.values })),
    [series],
  );

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">계좌별 기여도</h3>
      <StackedAreaChart data={data} accountIds={accountIds} labels={ACCOUNT_LABELS} />
    </div>
  );
}
