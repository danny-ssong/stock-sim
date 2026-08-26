'use client';

import { useMemo } from 'react';
import { getProduct } from '../lib/data/catalog';
import type { IndexExposure } from '../lib/data/types';
import { FALLBACK_ANNUAL_RATE, resolveConstantRate } from '../lib/market/returns';
import type { ReturnSource } from '../lib/sim/types';
import { useDataset } from './use-dataset';

/**
 * 고정 수익률 슬라이더에 **표시할** 연 수익률을 구한다.
 *
 * 예전 useHistoricalCagrAutoFill은 이 값을 useEffect에서 setInput으로 URL에
 * 써넣었다. 그래서 (1) years 슬라이더를 드래그하면 슬라이더 자신의 setInput과
 * 겹쳐 틱마다 커밋이 두 배가 되고, (2) "사용자가 건드렸는지"를 ref 값 비교로
 * 추론해야 해서, 사용자가 우연히 자동값과 같은 값을 고르면 다음 변경 때 그
 * 선택을 덮어쓰는 버그가 있었다.
 *
 * 이제 "안 고름"은 returnSource.annualRate === null로 타입에 있고(sim/types.ts),
 * 이 훅은 아무것도 쓰지 않고 읽기만 한다. 엔진도 같은 resolveConstantRate를
 * 부르므로(engine.ts) 표시값과 계산값이 갈리지 않는다.
 *
 * exposure가 null이거나(백테스트·비교 모드는 이 슬라이더 자체가 없다) 데이터가
 * 아직 없으면 폴백 상수를 반환한다 — 로딩 중 슬라이더가 비지 않게 한다.
 */
export function useEffectiveAnnualRate(
  exposure: IndexExposure | null,
  returnSource: ReturnSource,
  years: number,
): number {
  const productId = exposure === null ? null : getProduct(exposure).id;
  const datasetState = useDataset(productId === null ? [] : [productId]);

  return useMemo(() => {
    if (returnSource.type !== 'constantCagr') return FALLBACK_ANNUAL_RATE;
    if (returnSource.annualRate !== null) return returnSource.annualRate;
    if (productId === null || datasetState.status !== 'ready') return FALLBACK_ANNUAL_RATE;
    return resolveConstantRate(datasetState.dataset.seriesById, productId, years, null);
  }, [productId, datasetState, returnSource, years]);
}
