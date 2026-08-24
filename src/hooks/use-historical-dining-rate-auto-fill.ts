'use client';

import { useEffect, useMemo, useRef } from 'react';
import { computeHistoricalDiningRate } from '../lib/market/returns';
import { useDataset } from './use-dataset';

/**
 * 외식물가 배지 슬라이더의 상승률을 "실측 CPI 기준 최근 years년 평균 상승률"로
 * 자동 채운다. use-historical-cagr-auto-fill.ts와 같은 "자동 추적" 정책이다 —
 * 마지막으로 자동 채운 값과 현재 annualRate가 같을 때만 새 계산값으로 덮어쓴다.
 * 사용자가 슬라이더를 직접 움직이면 그 순간부터 더는 건드리지 않고,
 * years가 다시 바뀌면 계속 추적한다.
 *
 * productIds 없이 useDataset([])을 부르는 이유: diningCpiById는 fxRates와
 * 동일하게 요청 상품과 무관하게 항상 로드되므로(dataset.ts), 상품 시계열은
 * 필요 없다.
 */
export function useHistoricalDiningRateAutoFill(
  itemId: string,
  years: number,
  annualRate: number,
  setAnnualRate: (rate: number) => void,
): void {
  const datasetState = useDataset([]);

  const historicalRate = useMemo(() => {
    if (datasetState.status !== 'ready') return null;
    return computeHistoricalDiningRate(datasetState.dataset.diningCpiById, itemId, years);
  }, [datasetState, itemId, years]);

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
