import type { Dataset } from '../data/dataset';
import { simulate } from './engine';
import { resolveAtYear, scaleSchedule } from './schedule';
import type { AnchoredSchedule, SimulationInput } from './types';

const MAX_ITERATIONS = 60;
const MAX_FACTOR = 1000;
const TOLERANCE = 1;

export type GoalSeekPreviewRow = {
  yearIndex: number;
  before: number;
  after: number;
  isAnchor: boolean;
};

export type GoalSeekResult =
  | {
      reachable: true;
      factor: number;
      schedule: AnchoredSchedule;
      finalAfterTax: number;
      preview: GoalSeekPreviewRow[];
    }
  | { reachable: false; maxFactor: number; maxAchievable: number };

/**
 * 목표금액(세후 명목)에 닿는 납입 수준을 이분탐색으로 찾는다.
 *
 * base만 움직이면 anchor가 걸린 연도 이후가 고정되어 단조성이 깨지므로,
 * 스케줄 전체를 비례 스케일링한다(§5.7). 사용자가 설계한 패턴의 형태
 * (상승률·점프 시점·상대적 크기)는 보존되고 수준만 바뀐다.
 *
 * ISA 납입한도와 250만원 공제 때문에 국소적으로 계단이 생기지만
 * 실질적 단조성은 유지되어 수렴한다.
 */
export function seekContribution(params: {
  input: SimulationInput;
  dataset: Dataset;
  target: number;
}): GoalSeekResult {
  const { input, dataset, target } = params;

  const evaluate = (factor: number): number | null => {
    const outcome = simulate(
      { ...input, contribution: scaleSchedule(input.contribution, factor) },
      dataset,
    );
    return outcome.ok ? outcome.result.finalAfterTax : null;
  };

  let lo = 0;
  let hi = 2;
  let hiValue = evaluate(hi);

  // 배분 자체가 불가능하면 어떤 배수로도 계산되지 않는다
  if (hiValue === null) {
    return { reachable: false, maxFactor: 0, maxAchievable: 0 };
  }

  while (hiValue !== null && hiValue < target && hi < MAX_FACTOR) {
    hi *= 2;
    hiValue = evaluate(hi);
  }

  if (hiValue === null || hiValue < target) {
    return {
      reachable: false,
      maxFactor: hi,
      maxAchievable: hiValue ?? 0,
    };
  }

  let finalValue = hiValue;
  for (let i = 0; i < MAX_ITERATIONS; i += 1) {
    const mid = (lo + hi) / 2;
    const value = evaluate(mid);
    if (value === null) break;

    finalValue = value;
    if (Math.abs(value - target) < TOLERANCE) {
      lo = mid;
      hi = mid;
      break;
    }
    if (value < target) lo = mid;
    else hi = mid;
  }

  const factor = (lo + hi) / 2;
  const schedule = scaleSchedule(input.contribution, factor);
  const settled = evaluate(factor);

  const anchorYears = new Set(Object.keys(input.contribution.anchors).map(Number));
  const preview: GoalSeekPreviewRow[] = [];
  for (let yearIndex = 0; yearIndex < input.years; yearIndex += 1) {
    preview.push({
      yearIndex,
      before: resolveAtYear(input.contribution, yearIndex),
      after: resolveAtYear(schedule, yearIndex),
      isAnchor: anchorYears.has(yearIndex),
    });
  }

  return {
    reachable: true,
    factor,
    schedule,
    finalAfterTax: settled ?? finalValue,
    preview,
  };
}
