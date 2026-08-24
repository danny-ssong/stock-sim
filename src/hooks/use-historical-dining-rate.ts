'use client';

import { useMemo } from 'react';
import { computeDiningRateForWindow, computeHistoricalDiningRate } from '../lib/market/returns';
import type { ReturnSource } from '../lib/sim/types';
import { useDataset } from './use-dataset';

/**
 * 외식물가 품목의 실측 상승률을 계산한다. 사용자가 조정할 수 있는 값이 아니라
 * (슬라이더 없음) 항상 실측 데이터를 그대로 보여준다 — 데이터가 준비되기
 * 전엔 null을 반환한다.
 *
 * returnSource가 historicalPath(과거 흐름 재생)면 주가가 재생하는 것과 같은
 * from~to 구간의 실측 물가 상승률을 쓴다 — 주가는 2008년을 재생하는데 물가는
 * "최근 N년"을 보여주면 두 가정의 시점이 어긋나기 때문이다. constantCagr(고정
 * 수익률) 모드에서는 그런 명시적 구간이 없으므로 "최근 years년" 실측 평균을 쓴다.
 *
 * productIds 없이 useDataset([])을 부르는 이유: diningCpiById는 fxRates와
 * 동일하게 요청 상품과 무관하게 항상 로드되므로(dataset.ts), 상품 시계열은
 * 필요 없다.
 */
export function useHistoricalDiningRate(
  itemId: string,
  returnSource: ReturnSource,
  years: number,
): number | null {
  const datasetState = useDataset([]);

  return useMemo(() => {
    if (datasetState.status !== 'ready') return null;
    const { dataset } = datasetState;

    if (returnSource.type === 'historicalPath') {
      return computeDiningRateForWindow(
        dataset.dates,
        dataset.diningCpiById,
        itemId,
        returnSource.from,
        returnSource.to,
      );
    }
    return computeHistoricalDiningRate(dataset.diningCpiById, itemId, years);
  }, [datasetState, itemId, returnSource, years]);
}
