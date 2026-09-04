'use client';

import { useCallback, useMemo } from 'react';
import { parseAsString, useQueryStates } from 'nuqs';
import {
  LEGACY_QUERY_KEYS,
  parseSimulationQuery,
  serializeSimulationQuery,
  type PlaybackView,
  type QueryContext,
  type SimulationQuery,
} from '../lib/url/schema';
import type { IndexExposure } from '../lib/data/types';
import type { SimulationInputBase } from '../lib/sim/types';

const QUERY_KEYS = ['mode', 'p', 'm', 'mg', 'ma', 'y', 'exp', 'src', 'from', 'to', 'r', 'view'] as const;

type QueryKey = (typeof QUERY_KEYS)[number];
type LegacyQueryKey = (typeof LEGACY_QUERY_KEYS)[number];

/**
 * 레거시 키까지 nuqs에 등록하는 이유: nuqs는 자기가 관리하는 키만 URL에서 건드린다.
 * 등록해두고 setInput 때마다 null을 넣어야 탭 시절 파라미터가 주소창에서 사라진다.
 */
const RAW_PARSERS = {
  mode: parseAsString,
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
  view: parseAsString,
  scenarios: parseAsString,
  target: parseAsString,
} satisfies Record<QueryKey | LegacyQueryKey, typeof parseAsString>;

function toSearchParams(raw: Partial<Record<QueryKey, string | null>>): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of QUERY_KEYS) {
    const value = raw[key];
    if (value !== null && value !== undefined) params.set(key, value);
  }
  return params;
}

export function useSimulationInputState(context: QueryContext): {
  base: SimulationInputBase;
  exposures: IndexExposure[];
  view: PlaybackView;
  setBase: (base: SimulationInputBase) => void;
  setExposures: (exposures: IndexExposure[]) => void;
  setView: (view: PlaybackView) => void;
  shareUrl: () => string;
} {
  const [raw, setRaw] = useQueryStates(RAW_PARSERS, {
    history: 'replace',
    shallow: true,
  });

  const query = useMemo(
    () => parseSimulationQuery(toSearchParams(raw), context),
    [raw, context],
  );

  const setQuery = useCallback(
    (next: SimulationQuery) => {
      const params = serializeSimulationQuery(next);
      const patch: Partial<Record<QueryKey | LegacyQueryKey, string | null>> = {};
      for (const key of QUERY_KEYS) {
        patch[key] = params.has(key) ? params.get(key) : null;
      }
      for (const key of LEGACY_QUERY_KEYS) patch[key] = null;
      void setRaw(patch);
    },
    [setRaw],
  );

  const setBase = useCallback(
    (base: SimulationInputBase) => setQuery({ ...query, base }),
    [setQuery, query],
  );

  const setExposures = useCallback(
    (exposures: IndexExposure[]) => setQuery({ ...query, exposures }),
    [setQuery, query],
  );

  const setView = useCallback(
    (view: PlaybackView) => setQuery({ ...query, view }),
    [setQuery, query],
  );

  const shareUrl = useCallback(() => {
    const params = serializeSimulationQuery(query);
    if (typeof window === 'undefined') return `?${params.toString()}`;
    return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
  }, [query]);

  return {
    base: query.base,
    exposures: query.exposures,
    view: query.view,
    setBase,
    setExposures,
    setView,
    shareUrl,
  };
}
