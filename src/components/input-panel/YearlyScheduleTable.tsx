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
}: {
  title: string;
  schedule: AnchoredSchedule;
  years: number;
  onChange: (schedule: AnchoredSchedule) => void;
  formatValue: (value: number) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const rows = buildScheduleRows(schedule, years);

  if (!expanded) {
    return (
      <Button type="button" variant="ghost" onClick={() => setExpanded(true)}>
        {title} 연도별 상세 편집 펼치기
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{title} — 연도별 상세 편집</h3>
        <Button type="button" variant="ghost" onClick={() => setExpanded(false)}>
          접기
        </Button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-left">연차</th>
            <th className="text-right">값</th>
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
                  defaultValue={row.value}
                  aria-label={`${row.yearIndex + 1}연차 ${title}`}
                  className="w-32 border-b bg-transparent text-right"
                  onBlur={(event) => {
                    const parsed = Number(event.currentTarget.value);
                    if (!Number.isFinite(parsed) || parsed === row.value) return;
                    onChange(setAnchor(schedule, row.yearIndex, parsed));
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
