'use client';

import { useCallback, useMemo } from 'react';
import { parseAsString, useQueryStates } from 'nuqs';
import { parseScenarios, serializeScenarios } from '../lib/url/scenarios';
import type { ScenarioConfig } from '../lib/sim/compare';

/** `useSimulationInputState`와 같은 패턴(단일 쿼리 키를 useQueryStates로 감싼다) —
 *  두 훅이 같은 nuqs 히스토리 모드(replace)를 공유해야 탭 전환 시 쿼리스트링이
 *  일관되게 유지된다. */
export function useScenariosState(): {
  scenarios: ScenarioConfig[];
  setScenarios: (scenarios: ScenarioConfig[]) => void;
} {
  const [raw, setRaw] = useQueryStates(
    { scenarios: parseAsString },
    { history: 'replace', shallow: true },
  );

  const scenarios = useMemo(() => parseScenarios(raw.scenarios), [raw.scenarios]);

  const setScenarios = useCallback(
    (next: ScenarioConfig[]) => {
      void setRaw({ scenarios: serializeScenarios(next) });
    },
    [setRaw],
  );

  return { scenarios, setScenarios };
}
