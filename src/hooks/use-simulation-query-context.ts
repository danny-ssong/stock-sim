'use client';

import { useMemo } from 'react';
import { todayInKst } from '../lib/date';
import type { QueryContext } from '../lib/url/schema';

/**
 * InputPanel과 ResultsView(및 향후 탭 2·3의 결과 뷰)가 각자 독립적으로
 * useSimulationInputState를 호출하면서도 정확히 같은 QueryContext(오늘 날짜·
 * 기본 환율)를 쓰도록 보장한다. 두 값이 갈리면 fx=fixed 파싱 결과가
 * 컴포넌트마다 달라질 수 있다.
 */
export function useSimulationQueryContext(mode: 'future' | 'backtest'): QueryContext {
  return useMemo(
    () => ({ mode, today: todayInKst(), defaultFixedFxRate: 1400 }),
    [mode],
  );
}
