import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { parseYahooChart } from '../src/lib/data/sources/yahoo';
import {
  rawPathForSymbol,
  rawPathForCpiItem,
  RAW_FX_PATH,
  AXIS_SYMBOL,
  RATE_SYMBOL,
} from '../src/lib/data/sources/symbols';
import { FOOD_ITEMS } from '../src/lib/inflation/food-basket';
import { PRODUCTS, BACKFILL_START } from '../src/lib/data/catalog';
import {
  buildDateAxis,
  alignToAxis,
  alignSeriesToAxis,
  forwardFillGaps,
} from '../src/lib/data/align';
import { buildProductSeries } from '../src/lib/data/build';
import type { DataManifest, ProductMeta } from '../src/lib/data/build';
import { encodeSeries } from '../src/lib/data/binary';
import { DATA_FORMAT_VERSION } from '../src/lib/data/version';

const OUT_DIR = path.join(process.cwd(), 'public', 'data');

function log(message: string): void {
  process.stdout.write(`${message}\n`);
}

function loadRaw(symbol: string) {
  const file = rawPathForSymbol(symbol);
  if (!fsSync.existsSync(file)) {
    throw new Error(
      `원천 캐시가 없습니다: ${file}\nnpm run fetch-raw 를 먼저 실행하세요.`,
    );
  }
  return parseYahooChart(JSON.parse(fsSync.readFileSync(file, 'utf-8')));
}

function loadDiningCpiRaw(itemId: string): { dates: string[]; values: number[] } {
  const file = rawPathForCpiItem(itemId);
  if (!fsSync.existsSync(file)) {
    throw new Error(
      `원천 캐시가 없습니다: ${file}\nnpm run fetch-raw 를 먼저 실행하세요.`,
    );
  }
  return JSON.parse(fsSync.readFileSync(file, 'utf-8'));
}

/**
 * ^IRX(13주 국채 수익률)는 연율 퍼센트 단위로 온다(예: 3.70 = 3.70%).
 * 합성 계산은 소수 비율을 전제하므로 100으로 나누지 않으면 드래그가
 * 100배로 부풀어 합성값이 0에 수렴한다.
 *
 * ^IRX는 국채시장이 쉬는 날(재향군인의 날 등, 증시는 열지만 채권시장은 닫는
 * 공휴일)에 시세가 하루씩 비는 경우가 있다. spliceBackfill은 합성 수익률이
 * 단 하루만 NaN이어도 그 지점부터 앞쪽 전체를 NaN으로 되감아버리므로,
 * 결측 하루가 있으면 1995년 이전 전체 백필이 무너진다.
 * 13주 국채 수익률은 하루이틀 사이 급변하지 않으므로 직전 영업일 값으로
 * 전진 채움(forward fill)하는 것이 합리적인 근사다 — align.ts의 forwardFillGaps를
 * 그대로 재사용한다(국내 상품 결측 채움과 같은 규칙).
 */
function loadRiskFreeRates(axis: string[]): Float64Array {
  const raw = loadRaw(RATE_SYMBOL);
  const percent = alignToAxis(axis, raw, 'adjClose');
  const rates = new Float64Array(percent.length);
  for (let i = 0; i < percent.length; i += 1) {
    rates[i] = percent[i] / 100;
  }
  return forwardFillGaps(rates).filled;
}

/**
 * 날짜 키 시계열(dates)이 오름차순인지 검증한다.
 * alignSeriesToAxis는 오름차순 전제로 커서를 앞으로만 이동시키는 단일 순회
 * 알고리즘이라, 역순이 섞여 들어오면 오류를 던지는 게 아니라 커서가 일찍
 * 멈춰버려 그 이후 축 전체가 마지막(=가장 최근) 관측값으로 조용히 채워진다.
 * 환율(fx)뿐 아니라 CPI 등 alignSeriesToAxis를 쓰는 모든 원천 시계열에 적용해,
 * 전 구간이 엉뚱한 값으로 뒤덮이는 사고를 빌드 타임에 막는다.
 *
 * @param seriesLabel 에러 메시지에 표시할 시계열 식별자 (예: 'fx.json', 'cpi-rice')
 */
function assertAscendingDates(dates: string[], seriesLabel: string): void {
  for (let i = 1; i < dates.length; i += 1) {
    if (dates[i] < dates[i - 1]) {
      throw new Error(
        `${seriesLabel}의 dates가 오름차순이 아닙니다: 인덱스 ${i - 1} "${dates[i - 1]}" → ${i} "${dates[i]}"`,
      );
    }
  }
}

async function main(): Promise<void> {
  await fs.mkdir(OUT_DIR, { recursive: true });

  // 축은 S&P500 지수 기준이다 — 미국 거래일 커버리지가 가장 길다
  const axisSource = loadRaw(AXIS_SYMBOL);
  const axis = buildDateAxis(axisSource.dates, BACKFILL_START);
  log(`날짜 축 ${axis.length}일  ${axis[0]} ~ ${axis[axis.length - 1]}`);

  const fxRaw: { dates: string[]; values: number[] } = JSON.parse(
    fsSync.readFileSync(RAW_FX_PATH, 'utf-8'),
  );
  assertAscendingDates(fxRaw.dates, 'fx.json');
  const fxRates = alignSeriesToAxis(axis, fxRaw);

  // 금리는 백필 대상 상품에서만 쓰이지만 축이 같으므로 한 번만 정렬한다
  const riskFreeRates = loadRiskFreeRates(axis);

  const metas: ProductMeta[] = [];

  for (const product of PRODUCTS) {
    const etf = loadRaw(product.ticker);
    const actual = alignToAxis(axis, etf, 'adjClose');

    const indexValues =
      product.backfillIndex === null
        ? null
        : alignToAxis(axis, loadRaw(product.backfillIndex), 'adjClose');

    const { krwValues, meta } = buildProductSeries({
      product,
      axis,
      actualUsd: actual,
      indexValues,
      riskFreeRates: product.backfillIndex === null ? null : riskFreeRates,
      fxRates,
    });

    await fs.writeFile(
      path.join(OUT_DIR, `${product.id}.bin`),
      encodeSeries(krwValues),
    );
    metas.push(meta);

    const synthetic = meta.syntheticUntil ?? '없음';
    log(
      `  ${product.id.padEnd(20)} ${meta.availableFrom} ~  합성구간 ${synthetic}`,
    );
  }

  await fs.writeFile(path.join(OUT_DIR, 'fx.bin'), encodeSeries(fxRates));
  log(`  ${'fx'.padEnd(20)} ${axis[0]} ~ ${axis[axis.length - 1]}`);

  const diningCpi: DataManifest['diningCpi'] = [];
  for (const item of FOOD_ITEMS) {
    const raw = loadDiningCpiRaw(item.id);
    assertAscendingDates(raw.dates, `cpi-${item.id}`);
    const aligned = alignSeriesToAxis(axis, raw);
    const file = `cpi-${item.id}.bin`;
    await fs.writeFile(path.join(OUT_DIR, file), encodeSeries(aligned));
    diningCpi.push({ itemId: item.id, file, length: aligned.length });
    log(`  ${file.padEnd(20)} ${axis[0]} ~ ${axis[axis.length - 1]}`);
  }

  const manifest: DataManifest = {
    formatVersion: DATA_FORMAT_VERSION,
    generatedAt: new Date().toISOString(),
    startDate: BACKFILL_START,
    dates: axis,
    products: metas,
    fx: { file: 'fx.bin', length: fxRates.length },
    diningCpi,
  };

  await fs.writeFile(
    path.join(OUT_DIR, 'meta.json'),
    JSON.stringify(manifest),
  );

  log(`\n산출물 ${metas.length}종 + meta.json 생성 완료`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`실패: ${message}\n`);
  process.exitCode = 1;
});
