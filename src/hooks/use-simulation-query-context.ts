'use client';

import { useMemo } from 'react';
import { todayInKst } from '../lib/date';
import type { QueryContext } from '../lib/url/schema';

/**
 * InputPanel과 결과 뷰가 각자 독립적으로 useSimulationInputState를 호출하면서도
 * 정확히 같은 QueryContext(오늘 날짜)를 쓰도록 보장한다. 두 값이 갈리면 startMonth
 * 등 파싱 결과가 컴포넌트마다 달라질 수 있다.
 *
 * 모드는 더 이상 여기 없다 — 라우트가 하나가 되면서 쿼리 파라미터로 옮겨갔다(D2).
 */
export function useSimulationQueryContext(): QueryContext {
  return useMemo(() => ({ today: todayInKst() }), []);
}
