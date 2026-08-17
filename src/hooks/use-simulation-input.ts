'use client';

import { useCallback, useMemo } from 'react';
import { parseAsString, useQueryStates } from 'nuqs';
import {
  parseSimulationQuery,
  serializeSimulationQuery,
  type QueryContext,
  type ShareableQuery,
} from '../lib/url/schema';
import type { SimulationInput } from '../lib/sim/types';

const QUERY_KEYS = [
  'p', 'm', 'mg', 'ma', 'inc', 'ig', 'ia', 'base', 'y', 'alloc', 'exp',
  'src', 'from', 'to', 'r', 'harvest', 'fx', 'cur', 'target',
] as const;

type QueryKey = (typeof QUERY_KEYS)[number];

const RAW_PARSERS = {
  p: parseAsString,
  m: parseAsString,
  mg: parseAsString,
  ma: parseAsString,
  inc: parseAsString,
  ig: parseAsString,
  ia: parseAsString,
  base: parseAsString,
  y: parseAsString,
  alloc: parseAsString,
  exp: parseAsString,
  src: parseAsString,
  from: parseAsString,
  to: parseAsString,
  r: parseAsString,
  harvest: parseAsString,
  fx: parseAsString,
  cur: parseAsString,
  target: parseAsString,
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
  query: ShareableQuery;
  setInput: (input: SimulationInput) => void;
  setTarget: (target: number | null) => void;
  shareUrl: (options: { includeIncome: boolean }) => string;
} {
  const [raw, setRaw] = useQueryStates(RAW_PARSERS, {
    history: 'replace',
    shallow: true,
  });

  const query = useMemo(
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
    (input: SimulationInput) => {
      applyParams(serializeSimulationQuery({ input, target: query.target }));
    },
    [applyParams, query.target],
  );

  const setTarget = useCallback(
    (target: number | null) => {
      applyParams(serializeSimulationQuery({ input: query.input, target }));
    },
    [applyParams, query.input],
  );

  const shareUrl = useCallback(
    (options: { includeIncome: boolean }) => {
      const params = serializeSimulationQuery(query, options);
      if (typeof window === 'undefined') return `?${params.toString()}`;
      return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    },
    [query],
  );

  return { query, setInput, setTarget, shareUrl };
}
