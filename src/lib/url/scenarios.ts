import type { ScenarioConfig } from '../sim/compare';
import type { Allocation } from '../sim/types';
import { DEFAULT_EXPOSURE, parseAllocEntries, parseExposure, serializeAllocEntries } from './schema';

export const MAX_SCENARIOS = 4;
export const MIN_SCENARIOS = 1;

const SCENARIO_SEP = '|';
const FIELD_SEP = ';';

function defaultLabel(index: number): string {
  return `시나리오 ${String.fromCharCode(65 + index)}`;
}

export const DEFAULT_SCENARIOS: ScenarioConfig[] = [
  {
    kind: 'allocation',
    label: defaultLabel(0),
    allocations: [{ accountId: 'ISA', exposure: DEFAULT_EXPOSURE, weight: 1 }],
  },
];

function parseOneScenario(raw: string, index: number): ScenarioConfig {
  const [labelRaw, kindRaw, expRaw, allocRaw, yearRaw] = raw.split(FIELD_SEP);
  const label = labelRaw ? decodeURIComponent(labelRaw) : defaultLabel(index);
  const exposure = parseExposure(expRaw ?? null);

  if (kindRaw === 't') {
    const year = Number(yearRaw);
    return {
      kind: 'transfer',
      label,
      exposure,
      transferYear: Number.isInteger(year) && year > 0 ? year : 1,
    };
  }

  const allocations: Allocation[] = parseAllocEntries(allocRaw ?? null).map((entry) => ({
    ...entry,
    exposure,
  }));
  return { kind: 'allocation', label, allocations };
}

/** URLSearchParams의 `scenarios` 값 → 시나리오 배열. 값이 없거나 전부 깨져
 *  파싱할 게 없으면 기본 시나리오 1개로 폴백한다(§11 "에러 화면을 띄우지 않는다"). */
export function parseScenarios(raw: string | null): ScenarioConfig[] {
  if (raw === null || raw === '') return DEFAULT_SCENARIOS;

  const scenarios = raw
    .split(SCENARIO_SEP)
    .slice(0, MAX_SCENARIOS)
    .map((part, index) => parseOneScenario(part, index));

  return scenarios.length === 0 ? DEFAULT_SCENARIOS : scenarios;
}

function serializeOneScenario(scenario: ScenarioConfig): string {
  const label = encodeURIComponent(scenario.label);
  if (scenario.kind === 'transfer') {
    return [label, 't', scenario.exposure, '', String(scenario.transferYear)].join(FIELD_SEP);
  }
  const exposure = scenario.allocations[0]?.exposure ?? DEFAULT_EXPOSURE;
  return [label, 'a', exposure, serializeAllocEntries(scenario.allocations), ''].join(FIELD_SEP);
}

export function serializeScenarios(scenarios: ScenarioConfig[]): string {
  return scenarios.map(serializeOneScenario).join(SCENARIO_SEP);
}
