import { decodeSeries } from './binary';
import { parseManifest, type ParsedManifest, type ProductDataFacts } from './manifest';

/** 엔진이 계산에 쓰는 시계열 묶음. 전부 dates와 같은 길이다. */
export type Dataset = {
  dates: string[];
  /** USD/KRW 일별 환율 */
  fxRates: Float64Array;
  /** 상품별 원화 환산 총수익 지수 레벨. adjClose(USD) × 환율이라 절대 수준도
   *  실제 원화 가격이다 — 엔진은 대부분 비율만 쓰지만, 미래 모드 가격 차트는
   *  말단 값을 실제 가격 앵커로 쓴다(engine.ts buildPortfolioIndex). */
  seriesById: Map<string, Float64Array>;
  factsById: Map<string, ProductDataFacts>;
  /** 외식물가 실측 CPI 지수(품목 id별). fxRates와 동일하게 요청 상품과 무관하게 항상 로드한다. */
  diningCpiById: Map<string, Float64Array>;
};

export type DataFetcher = {
  json(path: string): Promise<unknown>;
  binary(path: string): Promise<ArrayBuffer>;
};

/**
 * 모듈 스코프 캐시. 종목당 32KB라 한 번 받으면 세션 내내 재사용한다(§10).
 * 순수 함수 원칙의 유일한 예외이며, 테스트는 clearDatasetCache로 초기화한다.
 */
let manifestCache: ParsedManifest | null = null;
const seriesCache = new Map<string, Float64Array>();

export function clearDatasetCache(): void {
  manifestCache = null;
  seriesCache.clear();
}

function toFloat64(buffer: ArrayBuffer, expectedLength: number, label: string): Float64Array {
  const f32 = decodeSeries(buffer);
  if (f32.length !== expectedLength) {
    throw new Error(
      `${label}의 길이가 날짜 축과 다릅니다: 기대 ${expectedLength}, 실제 ${f32.length}`,
    );
  }
  return Float64Array.from(f32);
}

export async function loadDataset(
  productIds: string[],
  fetcher: DataFetcher,
): Promise<Dataset> {
  if (manifestCache === null) {
    manifestCache = parseManifest(await fetcher.json('meta.json'));
  }
  const manifest = manifestCache;
  const axisLength = manifest.dates.length;

  const fxKey = `__fx__:${manifest.fx.file}`;
  let fxRates = seriesCache.get(fxKey);
  if (fxRates === undefined) {
    fxRates = toFloat64(await fetcher.binary(manifest.fx.file), axisLength, '환율 시계열');
    seriesCache.set(fxKey, fxRates);
  }

  const diningCpiById = new Map<string, Float64Array>();
  for (const entry of manifest.diningCpi) {
    const cpiKey = `__diningCpi__:${entry.file}`;
    let series = seriesCache.get(cpiKey);
    if (series === undefined) {
      series = toFloat64(await fetcher.binary(entry.file), axisLength, `${entry.itemId} 외식물가 시계열`);
      seriesCache.set(cpiKey, series);
    }
    diningCpiById.set(entry.itemId, series);
  }

  const seriesById = new Map<string, Float64Array>();
  const factsById = new Map<string, ProductDataFacts>();

  for (const id of productIds) {
    const facts = manifest.products.find((p) => p.id === id);
    if (facts === undefined) {
      throw new Error(`산출물에 없는 상품입니다: ${id}`);
    }
    factsById.set(id, facts);

    const cached = seriesCache.get(id);
    if (cached !== undefined) {
      seriesById.set(id, cached);
      continue;
    }

    const series = toFloat64(await fetcher.binary(`${id}.bin`), axisLength, id);
    seriesCache.set(id, series);
    seriesById.set(id, series);
  }

  return { dates: manifest.dates, fxRates, seriesById, factsById, diningCpiById };
}

/** 정적 자산에서 받아오는 기본 fetcher. Route Handler를 거치지 않는다(§10). */
export function createHttpFetcher(baseUrl = '/data'): DataFetcher {
  return {
    async json(path) {
      const response = await fetch(`${baseUrl}/${path}`);
      if (!response.ok) throw new Error(`${path} 요청 실패: ${response.status}`);
      return response.json();
    },
    async binary(path) {
      const response = await fetch(`${baseUrl}/${path}`);
      if (!response.ok) throw new Error(`${path} 요청 실패: ${response.status}`);
      return response.arrayBuffer();
    },
  };
}
