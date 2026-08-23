'use client';

import { useCallback, useMemo } from 'react';
import { parseAsString, useQueryStates } from 'nuqs';
import { parseSimulationQuery, serializeSimulationQuery, type QueryContext } from '../lib/url/schema';
import type { SimulationInput } from '../lib/sim/types';

const QUERY_KEYS = ['p', 'm', 'mg', 'ma', 'y', 'exp', 'src', 'from', 'to', 'r'] as const;

type QueryKey = (typeof QUERY_KEYS)[number];

const RAW_PARSERS = {
  p: parseAsString,
  m: parseAsString,
  mg: parseAsString,
  ma: parseAsString,
  y: parseAsString,
  exp: parseAsString,
  src: parseAsString,
  from: parseAsString,
  to: parseAsString,
  r: parseAsString,
} satisfies Record<QueryKey, typeof parseAsString>;

function toSearchParams(raw: Partial<Record<QueryKey, string | null>>): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of QUERY_KEYS) {
    const value = raw[key];
    if (value !== null && value !== undefined) params.set(key, value);
  }
  return params;
}

export function useSimulationInputState(context: QueryContext): {
  input: SimulationInput;
  setInput: (input: SimulationInput) => void;
  shareUrl: () => string;
} {
  const [raw, setRaw] = useQueryStates(RAW_PARSERS, {
    history: 'replace',
    shallow: true,
  });

  const input = useMemo(
    () => parseSimulationQuery(toSearchParams(raw), context),
    [raw, context],
  );

  const applyParams = useCallback(
    (params: URLSearchParams) => {
      const next: Partial<Record<QueryKey, string | null>> = {};
      for (const key of QUERY_KEYS) {
        next[key] = params.has(key) ? params.get(key) : null;
      }
      void setRaw(next);
    },
    [setRaw],
  );

  const setInput = useCallback(
    (next: SimulationInput) => {
      applyParams(serializeSimulationQuery(next));
    },
    [applyParams],
  );

  const shareUrl = useCallback(() => {
    const params = serializeSimulationQuery(input);
    if (typeof window === 'undefined') return `?${params.toString()}`;
    return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
  }, [input]);

  return { input, setInput, shareUrl };
}
