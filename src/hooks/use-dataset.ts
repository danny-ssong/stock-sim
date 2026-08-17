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
  // productIds가 바뀌었는지를 렌더 중에 감지하기 위한 "이전 key" 추적.
  // React 공식 문서의 "Adjusting state when a prop changes" 패턴 — key가 달라지면
  // useEffect를 기다리지 않고 이 렌더에서 즉시 loading으로 리셋해, key가 바뀐 렌더와
  // loading 전환 사이에 한 프레임의 불일치가 생기지 않도록 한다.
  const [loadedKey, setLoadedKey] = useState(key);

  // key가 바뀌었는데도 이 값을 그대로 반환하면, 이 렌더 안에서 이 훅을 호출한
  // 쪽(useFutureSimulationResult 등)이 "새 productIds + 이전 dataset" 조합을
  // 그대로 써버릴 수 있다 — setState는 다음 렌더에서야 반영되기 때문이다.
  // 그래서 setState로 리셋을 예약하는 동시에, 이 호출의 반환값 자체도
  // 즉시 loading으로 바꿔 같은 렌더 안에서부터 일관되게 만든다.
  const isStale = key !== loadedKey;
  if (isStale) {
    setLoadedKey(key);
    setState({ status: 'loading' });
  }

  useEffect(() => {
    let cancelled = false;

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

  return isStale ? { status: 'loading' } : state;
}
