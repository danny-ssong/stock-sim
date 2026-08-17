'use client';

import type { ReturnSource } from '../../lib/sim/types';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

export function ReturnSourceToggle({
  value,
  onChange,
}: {
  value: ReturnSource;
  onChange: (source: ReturnSource) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium">수익률 소스</legend>
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-1">
          <input
            type="radio"
            name="return-source"
            checked={value.type === 'historicalPath'}
            onChange={() =>
              onChange({
                type: 'historicalPath',
                from: value.type === 'historicalPath' ? value.from : '2011-08-01',
                to: value.type === 'historicalPath' ? value.to : '2026-08-01',
                tileMode: 'repeat',
              })
            }
          />
          과거 경로
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            name="return-source"
            checked={value.type === 'constantCagr'}
            onChange={() => onChange({ type: 'constantCagr', annualRate: 0.08 })}
          />
          CAGR 직선
        </label>
      </div>

      {value.type === 'historicalPath' ? (
        <div className="flex gap-2">
          <Label className="flex flex-col text-xs">
            시작
            <Input
              type="date"
              value={value.from}
              onChange={(e) => onChange({ ...value, from: e.target.value })}
            />
          </Label>
          <Label className="flex flex-col text-xs">
            종료
            <Input
              type="date"
              value={value.to}
              onChange={(e) => onChange({ ...value, to: e.target.value })}
            />
          </Label>
        </div>
      ) : (
        <Label className="flex flex-col text-xs">
          연 수익률(%)
          <Input
            type="number"
            value={value.annualRate * 100}
            onChange={(e) =>
              onChange({ type: 'constantCagr', annualRate: Number(e.target.value) / 100 })
            }
          />
        </Label>
      )}
    </fieldset>
  );
}
