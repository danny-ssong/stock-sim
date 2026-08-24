import fs from 'node:fs/promises';
import path from 'node:path';
import { yahooChartUrl, parseYahooChart } from '../src/lib/data/sources/yahoo';
import { ecosSeriesUrl, parseEcosResponse, ECOS_FX_STAT_CODE, ECOS_FX_ITEM_CODE } from '../src/lib/data/sources/ecos';
import {
  REQUIRED_YAHOO_SYMBOLS,
  RAW_DIR,
  RAW_FX_PATH,
  rawPathForSymbol,
} from '../src/lib/data/sources/symbols';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';
const FX_START = '1994-01-01'; // 1995 시작점의 전일 수익률 계산 여유분

function log(message: string): void {
  process.stdout.write(`${message}\n`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} — ${url}`);
  }
  return response.json();
}

async function fetchYahooAll(): Promise<void> {
  await fs.mkdir(path.join(RAW_DIR, 'yahoo'), { recursive: true });

  for (const symbol of REQUIRED_YAHOO_SYMBOLS) {
    const json = await fetchJson(yahooChartUrl(symbol));
    // 저장 전에 파싱해서 형태를 검증한다. 깨진 응답을 캐시하지 않기 위함이다.
    const series = parseYahooChart(json);
    await fs.writeFile(rawPathForSymbol(symbol), JSON.stringify(json));
    log(
      `  ${symbol.padEnd(12)} ${String(series.dates.length).padStart(6)}행  ` +
      `${series.dates[0]} ~ ${series.dates[series.dates.length - 1]}`,
    );
    await sleep(400); // 레이트 리밋 회피
  }
}

async function fetchFx(): Promise<void> {
  const apiKey = process.env.ECOS_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ECOS_API_KEY가 설정되지 않았습니다. .env.example을 참고해 발급받으세요.',
    );
  }

  await fs.mkdir(path.join(RAW_DIR, 'ecos'), { recursive: true });

  const today = new Date().toISOString().slice(0, 10);
  const merged: { dates: string[]; values: number[] } = { dates: [], values: [] };

  // ECOS는 1회 요청 행수에 제한이 있어 연 단위로 나눠 받는다.
  const startYear = Number(FX_START.slice(0, 4));
  const endYear = Number(today.slice(0, 4));

  for (let year = startYear; year <= endYear; year += 1) {
    const url = ecosSeriesUrl(apiKey, ECOS_FX_STAT_CODE, ECOS_FX_ITEM_CODE, 'D', `${year}-01-01`, `${year}-12-31`, 1, 400);
    const chunk = parseEcosResponse(await fetchJson(url));
    merged.dates.push(...chunk.dates);
    merged.values.push(...chunk.values);
    log(`  ${year}  ${String(chunk.dates.length).padStart(4)}행`);
    await sleep(300);
  }

  await fs.writeFile(RAW_FX_PATH, JSON.stringify(merged));
  log(`  총 ${merged.dates.length}행 저장`);
}

async function main(): Promise<void> {
  log('Yahoo Finance 수집');
  await fetchYahooAll();
  log('\n한국은행 ECOS 환율 수집');
  await fetchFx();
  log('\n완료');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`실패: ${message}\n`);
  process.exitCode = 1;
});
