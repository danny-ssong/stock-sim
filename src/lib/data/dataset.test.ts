import { describe, it, expect, beforeEach } from 'vitest';
import { loadDataset, clearDatasetCache, type DataFetcher } from './dataset';

function encode(values: number[]): ArrayBuffer {
  const f32 = Float32Array.from(values);
  return f32.buffer.slice(0);
}

const MANIFEST = {
  formatVersion: 3,
  generatedAt: '2026-08-16T00:00:00.000Z',
  startDate: '2020-01-02',
  dates: ['2020-01-02', '2020-01-03', '2020-01-06'],
  fx: { file: 'fx.bin', length: 3 },
  diningCpi: [{ itemId: 'gukbap', file: 'cpi-gukbap.bin', length: 3 }],
  products: [
    {
      id: 'QQQ',
      availableFrom: '2020-01-02',
      syntheticUntil: null,
      length: 3,
      filledGapDays: 0,
    },
    {
      id: 'SPY',
      availableFrom: '2020-01-02',
      syntheticUntil: null,
      length: 3,
      filledGapDays: 0,
    },
  ],
};

function createFetcher(): DataFetcher & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async json(path) {
      calls.push(path);
      return MANIFEST;
    },
    async binary(path) {
      calls.push(path);
      if (path === 'fx.bin') return encode([1100, 1110, 1120]);
      if (path === 'cpi-gukbap.bin') return encode([100, 101, 103]);
      if (path === 'QQQ.bin') return encode([100, 102, 101]);
      return encode([200, 201, 203]);
    },
  };
}

describe('loadDataset', () => {
  beforeEach(() => clearDatasetCache());

  it('요청한 상품만 내려받아 Float64Array로 준다', async () => {
    const fetcher = createFetcher();
    const dataset = await loadDataset(['QQQ'], fetcher);

    expect(dataset.dates).toEqual(['2020-01-02', '2020-01-03', '2020-01-06']);
    expect(Array.from(dataset.fxRates)).toEqual([1100, 1110, 1120]);
    expect(dataset.seriesById.get('QQQ')).toBeInstanceOf(Float64Array);
    expect(Array.from(dataset.seriesById.get('QQQ') ?? [])).toEqual([100, 102, 101]);
    expect(dataset.seriesById.has('SPY')).toBe(false);
    expect(Array.from(dataset.diningCpiById.get('gukbap') ?? [])).toEqual([100, 101, 103]);
    expect(fetcher.calls).toEqual(['meta.json', 'fx.bin', 'cpi-gukbap.bin', 'QQQ.bin']);
  });

  it('같은 상품을 다시 요청하면 캐시를 쓰고 네트워크를 타지 않는다', async () => {
    const fetcher = createFetcher();
    await loadDataset(['QQQ'], fetcher);
    await loadDataset(['QQQ'], fetcher);
    expect(fetcher.calls.filter((c) => c === 'QQQ.bin')).toHaveLength(1);
  });

  it('매니페스트에 없는 상품을 요청하면 던진다', async () => {
    const fetcher = createFetcher();
    await expect(loadDataset(['TQQQ'], fetcher)).rejects.toThrow(/TQQQ/);
  });

  it('바이너리 길이가 dates 길이와 다르면 던진다', async () => {
    const fetcher = createFetcher();
    const broken: DataFetcher = {
      json: fetcher.json,
      async binary(path) {
        if (path === 'QQQ.bin') return encode([100, 102]);
        return fetcher.binary(path);
      },
    };
    await expect(loadDataset(['QQQ'], broken)).rejects.toThrow(/길이/);
  });

  it('요청한 상품이 없어도 외식물가 CPI는 항상 로드한다', async () => {
    const fetcher = createFetcher();
    const dataset = await loadDataset([], fetcher);
    expect(Array.from(dataset.diningCpiById.get('gukbap') ?? [])).toEqual([100, 101, 103]);
  });
});
