import type { ReactNode } from 'react';
import { formatKrwHuman, formatUsd } from '../../lib/format';
import type { ExposureOutcome } from '../../lib/sim/compare';
import {
  buildDrawdownMilestones,
  type DrawdownMilestone,
} from '../../lib/sim/drawdown-milestones';
import type {
  MetricDirection,
  RecoveryStatus,
  SummaryMetrics,
} from '../../lib/sim/summary-metrics';
import { computePrincipalRecovery } from '../../lib/sim/principal-recovery';

type ReadyOutcome = Extract<ExposureOutcome, { kind: 'ready' }>;

/** 값 자체가 나쁜 소식인 셀에만 붙인다 */
export type CellTone = 'warning';

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
  /**
   * 최우수 강조(pickBestIndices)가 쓰는 비교값. null은 후보에서 빠진다.
   *
   * format이 내는 문자열과 따로 두는 이유는 "하회 없음"처럼 숫자가 아닌 상태도
   * 순서를 가지기 때문이다 — 그 순서를 여기 한 군데에 명시한다.
   */
  sortValue: (metrics: SummaryMetrics) => number | null;
  direction: MetricDirection;
  /** 값이 경고인 상태일 때만 톤을 준다. 없으면 평범한 셀이다 */
  tone?: (metrics: SummaryMetrics) => CellTone | null;
  /** 근거 툴팁. result 전체가 필요한 지표만 갖는다 */
  detail?: (outcome: ReadyOutcome) => ReactNode;
};

const DASH = '—';

/**
 * 회복 지표를 셀 한 칸으로. 세 상태를 각각 다른 말로 낸다 — '—' 하나로 묶으면
 * "떨어진 적이 없다"(가장 좋음)와 "아직 못 돌아왔다"(가장 나쁨)를 화면에서 구분할
 * 방법이 없다. neverFellLabel만 열마다 다른 이유는 전고점(가격)과 원금(납입액)이
 * 서로 다른 것을 하회하지 않은 것이기 때문이다.
 */
function formatRecovery(status: RecoveryStatus | null, neverFellLabel: string): string {
  if (status === null) return DASH;

  switch (status.kind) {
    case 'never-fell':
      return neverFellLabel;
    case 'recovered':
      return `${status.months}개월`;
    case 'unrecovered':
      return '미회복';
  }
}

/**
 * 회복 지표의 비교 순서: 떨어진 적 없음 < 0개월 < N개월, 미회복은 후보에서 뺀다.
 *
 * 미회복을 "무한대"로 두지 않는 이유는 두 상품이 모두 미회복일 때 동점이 되어
 * 둘 다 최우수로 칠해지기 때문이다 — 어느 쪽도 최우수가 아니다.
 */
function recoverySortValue(status: RecoveryStatus | null): number | null {
  if (status === null) return null;

  switch (status.kind) {
    case 'never-fell':
      return -1;
    case 'recovered':
      return status.months;
    case 'unrecovered':
      return null;
  }
}

/** 미회복만 경고다. 좋은 상태까지 칠하면 최우수 강조와 신호가 겹쳐 둘 다 안 읽힌다 */
function recoveryTone(status: RecoveryStatus | null): CellTone | null {
  return status?.kind === 'unrecovered' ? 'warning' : null;
}

function percent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

/** 툴팁 안의 "이름 — 값" 한 줄 */
function DetailRow({ label, children }: { label: string; children: ReactNode }) {
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
      <DetailRow label="고점">{milestoneText(milestones.peak)}</DetailRow>
      <DetailRow label="저점">{milestoneText(milestones.trough)}</DetailRow>
      <DetailRow label="회복">
        {milestones.recovery === null ? '기간 내 회복 못함' : milestoneText(milestones.recovery)}
      </DetailRow>
    </div>
  );
}

/**
 * 원금 회복 셀의 근거.
 *
 * 세 상태가 각각 다른 것을 증명해야 한다 — "하회 없음"은 정말 안 밑돌았다는 여유폭을,
 * "N개월"과 "미회복"은 얼마가 얼마나 오래 물려 있었나를 답해야 한다. 결손액은 화면
 * 어디에도 없는 값이라 이 툴팁이 유일한 출처다.
 */
function principalRecoveryDetail(outcome: ReadyOutcome): ReactNode {
  const recovery = computePrincipalRecovery(outcome.result.ledger.entries);
  if (recovery === null) return null;

  switch (recovery.kind) {
    case 'never-underwater': {
      if (recovery.worstCoverage === null) return null;
      const { ratio, date } = recovery.worstCoverage;
      return (
        <p>
          잔고가 총 원금을 한 번도 밑돌지 않았습니다 — 가장 낮았던 {date}에도 원금의{' '}
          {Math.round(ratio * 100)}%였습니다.
        </p>
      );
    }
    case 'recovered':
      return (
        <div className="flex flex-col gap-0.5">
          <DetailRow label="최대 결손">
            {recovery.worst.date} · {formatKrwHuman(recovery.worst.deficit)}
          </DetailRow>
          <DetailRow label="회복">{recovery.recovery.date}</DetailRow>
        </div>
      );
    case 'unrecovered':
      return (
        <div className="flex flex-col gap-0.5">
          <DetailRow label="최대 결손">
            {recovery.worst.date} · {formatKrwHuman(recovery.worst.deficit)}
          </DetailRow>
          <DetailRow label="기간 종료 시">
            {formatKrwHuman(recovery.remainingDeficit)} 모자람
          </DetailRow>
        </div>
      );
  }
}

/**
 * 히어로가 크게 그리는 지표. 사용자가 이 앱에 온 이유인 숫자다 — 배열에서
 * [0]으로 꺼내지 않고 이름으로 내보내, 순서를 바꿔도 히어로가 깨지지 않게 한다.
 */
export const HEADLINE_COLUMN: SummaryColumn = {
  key: 'afterTax',
  label: '세후 평가액',
  format: (metrics) => formatKrwHuman(metrics.afterTax),
  sortValue: ({ afterTax }) => afterTax,
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
  sortValue: ({ returnRate }) => returnRate,
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
    sortValue: ({ maxDrawdown }) => maxDrawdown,
    direction: 'lower-better',
    detail: drawdownDetail,
  },
  {
    key: 'peakRecovery',
    label: '전고점 회복',
    // 가격이 고점을 만든 적조차 없이 오르기만 했다는 뜻이라 "하락 없음"이다
    format: ({ peakRecovery }) => formatRecovery(peakRecovery, '하락 없음'),
    sortValue: ({ peakRecovery }) => recoverySortValue(peakRecovery),
    direction: 'lower-better',
    // 툴팁을 달지 않는다 — 바로 옆 MDD 툴팁이 고점·저점·회복 날짜를 이미 낸다
    tone: ({ peakRecovery }) => recoveryTone(peakRecovery),
  },
  {
    key: 'principalRecovery',
    label: '원금 회복',
    // 내가 넣은 돈(누적 원금)을 잔고가 밑돈 적이 없다는 뜻이라 "하회 없음"이다
    format: ({ principalRecovery }) => formatRecovery(principalRecovery, '하회 없음'),
    sortValue: ({ principalRecovery }) => recoverySortValue(principalRecovery),
    direction: 'lower-better',
    tone: ({ principalRecovery }) => recoveryTone(principalRecovery),
    detail: principalRecoveryDetail,
  },
];

/** 테이블이 쓰는 전체 열. 헤드라인이 맨 앞이라 표에서도 결론이 먼저 온다 */
export const SUMMARY_COLUMNS: readonly SummaryColumn[] = [
  HEADLINE_COLUMN,
  ...SUPPORTING_COLUMNS,
];
