'use client';

import { useState } from 'react';
import { buildScheduleRows, clearAnchor, setAnchor } from '../../lib/sim/schedule-rows';
import type { AnchoredSchedule } from '../../lib/sim/types';
import { Button } from '../ui/button';

export function YearlyScheduleTable({
  title,
  schedule,
  years,
  onChange,
  formatValue,
  displayDivisor = 1,
}: {
  title: string;
  schedule: AnchoredSchedule;
  years: number;
  onChange: (schedule: AnchoredSchedule) => void;
  formatValue: (value: number) => string;
  displayDivisor?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const rows = buildScheduleRows(schedule, years);

  if (!expanded) {
    return (
      <Button
        type="button"
        variant="ghost"
        className="justify-start px-0 text-sm text-zinc-500"
        onClick={() => setExpanded(true)}
      >
        ▸ 연도별 상세 편집
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="ghost"
        className="justify-start px-0 text-sm font-medium"
        onClick={() => setExpanded(false)}
      >
        ▾ {title} — 연도별 상세 편집
      </Button>
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-left">연차</th>
            <th className="text-right">{title}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={`${row.yearIndex}-${row.value}`}
              className={row.isAnchor ? 'bg-amber-50 dark:bg-amber-950' : undefined}
            >
              <td>
                {row.yearIndex + 1}
                {row.isAnchor ? ' 📌' : ''}
              </td>
              <td className="text-right">
                <input
                  type="number"
                  defaultValue={Math.round(row.value / displayDivisor)}
                  aria-label={`${row.yearIndex + 1}연차 ${title}`}
                  className="w-16 border-b bg-transparent text-right"
                  onBlur={(event) => {
                    const parsed = Number(event.currentTarget.value);
                    if (!Number.isFinite(parsed)) return;
                    const nextValue = parsed * displayDivisor;
                    if (nextValue === row.value) return;
                    onChange(setAnchor(schedule, row.yearIndex, nextValue));
                  }}
                />
                <span className="sr-only">{formatValue(row.value)}</span>
              </td>
              <td>
                {row.isAnchor && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onChange(clearAnchor(schedule, row.yearIndex))}
                  >
                    초기화
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
