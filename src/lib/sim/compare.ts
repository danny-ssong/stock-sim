import { simulate } from './engine';
import type { SimulationInputBase, SimulationResult, SimulationWarning } from './types';
import type { Dataset } from '../data/dataset';
import type { IndexExposure } from '../data/types';

/**
 * 노출 하나를 돌린 결과.
 *
 * 담을 수 없는 조합(blocked)도 나란히 보여줘야 하므로 블로커를 예외로 던지지 않고
 * 값으로 담는다 — 하나가 막혔다고 전체 화면을 에러로 덮으면 "나란히 비교"가 깨진다.
 */
export type ExposureOutcome =
  | { kind: 'ready'; exposure: IndexExposure; result: SimulationResult }
  | { kind: 'blocked'; exposure: IndexExposure; blockers: SimulationWarning[] };

/**
 * base.mode를 그대로 존중한다 — 과거 검증과 미래 설계 양쪽에서 같은 함수로 여러
 * 노출을 비교하기 위한 조건이다. 탭 시절 여기서 mode를 'future'로 강제해
 * "과거 × 비교" 조합이 구조적으로 막혀 있었다.
 */
export function runExposure(
  base: SimulationInputBase,
  exposure: IndexExposure,
  dataset: Dataset,
): ExposureOutcome {
  const outcome = simulate({ ...base, exposure }, dataset);
  if (!outcome.ok) return { kind: 'blocked', exposure, blockers: outcome.blockers };
  return { kind: 'ready', exposure, result: outcome.result };
}
