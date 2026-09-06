'use client';

import { exposureColor } from '../../lib/chart/colors';
import type { IndexExposure } from '../../lib/data/types';
import { exposureLabelWithTicker } from '../../lib/data/labels';
import { formatKrwHuman } from '../../lib/format';
import { buildSummaryMetrics } from '../../lib/sim/summary-metrics';
import type { SimulationResult } from '../../lib/sim/types';
import { InfoTooltip } from '../ui/tooltip';
import { HEADLINE_COLUMN, SUPPORTING_COLUMNS } from './summary-columns';
import { WarningsBanner } from './WarningsBanner';

/**
 * 상품 하나의 요약.
 *
 * 테이블과 레이아웃이 다른 이유는 질문이 다르기 때문이다 — N=1의 질문은 "얼마가
 * 되나"라서 답이 하나고, N>=2의 질문은 "어느 게 나은가"라서 정렬된 비교가 필요하다.
 * 두 화면이 공유해야 하는 것은 레이아웃이 아니라 **어휘**(지표명·포맷·툴팁·순서)이고,
 * 그건 summary-columns.tsx가 담당한다.
 *
 * 총 원금을 테이블처럼 캡션으로 빼지 않고 큰 숫자 옆에 두는 이유: 비교할 상대가 없어
 * 중복이 생기지 않고, 평가액 바로 옆에 있어야 "얼마 넣어서 얼마가 됐다"가 한눈에 읽힌다.
 * 이름은 비교 테이블 캡션과 같은 "총 원금"이다 — 입력 패널의 "초기 원금"과 구분되는
 * 값이라, 화면이 달라져도 수식어를 떼지 않는다(format.ts).
 */
export function ExposureSummaryHero({
  exposure,
  result,
}: {
  exposure: IndexExposure;
  result: SimulationResult;
}) {
  const metrics = buildSummaryMetrics(result);
  const outcome = { kind: 'ready', exposure, result } as const;
  const label = exposureLabelWithTicker(exposure);
  const headlineDetail = HEADLINE_COLUMN.detail?.(outcome) ?? null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: exposureColor(exposure) }}
        />
        {label}
      </h3>

      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-3xl font-semibold tabular-nums">
          {HEADLINE_COLUMN.format(metrics)}
        </span>
        <span className="text-xs font-normal text-zinc-500">
          (총 원금: {formatKrwHuman(result.totalContributed)})
        </span>
        {headlineDetail !== null && (
          <InfoTooltip label={`${HEADLINE_COLUMN.label} 상세`}>{headlineDetail}</InfoTooltip>
        )}
      </p>

      {/* 좁은 화면에서 4개가 한 줄에 들어가지 않는다. 테이블처럼 가로 스크롤을 쓰지
          않고 접는다 — 히어로는 열 정렬을 지킬 이유가 없다 */}
      <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {SUPPORTING_COLUMNS.map((column) => {
          const detail = column.detail?.(outcome) ?? null;
          return (
            <div key={column.key} className="flex items-center gap-1.5">
              <dt className="text-zinc-500">{column.label}</dt>
              <dd className="flex items-center gap-1 tabular-nums text-zinc-700 dark:text-zinc-300">
                {column.format(metrics)}
                {detail !== null && (
                  <InfoTooltip label={`${column.label} 상세`}>{detail}</InfoTooltip>
                )}
              </dd>
            </div>
          );
        })}
      </dl>

      <WarningsBanner warnings={result.warnings} />
    </div>
  );
}
