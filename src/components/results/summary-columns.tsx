import type { ReactNode } from 'react';
import { formatKrwHuman, formatUsd } from '../../lib/format';
import type { ExposureOutcome } from '../../lib/sim/compare';
import {
  buildDrawdownMilestones,
  type DrawdownMilestone,
} from '../../lib/sim/drawdown-milestones';
import type { MetricDirection, SummaryMetrics } from '../../lib/sim/summary-metrics';

type ReadyOutcome = Extract<ExposureOutcome, { kind: 'ready' }>;

/**
 * 지표 하나를 화면에 내는 방법.
 *
 * 값 계산(summary-metrics.ts)과 나눠 둔 이유는 테이블과 히어로가 같은 지표를 서로
 * 다른 모양으로 그리기 때문이다. 지표를 하나 더 넣을 때 건드릴 곳은 각 층에 한
 * 군데씩(SummaryMetrics 필드 + 여기 항목)이고, 두 화면이 동시에 따라온다.
 */
export type SummaryColumn = {
  key: keyof SummaryMetrics;
  label: string;
  /** null은 '—'로 떨어뜨린다 — 빈 칸을 두면 "0인가?"로 읽힌다 */
  format: (metrics: SummaryMetrics) => string;
  direction: MetricDirection;
  /** 근거 툴팁. result 전체가 필요한 지표만 갖는다 */
  detail?: (outcome: ReadyOutcome) => ReactNode;
};

const DASH = '—';

function percent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

/** MDD 툴팁의 한 줄 */
function MilestoneRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-zinc-400 dark:text-zinc-500">{label}</span>
      <span>{children}</span>
    </div>
  );
}

/** 날짜와, 있으면 그날의 실제 달러 가격. 미래 모드는 실제 종가가 없어 날짜만 남는다. */
function milestoneText(milestone: DrawdownMilestone): string {
  return milestone.priceUsd === null
    ? milestone.date
    : `${milestone.date} · ${formatUsd(milestone.priceUsd)}`;
}

function taxDetail(outcome: ReadyOutcome): ReactNode {
  const { result } = outcome;
  return (
    <div className="flex flex-col gap-1">
      {result.harvest.taxFreeGain > 0 && result.totalTax > 0 && (
        <p>
          연간 250만원 공제 소진으로 {formatKrwHuman(result.harvest.taxFreeGain)}을 비과세
          실현해 {formatKrwHuman(result.harvest.savedTax)}을 절세했습니다.
        </p>
      )}
      <p>양도소득세 {formatKrwHuman(result.totalTax)}</p>
    </div>
  );
}

/**
 * 고점·저점·회복 3줄. 저점을 함께 내는 이유는 -MDD%가 실제로 찍힌 날이 빠져 있으면
 * 표의 숫자를 차트에서 짚어볼 수가 없기 때문이다.
 *
 * 하락이 없었으면(maxDrawdown 0) 짚을 지점 자체가 없으므로 툴팁을 달지 않는다.
 */
function drawdownDetail(outcome: ReadyOutcome): ReactNode {
  const { drawdown, portfolioIndex } = outcome.result;
  if (drawdown === null || drawdown.maxDrawdown === 0) return null;

  const milestones = buildDrawdownMilestones(drawdown, portfolioIndex);
  return (
    <div className="flex flex-col gap-0.5">
      <MilestoneRow label="고점">{milestoneText(milestones.peak)}</MilestoneRow>
      <MilestoneRow label="저점">{milestoneText(milestones.trough)}</MilestoneRow>
      <MilestoneRow label="회복">
        {milestones.recovery === null ? '기간 내 회복 못함' : milestoneText(milestones.recovery)}
      </MilestoneRow>
    </div>
  );
}

/**
 * 히어로가 크게 그리는 지표. 사용자가 이 앱에 온 이유인 숫자다 — 배열에서
 * [0]으로 꺼내지 않고 이름으로 내보내, 순서를 바꿔도 히어로가 깨지지 않게 한다.
 */
export const HEADLINE_COLUMN: SummaryColumn = {
  key: 'afterTax',
  label: '세후 평가액',
  format: (metrics) => formatKrwHuman(metrics.afterTax),
  direction: 'higher-better',
  detail: taxDetail,
};

/**
 * 헤드라인 바로 옆에 붙는 지표. 세후 평가액과 짝이라 둘만 떼어 쓰는 화면이 있어
 * (숏츠 카드 — 폭이 좁아 지표를 둘로 줄인다) 이름으로 내보낸다.
 */
export const RETURN_RATE_COLUMN: SummaryColumn = {
  key: 'returnRate',
  label: '수익률',
  format: ({ returnRate }) =>
    returnRate === null ? DASH : `${returnRate >= 0 ? '+' : '-'}${percent(Math.abs(returnRate))}`,
  direction: 'higher-better',
};

export const SUPPORTING_COLUMNS: readonly SummaryColumn[] = [
  RETURN_RATE_COLUMN,
  {
    key: 'maxDrawdown',
    label: 'MDD',
    // 0은 "하락이 없었다"는 사실이므로 '-0.0%'가 아니라 '0.0%'로 낸다
    format: ({ maxDrawdown }) =>
      maxDrawdown === null ? DASH : maxDrawdown === 0 ? '0.0%' : `-${percent(maxDrawdown)}`,
    direction: 'lower-better',
    detail: drawdownDetail,
  },
  {
    key: 'recoveryMonths',
    label: '전고점 회복',
    format: ({ recoveryMonths }) => (recoveryMonths === null ? DASH : `${recoveryMonths}개월`),
    direction: 'lower-better',
  },
  {
    key: 'principalRecoveryMonths',
    label: '원금 회복',
    format: ({ principalRecoveryMonths }) =>
      principalRecoveryMonths === null ? DASH : `${principalRecoveryMonths}개월`,
    direction: 'lower-better',
  },
];

/** 테이블이 쓰는 전체 열. 헤드라인이 맨 앞이라 표에서도 결론이 먼저 온다 */
export const SUMMARY_COLUMNS: readonly SummaryColumn[] = [
  HEADLINE_COLUMN,
  ...SUPPORTING_COLUMNS,
];
