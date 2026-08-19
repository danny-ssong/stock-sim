'use client';

import type { AccountId, IndexExposure } from '../../lib/data/types';
import { resolveProduct } from '../../lib/data/catalog';
import { V1_AVAILABLE_EXPOSURES } from '../../lib/url/schema';

export function ExposureSelector({
  value,
  onChange,
  accountIds,
  name = 'exposure',
}: {
  value: IndexExposure;
  onChange: (exposure: IndexExposure) => void;
  accountIds: AccountId[];
  /** 같은 화면에 여러 인스턴스가 렌더링될 때(예: 시나리오별 비교) 네이티브 라디오
   *  그룹이 인스턴스 간에 겹치지 않도록 호출자가 고유한 name을 넘겨야 한다. */
  name?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium">지수 노출</legend>
      {V1_AVAILABLE_EXPOSURES.map((exposure) => {
        const blocked = accountIds
          .map((accountId) => ({ accountId, resolution: resolveProduct(accountId, exposure) }))
          .filter((entry) => !entry.resolution.available);

        return (
          <label key={exposure} className="flex flex-col gap-1 text-sm">
            <span className="flex items-center gap-2">
              <input
                type="radio"
                name={name}
                value={exposure}
                checked={value === exposure}
                onChange={() => onChange(exposure)}
              />
              {exposure}
            </span>
            {blocked.map((entry) => {
              if (entry.resolution.available) return null;
              return (
                <span key={entry.accountId} className="pl-6 text-xs text-red-600">
                  {entry.accountId}: {entry.resolution.message}
                </span>
              );
            })}
          </label>
        );
      })}
    </fieldset>
  );
}
