'use client';

import { startTransition, useEffect, useMemo, useRef } from 'react';
import { getProduct } from '../lib/data/catalog';
import type { IndexExposure } from '../lib/data/types';
import { computeHistoricalCagr } from '../lib/market/returns';
import type { SimulationInputBase } from '../lib/sim/types';
import { useDataset } from './use-dataset';

/**
 * CAGR 직선 모드의 연 수익률을 "선택한 지수의 과거 years년 CAGR"로 자동
 * 채운다. exposure는 어떤 지수를 기준으로 잡을지 호출부가 결정한다 — 노출을
 * 여러 개 고른 경우에도 그중 첫 번째를 대표로 쓴다. null이면 데이터를
 * 불러오지 않고 아무것도 하지 않는다(backtest 모드는 CAGR 토글 자체가 없다).
 *
 * "자동 추적" 정책: 마지막으로 자동 채운 값과 현재 annualRate가 같을 때만
 * 새 계산값으로 덮어쓴다. 사용자가 직접 값을 고치면 그 순간부터 더는
 * 건드리지 않고, exposure·years가 다시 바뀌면 계속 추적한다.
 */
export function useHistoricalCagrAutoFill(
  exposure: IndexExposure | null,
  input: SimulationInputBase,
  setInput: (input: SimulationInputBase) => void,
): void {
  const productId = exposure === null ? null : getProduct(exposure).id;
  const datasetState = useDataset(productId === null ? [] : [productId]);

  const historicalCagr = useMemo(() => {
    if (productId === null || datasetState.status !== 'ready') return null;
    return computeHistoricalCagr(datasetState.dataset.seriesById, productId, input.years);
  }, [productId, datasetState, input.years]);

  const lastAutoValueRef = useRef<number | null>(null);

  // years 슬라이더를 드래그하면 historicalCagr이 매 틱 바뀌어 이 effect도 매 틱
  // 재실행된다. 자동 추적 중(사용자가 수익률을 직접 안 건드림)이면 setInput을
  // 다시 부르는데, 이게 urgent 우선순위면 슬라이더 자신의 onValueChange가 이미
  // 부른 setInput과 겹쳐 틱 하나당 커밋이 두 배가 된다 — startTransition으로
  // 감싸 그 트리거가 된 드래그의 urgent 렌더를 막지 않게 한다.
  useEffect(() => {
    if (input.returnSource.type !== 'constantCagr' || historicalCagr === null) {
      lastAutoValueRef.current = null;
      return;
    }

    const untouchedSinceLastAutoFill =
      lastAutoValueRef.current === null || input.returnSource.annualRate === lastAutoValueRef.current;

    if (untouchedSinceLastAutoFill && input.returnSource.annualRate !== historicalCagr) {
      lastAutoValueRef.current = historicalCagr;
      startTransition(() => {
        setInput({ ...input, returnSource: { type: 'constantCagr', annualRate: historicalCagr } });
      });
    }
  }, [input, historicalCagr, setInput]);
}
