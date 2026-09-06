'use client';

import { exposureColor } from '../../lib/chart/colors';
import { exposureLabelWithTicker } from '../../lib/data/labels';
import { formatContributionPlan } from '../../lib/format';
import type { ExposureOutcome } from '../../lib/sim/compare';
import { buildSummaryMetrics, pickBestIndices } from '../../lib/sim/summary-metrics';
import type { SimulationInputBase } from '../../lib/sim/types';
import { InfoTooltip } from '../ui/tooltip';
import { SUMMARY_COLUMNS } from './summary-columns';

const CELL = 'px-3 py-2 whitespace-nowrap';
const NUMERIC_CELL = `${CELL} text-right tabular-nums`;
/**
 * 상품 열은 가로 스크롤에서 고정한다 — 좁은 화면(md 미만에서 결과 영역이 화면 전체
 * 폭이 된다)에서 지표를 훑는 동안 어느 상품 행인지 잃지 않게 한다. 배경색을 명시하는
 * 이유는 sticky 셀 아래로 다른 셀이 비쳐 지나가지 않게 하기 위해서다.
 */
const NAME_CELL = `${CELL} sticky left-0 z-10 bg-white text-left dark:bg-zinc-950`;

const BEST_CELL = 'font-semibold text-zinc-900 dark:text-zinc-100';
const PLAIN_CELL = 'text-zinc-600 dark:text-zinc-400';

/**
 * 상품 2개 이상의 요약. 행이 상품, 열이 지표다.
 *
 * 카드 그리드였을 때는 "어느 상품의 MDD가 제일 작은가"를 보려면 카드마다 세 번째
 * 줄만 골라 읽어야 했고, 카드 높이가 내용에 따라 달라 같은 지표가 같은 높이에 오지도
 * 않았다. 표는 그 문제를 정의상 없앤다.
 *
 * 색 스와치는 exposureColor로 받는다 — 차트·재생과 같은 함수라 blocked가 섞여도
 * 어긋날 수 없다(chart/colors.ts).
 */
export function ExposureSummaryTable({
  outcomes,
  base,
}: {
  outcomes: readonly ExposureOutcome[];
  /** 캡션에 쓸 납입 계획. 상품과 무관하게 같아서 표 안이 아니라 위에 한 번만 낸다 */
  base: SimulationInputBase;
}) {
  const metricsByRow = outcomes.map((outcome) =>
    outcome.kind === 'ready' ? buildSummaryMetrics(outcome.result) : null,
  );
  const bestByColumn = SUMMARY_COLUMNS.map((column) =>
    pickBestIndices(
      metricsByRow.map((metrics) => (metrics === null ? null : metrics[column.key])),
      column.direction,
    ),
  );

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-zinc-500">{formatContributionPlan(base)} · 모든 상품 공통</p>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs font-medium text-zinc-500 dark:border-zinc-800">
              <th scope="col" className={NAME_CELL}>
                상품
              </th>
              {SUMMARY_COLUMNS.map((column) => (
                <th key={column.key} scope="col" className={NUMERIC_CELL}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {outcomes.map((outcome, rowIndex) => {
              const label = exposureLabelWithTicker(outcome.exposure);
              const metrics = metricsByRow[rowIndex];

              if (outcome.kind === 'blocked' || metrics === null) {
                return (
                  <tr
                    key={outcome.exposure}
                    className="border-b border-zinc-200 dark:border-zinc-800"
                  >
                    {/* 차트에 대응하는 선이 없으므로 색 스와치도 없다 */}
                    <th scope="row" className={`${NAME_CELL} font-normal`}>
                      {label}
                    </th>
                    <td className={`${CELL} text-red-600`} colSpan={SUMMARY_COLUMNS.length}>
                      {outcome.kind === 'blocked' && outcome.blockers.length > 0
                        ? outcome.blockers.map((blocker) => blocker.message).join(' · ')
                        : '이 조합으로는 시뮬레이션을 계산할 수 없습니다.'}
                    </td>
                  </tr>
                );
              }

              return (
                <tr
                  key={outcome.exposure}
                  className="border-b border-zinc-200 dark:border-zinc-800"
                >
                  <th scope="row" className={`${NAME_CELL} font-normal`}>
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: exposureColor(outcome.exposure) }}
                      />
                      {label}
                      {/* 배너를 행 안에 넣으면 열 정렬이 깨진다 — 아이콘으로 축소한다 */}
                      {outcome.result.warnings.length > 0 && (
                        <InfoTooltip label={`${label} 경고`}>
                          <div className="flex flex-col gap-1">
                            {outcome.result.warnings.map((warning, i) => (
                              <p key={`${warning.code}-${i}`}>{warning.message}</p>
                            ))}
                          </div>
                        </InfoTooltip>
                      )}
                    </span>
                  </th>

                  {SUMMARY_COLUMNS.map((column, columnIndex) => {
                    const detail = column.detail?.(outcome) ?? null;
                    const isBest = bestByColumn[columnIndex].has(rowIndex);
                    return (
                      <td
                        key={column.key}
                        className={`${NUMERIC_CELL} ${isBest ? BEST_CELL : PLAIN_CELL}`}
                      >
                        <span className="inline-flex items-center gap-1">
                          {column.format(metrics)}
                          {detail !== null && (
                            <InfoTooltip label={`${label} ${column.label} 상세`}>
                              {detail}
                            </InfoTooltip>
                          )}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
