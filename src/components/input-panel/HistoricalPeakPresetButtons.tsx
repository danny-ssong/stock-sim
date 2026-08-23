'use client';

import { useHistoricalPeakPresets } from '../../hooks/use-historical-peak-presets';
import { PresetButton } from './PresetButton';

/**
 * 미래설계 탭(historicalPath 재생 구간)에서 쓰는 전고점 프리셋 버튼 줄.
 * 클릭하면 시작(from) = 전고점 날짜, 종료(to) = 최신 데이터 날짜로 맞춘다 —
 * "그 전고점 이후 지금까지의 흐름 전체"를 재생 구간으로 쓰겠다는 뜻이다.
 *
 * 기간(years) 슬라이더는 건드리지 않는다 — 재생 구간이 기간보다 짧으면
 * 반복(tiling)해서 채우는 게 이 수익률 소스의 핵심 동작이라, 강제로 맞추면
 * 그 기능 자체가 무의미해진다.
 */
export function HistoricalPeakPresetButtons({
  from,
  onSelectRange,
}: {
  from: string;
  onSelectRange: (from: string, to: string) => void;
}) {
  const peakPresets = useHistoricalPeakPresets();
  if (peakPresets.status !== 'ready') return null;

  const currentMonth = from.slice(0, 7);
  const { presets, recentCorrection, lastAvailableDate } = peakPresets;

  return (
    <div className="flex flex-wrap gap-2">
      {presets.map((preset) => (
        <PresetButton
          key={preset.label}
          label={preset.label}
          resolvedDate={preset.date}
          currentMonth={currentMonth}
          disabled={preset.years < 1}
          onSelect={(date) => onSelectRange(date, lastAvailableDate)}
        />
      ))}
      {recentCorrection !== null && (
        <PresetButton
          label={recentCorrection.label}
          resolvedDate={recentCorrection.date}
          currentMonth={currentMonth}
          onSelect={(date) => onSelectRange(date, lastAvailableDate)}
        />
      )}
    </div>
  );
}
