'use client';

import type { AccountId } from '../../lib/data/types';
import { isAccountId, redistributeWeights } from '../../lib/allocation';
import { ACCOUNT_LABELS } from '../../lib/account-labels';
import { Slider } from '../ui/slider';
import { Label } from '../ui/label';

export function AllocationSliders({
  weights,
  onChange,
}: {
  /** 사용자가 실제로 보유한 계좌만 담는 부분 맵이다(전체 AccountId를 강제하지 않는다) */
  weights: Partial<Record<AccountId, number>>;
  onChange: (weights: Partial<Record<AccountId, number>>) => void;
}) {
  const accountIds = Object.keys(weights).filter(isAccountId);

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-medium">계좌 배분</legend>
      {accountIds.map((accountId) => {
        const weight = weights[accountId] ?? 0;
        return (
          <div key={accountId} className="flex items-center gap-3">
            <Label htmlFor={`alloc-${accountId}`} className="w-28 shrink-0">
              {ACCOUNT_LABELS[accountId]}
            </Label>
            <Slider
              id={`alloc-${accountId}`}
              aria-label={ACCOUNT_LABELS[accountId]}
              min={0}
              max={100}
              step={1}
              value={[Math.round(weight * 100)]}
              onValueChange={([percent]) => {
                onChange(redistributeWeights(weights, accountId, percent / 100));
              }}
            />
            <span className="w-10 text-right text-sm tabular-nums">
              {Math.round(weight * 100)}
            </span>
          </div>
        );
      })}
    </fieldset>
  );
}
