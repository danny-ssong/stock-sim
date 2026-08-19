import type { ScenarioConfig } from '../sim/compare';
import { DEFAULT_EXPOSURE, parseExposure } from './schema';

export const MAX_SCENARIOS = 4;
export const MIN_SCENARIOS = 1;

const SCENARIO_SEP = '|';
const FIELD_SEP = ';';

export function defaultLabel(index: number): string {
  return `시나리오 ${String.fromCharCode(65 + index)}`;
}

/** 잘못된 퍼센트 인코딩(예: 손으로 수정하거나 손상된 공유 링크의 `%zz`)이 섞여도
 *  decodeURIComponent가 던지는 URIError를 삼키고 기본 라벨로 폴백한다
 *  (§11 "에러 화면을 띄우지 않는다"). */
function safeDecodeLabel(raw: string | undefined, index: number): string {
  if (!raw) return defaultLabel(index);
  try {
    return decodeURIComponent(raw);
  } catch {
    return defaultLabel(index);
  }
}

export const DEFAULT_SCENARIOS: ScenarioConfig[] = [
  { label: defaultLabel(0), exposure: DEFAULT_EXPOSURE },
];

function parseOneScenario(raw: string, index: number): ScenarioConfig {
  const [labelRaw, expRaw] = raw.split(FIELD_SEP);
  return { label: safeDecodeLabel(labelRaw, index), exposure: parseExposure(expRaw ?? null) };
}

/** URLSearchParams의 `scenarios` 값 → 시나리오 배열. 값이 없거나 전부 깨져
 *  파싱할 게 없으면 기본 시나리오 1개로 폴백한다(§11 "에러 화면을 띄우지 않는다"). */
export function parseScenarios(raw: string | null): ScenarioConfig[] {
  if (raw === null || raw === '') return DEFAULT_SCENARIOS;
  const scenarios = raw.split(SCENARIO_SEP).slice(0, MAX_SCENARIOS).map(parseOneScenario);
  return scenarios.length === 0 ? DEFAULT_SCENARIOS : scenarios;
}

function serializeOneScenario(scenario: ScenarioConfig): string {
  return [encodeURIComponent(scenario.label), scenario.exposure].join(FIELD_SEP);
}

export function serializeScenarios(scenarios: ScenarioConfig[]): string {
  return scenarios.map(serializeOneScenario).join(SCENARIO_SEP);
}
