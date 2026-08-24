import path from 'node:path';
import { PRODUCTS } from '../catalog';

export const RAW_DIR = path.join(process.cwd(), 'data', 'raw');

/**
 * 날짜 축의 기준 심볼.
 * 어떤 상품도 이 심볼을 백필 지수로 쓰지 않지만, 미국 거래일 커버리지가
 * 가장 길어(1970~) 정규 축으로 쓰기에 가장 적합하다. 그래서 명시적으로 넣는다.
 */
export const AXIS_SYMBOL = '^GSPC';

/**
 * 무위험 금리 시계열 — 13주 미국 국채 수익률.
 * 레버리지 ETF의 차입비용이 금리에 연동되므로 합성에 필수다.
 * 어떤 상품도 이를 백필 지수로 쓰지 않으므로 명시적으로 넣는다.
 */
export const RATE_SYMBOL = '^IRX';

function collectSymbols(): string[] {
  const symbols = new Set<string>([AXIS_SYMBOL, RATE_SYMBOL]);
  for (const product of PRODUCTS) {
    symbols.add(product.ticker);
    if (product.backfillIndex !== null) symbols.add(product.backfillIndex);
  }
  return [...symbols];
}

export const REQUIRED_YAHOO_SYMBOLS: readonly string[] = collectSymbols();

/** `^`와 `.`은 파일명에서 다루기 번거로우므로 `_`로 치환한다. */
export function rawPathForSymbol(symbol: string): string {
  const safe = symbol.replaceAll(/[^A-Za-z0-9]/g, '_');
  return path.join(RAW_DIR, 'yahoo', `${safe}.json`);
}

export const RAW_FX_PATH = path.join(RAW_DIR, 'ecos', 'fx.json');

/** 외식물가 CPI 원천 캐시 경로. 품목 id 하나당 파일 하나다. */
export function rawPathForCpiItem(itemId: string): string {
  return path.join(RAW_DIR, 'ecos', `cpi-${itemId}.json`);
}
