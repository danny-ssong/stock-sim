'use client';

import type { AccountId, IndexExposure } from '../../lib/data/types';
import { resolveProduct } from '../../lib/data/catalog';
import { V1_AVAILABLE_EXPOSURES } from '../../lib/url/schema';

export function ExposureSelector({
  value,
  onChange,
  accountIds,
}: {
  value: IndexExposure;
  onChange: (exposure: IndexExposure) => void;
  accountIds: AccountId[];
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
                name="exposure"
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
