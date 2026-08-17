'use client';

import { useEffect, useState } from 'react';
import { createHttpFetcher, loadDataset, type DataFetcher, type Dataset } from '../lib/data/dataset';

export type DatasetState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; dataset: Dataset };

export function useDataset(
  productIds: string[],
  fetcher: DataFetcher = createHttpFetcher(),
): DatasetState {
  const key = productIds.slice().sort().join(',');
  const [state, setState] = useState<DatasetState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });

    loadDataset(productIds, fetcher)
      .then((dataset) => {
        if (!cancelled) setState({ status: 'ready', dataset });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : '데이터를 불러오지 못했습니다',
        });
      });

    return () => {
      cancelled = true;
    };
    // key가 productIds의 내용을 대표하므로 이것만 의존성으로 둔다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}
