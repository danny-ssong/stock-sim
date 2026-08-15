import path from 'node:path';
import { PRODUCTS } from '../catalog';

export const RAW_DIR = path.join(process.cwd(), 'data', 'raw');

/**
 * 날짜 축의 기준 심볼.
 * 어떤 상품도 이 심볼을 백필 지수로 쓰지 않지만, 미국 거래일 커버리지가
 * 가장 길어(1970~) 정규 축으로 쓰기에 가장 적합하다. 그래서 명시적으로 넣는다.
 */
export const AXIS_SYMBOL = '^GSPC';

function collectSymbols(): string[] {
  const symbols = new Set<string>([AXIS_SYMBOL]);
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
