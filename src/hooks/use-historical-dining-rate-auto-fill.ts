'use client';

import { useEffect, useMemo, useRef } from 'react';
import { computeDiningRateForWindow, computeHistoricalDiningRate } from '../lib/market/returns';
import type { ReturnSource } from '../lib/sim/types';
import { useDataset } from './use-dataset';

/**
 * 외식물가 배지 슬라이더의 상승률을 실측 CPI로 자동 채운다.
 * use-historical-cagr-auto-fill.ts와 같은 "자동 추적" 정책이다 — 마지막으로
 * 자동 채운 값과 현재 annualRate가 같을 때만 새 계산값으로 덮어쓴다. 사용자가
 * 슬라이더를 직접 움직이면 그 순간부터 더는 건드리지 않는다.
 *
 * returnSource가 historicalPath(과거 흐름 재생)면 주가가 재생하는 것과 같은
 * from~to 구간의 실측 물가 상승률을 쓴다 — 주가는 2008년을 재생하는데 물가는
 * "최근 N년"을 보여주면 두 가정의 시점이 어긋나기 때문이다. constantCagr(고정
 * 수익률) 모드에서는 그런 명시적 구간이 없으므로 기존처럼 "최근 years년" 실측
 * 평균을 쓴다.
 *
 * productIds 없이 useDataset([])을 부르는 이유: diningCpiById는 fxRates와
 * 동일하게 요청 상품과 무관하게 항상 로드되므로(dataset.ts), 상품 시계열은
 * 필요 없다.
 */
export function useHistoricalDiningRateAutoFill(
  itemId: string,
  returnSource: ReturnSource,
  years: number,
  annualRate: number,
  setAnnualRate: (rate: number) => void,
): void {
  const datasetState = useDataset([]);

  const historicalRate = useMemo(() => {
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

  const lastAutoValueRef = useRef<number | null>(null);

  useEffect(() => {
    if (historicalRate === null) {
      lastAutoValueRef.current = null;
      return;
    }

    const untouchedSinceLastAutoFill =
      lastAutoValueRef.current === null || annualRate === lastAutoValueRef.current;

    if (untouchedSinceLastAutoFill && annualRate !== historicalRate) {
      lastAutoValueRef.current = historicalRate;
      setAnnualRate(historicalRate);
    }
  }, [annualRate, historicalRate, setAnnualRate]);
}
