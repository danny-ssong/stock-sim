# 데이터 파이프라인 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 1995년부터 현재까지의 검증된 일별 원화 환산 총수익 시계열을 정적 바이너리 자산으로 생성하는 빌드 파이프라인을 만든다.

**Architecture:** 네트워크 수집과 계산을 분리한다. `fetch-raw`가 원천 데이터를 `data/raw/`에 캐시하고, `build-data`가 그 캐시만 읽어 결정적으로 산출물을 만든다. 이 분리 덕분에 합성 로직 전체를 네트워크 없이 테스트할 수 있고, 골든 테스트가 CI에서 재현 가능해진다. 미국 상장 레버리지 ETF만 상장 이전 구간을 합성하며, 합성값은 실제 데이터 구간에서 오차 1% 이내임을 검증한 뒤에만 사용한다.

**Tech Stack:** TypeScript 5 / Node 22 / Vitest 3 / Zod 4 / tsx

**Spec:** `docs/superpowers/specs/2026-08-14-investment-simulator-design.md`

## Global Constraints

- 언어: 코드 주석·커밋 메시지·문서는 **한국어**. 변수명·함수명은 영어.
- `as` 타입 단언과 non-null assertion(`!`) **사용 금지**. 외부 데이터 파싱은 Zod 스키마로 검증한다.
- `console.log` 금지. 스크립트의 진행 출력은 `process.stdout.write` 또는 전용 로거를 쓴다.
- 불변성: 배열·객체 변경 시 스프레드를 사용한다. 단 `Float64Array` 등 성능 목적의 타입드 배열 내부 채우기는 예외로 허용한다.
- 모든 날짜는 `YYYY-MM-DD` ISO 문자열로 다룬다. `Date` 객체를 시계열 키로 쓰지 않는다.
- 계산은 `Float64Array`, 저장은 `Float32Array`.
- 데이터 시작일: **1995-01-03**.
- 합성 대상: **미국 상장 레버리지 ETF만**. 국내 상장 상품과 SCHD는 백필하지 않는다.
- 골든 테스트 통과 기준: 합성 시계열의 **연환산 CAGR 오차 절댓값 < 1%**.

## 이 계획 이후

| 계획 | 내용 |
|---|---|
| 2 | 계산·세금 엔진 (`lib/sim`, `lib/tax`) |
| 3 | UI 3탭 + URL 상태 |

---

### Task 1: 프로젝트 초기화와 테스트 환경

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`
- Create: `src/lib/data/version.ts`
- Test: `src/lib/data/version.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `DATA_FORMAT_VERSION: number` — 산출물 포맷 버전. Task 10의 `meta.json`에 기록된다.

- [ ] **Step 1: git 저장소와 Next.js 프로젝트 생성**

`create-next-app`은 대상 디렉터리에 낯선 파일이 있으면 거부한다. `docs/`를 잠시 옮겨두고 생성한 뒤 되돌린다.

```bash
cd /Users/song/ws/personal-finance
git init
mv docs ../.personal-finance-docs-backup
npx create-next-app@latest . --typescript --tailwind --app --src-dir \
  --import-alias "@/*" --use-npm --eslint --turbopack --yes
mv ../.personal-finance-docs-backup docs
```

생성 후 `docs/`가 제자리에 있는지 확인한다.

```bash
ls docs/superpowers/specs/ docs/superpowers/plans/
```

Expected: 스펙과 계획 문서가 그대로 존재한다.

- [ ] **Step 2: 개발 의존성 설치**

```bash
npm install -D vitest@^3 @vitest/coverage-v8@^3 tsx@^4
npm install zod@^4
```

- [ ] **Step 3: Vitest 설정 파일 작성**

`vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: { provider: 'v8', include: ['src/lib/**'] },
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
```

- [ ] **Step 4: package.json에 스크립트 추가**

`package.json`의 `scripts`에 다음을 추가한다:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "fetch-raw": "tsx scripts/fetch-raw.ts",
    "build-data": "tsx scripts/build-data.ts"
  }
}
```

- [ ] **Step 5: .gitignore에 원천 캐시 추가**

`.gitignore` 끝에 추가한다:

```
# 원천 데이터 캐시 (재현 가능하므로 커밋하지 않는다)
/data/raw/
```

- [ ] **Step 6: 실패하는 테스트 작성**

`src/lib/data/version.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { DATA_FORMAT_VERSION } from './version';

describe('DATA_FORMAT_VERSION', () => {
  it('1 이상의 정수다', () => {
    expect(Number.isInteger(DATA_FORMAT_VERSION)).toBe(true);
    expect(DATA_FORMAT_VERSION).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 7: 테스트 실패 확인**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./version"`

- [ ] **Step 8: 최소 구현**

`src/lib/data/version.ts`:

```typescript
/** 산출물 바이너리 포맷 버전. 포맷이 바뀌면 올린다. */
export const DATA_FORMAT_VERSION = 1;
```

- [ ] **Step 9: 테스트 통과 확인**

Run: `npm test`
Expected: PASS (1 test)

- [ ] **Step 10: 커밋**

```bash
git add -A
git commit -m "chore: Next.js 16 + Vitest 프로젝트 초기화"
```

---

### Task 2: 도메인 타입과 상품 카탈로그

**Files:**
- Create: `src/lib/data/types.ts`
- Create: `src/lib/data/catalog.ts`
- Test: `src/lib/data/catalog.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `IndexExposure`, `AccountId`, `Market`, `LeverageModel`, `Product`, `ProductResolution` 타입
  - `PRODUCTS: readonly Product[]`
  - `resolveProduct(accountId: AccountId, exposure: IndexExposure): ProductResolution`
  - `getProduct(id: string): Product | undefined`
  - `BACKFILL_START = '1995-01-03'`

- [ ] **Step 1: 타입 정의 작성**

`src/lib/data/types.ts`:

```typescript
/** 사용자가 선택하는 단위 — 무엇에 노출되고 싶은가 */
export type IndexExposure =
  | 'NASDAQ100_1X'
  | 'NASDAQ100_2X'
  | 'NASDAQ100_3X'
  | 'SP500_1X'
  | 'SP500_2X'
  | 'SP500_3X'
  | 'US_DIVIDEND_100';

export type AccountId = 'DIRECT_US' | 'DOMESTIC_ETF' | 'ISA';

export type Market = 'US' | 'KR';

/** 레버리지 수익 계산 방식. 미국 상장과 국내 합성형은 환율 반영 구조가 다르다. */
export type LeverageModel =
  | { kind: 'usListed'; multiplier: number }
  | { kind: 'krSynthetic'; multiplier: number }
  | { kind: 'none' };

export type Product = {
  id: string;
  ticker: string;
  displayName: string;
  exposure: IndexExposure;
  market: Market;
  /** 이 날짜 이전은 실제 데이터가 없다 */
  listedAt: string;
  /** 연 총보수 */
  expenseRatio: number;
  leverage: LeverageModel;
  hedged: boolean;
  /** 백필 기준 지수 심볼. null이면 백필하지 않는다. */
  backfillIndex: string | null;
  /**
   * 백필 시 적용할 연간 순드래그 (차입비용 + 추적오차 − 배당수익률).
   * Task 9의 골든 테스트로 캘리브레이션한 값이다.
   */
  backfillDrag: number;
};

export type ProductUnavailableReason =
  | 'NOT_LISTED_IN_KR'
  | 'ONLY_HEDGED_IN_KR'
  | 'US_ONLY_PRODUCT';

export type ProductResolution =
  | { available: true; product: Product }
  | { available: false; reason: ProductUnavailableReason; message: string };
```

- [ ] **Step 2: 실패하는 테스트 작성**

`src/lib/data/catalog.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { PRODUCTS, resolveProduct, getProduct, BACKFILL_START } from './catalog';

describe('상품 카탈로그', () => {
  it('모든 상품 id가 고유하다', () => {
    const ids = PRODUCTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('백필 대상은 미국 상장 상품뿐이다', () => {
    const backfillable = PRODUCTS.filter((p) => p.backfillIndex !== null);
    expect(backfillable.every((p) => p.market === 'US')).toBe(true);
  });

  it('SCHD는 백필하지 않는다 — 기초지수가 공개 소스에 없다', () => {
    const schd = getProduct('SCHD');
    expect(schd?.backfillIndex).toBeNull();
  });

  it('국내 상장 상품은 전부 백필하지 않는다', () => {
    const kr = PRODUCTS.filter((p) => p.market === 'KR');
    expect(kr.length).toBeGreaterThan(0);
    expect(kr.every((p) => p.backfillIndex === null)).toBe(true);
  });

  it('데이터 시작일은 1995-01-03이다', () => {
    expect(BACKFILL_START).toBe('1995-01-03');
  });
});

describe('resolveProduct', () => {
  it('해외직투 + 나스닥100 3배 = TQQQ', () => {
    const r = resolveProduct('DIRECT_US', 'NASDAQ100_3X');
    expect(r.available).toBe(true);
    if (r.available) expect(r.product.ticker).toBe('TQQQ');
  });

  it('ISA + 나스닥100 3배 = 국내 상장 없음', () => {
    const r = resolveProduct('ISA', 'NASDAQ100_3X');
    expect(r.available).toBe(false);
    if (!r.available) expect(r.reason).toBe('NOT_LISTED_IN_KR');
  });

  it('ISA + S&P500 2배 = 환헤지형만 존재', () => {
    const r = resolveProduct('ISA', 'SP500_2X');
    expect(r.available).toBe(false);
    if (!r.available) expect(r.reason).toBe('ONLY_HEDGED_IN_KR');
  });

  it('ISA와 국내ETF 계좌는 같은 상품으로 해석된다', () => {
    const isa = resolveProduct('ISA', 'NASDAQ100_1X');
    const dom = resolveProduct('DOMESTIC_ETF', 'NASDAQ100_1X');
    expect(isa.available && dom.available).toBe(true);
    if (isa.available && dom.available) {
      expect(isa.product.id).toBe(dom.product.id);
    }
  });

  it('ISA에서 가능한 노출은 4종이다', () => {
    const all: Array<Parameters<typeof resolveProduct>[1]> = [
      'NASDAQ100_1X', 'NASDAQ100_2X', 'NASDAQ100_3X',
      'SP500_1X', 'SP500_2X', 'SP500_3X', 'US_DIVIDEND_100',
    ];
    const ok = all.filter((e) => resolveProduct('ISA', e).available);
    expect(ok).toEqual([
      'NASDAQ100_1X', 'NASDAQ100_2X', 'SP500_1X', 'US_DIVIDEND_100',
    ]);
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npm test -- catalog`
Expected: FAIL — `Failed to resolve import "./catalog"`

- [ ] **Step 4: 카탈로그 구현**

`src/lib/data/catalog.ts`:

```typescript
import type {
  AccountId,
  IndexExposure,
  Market,
  Product,
  ProductResolution,
  ProductUnavailableReason,
} from './types';

/** 데이터 시작일. 환율(1970~)과 지수(1985~)가 모두 커버하는 지점이다. */
export const BACKFILL_START = '1995-01-03';

/**
 * backfillDrag 값은 Task 9의 골든 테스트로 캘리브레이션한 초기 추정치다.
 * 골든 테스트가 실제 최적값을 산출하면 이 값을 갱신한다.
 */
export const PRODUCTS: readonly Product[] = [
  {
    id: 'QQQ',
    ticker: 'QQQ',
    displayName: 'Invesco QQQ Trust',
    exposure: 'NASDAQ100_1X',
    market: 'US',
    listedAt: '1999-03-10',
    expenseRatio: 0.0020,
    leverage: { kind: 'none' },
    hedged: false,
    backfillIndex: '^NDX',
    backfillDrag: 0.0,
  },
  {
    id: 'QLD',
    ticker: 'QLD',
    displayName: 'ProShares Ultra QQQ',
    exposure: 'NASDAQ100_2X',
    market: 'US',
    listedAt: '2006-06-21',
    expenseRatio: 0.0095,
    leverage: { kind: 'usListed', multiplier: 2 },
    hedged: false,
    backfillIndex: '^NDX',
    backfillDrag: 0.0125,
  },
  {
    id: 'TQQQ',
    ticker: 'TQQQ',
    displayName: 'ProShares UltraPro QQQ',
    exposure: 'NASDAQ100_3X',
    market: 'US',
    listedAt: '2010-02-11',
    expenseRatio: 0.0084,
    leverage: { kind: 'usListed', multiplier: 3 },
    hedged: false,
    backfillIndex: '^NDX',
    backfillDrag: 0.0100,
  },
  {
    id: 'SPY',
    ticker: 'SPY',
    displayName: 'SPDR S&P 500 ETF Trust',
    exposure: 'SP500_1X',
    market: 'US',
    listedAt: '1993-01-29',
    expenseRatio: 0.0009,
    leverage: { kind: 'none' },
    hedged: false,
    backfillIndex: null,
    backfillDrag: 0.0,
  },
  {
    id: 'SSO',
    ticker: 'SSO',
    displayName: 'ProShares Ultra S&P500',
    exposure: 'SP500_2X',
    market: 'US',
    listedAt: '2006-06-21',
    expenseRatio: 0.0089,
    leverage: { kind: 'usListed', multiplier: 2 },
    hedged: false,
    backfillIndex: '^SP500TR',
    backfillDrag: 0.0250,
  },
  {
    id: 'SPXL',
    ticker: 'SPXL',
    displayName: 'Direxion Daily S&P 500 Bull 3X',
    exposure: 'SP500_3X',
    market: 'US',
    listedAt: '2008-11-05',
    expenseRatio: 0.0087,
    leverage: { kind: 'usListed', multiplier: 3 },
    hedged: false,
    backfillIndex: '^SP500TR',
    backfillDrag: 0.0200,
  },
  {
    id: 'SCHD',
    ticker: 'SCHD',
    displayName: 'Schwab US Dividend Equity ETF',
    exposure: 'US_DIVIDEND_100',
    market: 'US',
    listedAt: '2011-10-20',
    expenseRatio: 0.0006,
    leverage: { kind: 'none' },
    // 기초지수(Dow Jones US Dividend 100)가 공개 소스에 없어 백필 불가
    backfillIndex: null,
    hedged: false,
    backfillDrag: 0.0,
  },
  {
    id: 'TIGER_NASDAQ100',
    ticker: '133690.KS',
    displayName: 'TIGER 미국나스닥100',
    exposure: 'NASDAQ100_1X',
    market: 'KR',
    listedAt: '2010-10-18',
    expenseRatio: 0.0020,
    leverage: { kind: 'none' },
    hedged: false,
    backfillIndex: null,
    backfillDrag: 0.0,
  },
  {
    id: 'TIGER_NASDAQ100_2X',
    ticker: '418660.KS',
    displayName: 'TIGER 미국나스닥100레버리지(합성)',
    exposure: 'NASDAQ100_2X',
    market: 'KR',
    listedAt: '2022-02-22',
    expenseRatio: 0.0030,
    // 환율 반영 공식을 실측으로 확정하지 못했다. 백필하지 않는다.
    leverage: { kind: 'krSynthetic', multiplier: 2 },
    hedged: false,
    backfillIndex: null,
    backfillDrag: 0.0,
  },
  {
    id: 'TIGER_SP500',
    ticker: '360750.KS',
    displayName: 'TIGER 미국S&P500',
    exposure: 'SP500_1X',
    market: 'KR',
    listedAt: '2020-08-07',
    expenseRatio: 0.0020,
    leverage: { kind: 'none' },
    hedged: false,
    backfillIndex: null,
    backfillDrag: 0.0,
  },
  {
    id: 'TIGER_DIVIDEND',
    ticker: '458730.KS',
    displayName: 'TIGER 미국배당다우존스',
    exposure: 'US_DIVIDEND_100',
    market: 'KR',
    listedAt: '2023-06-20',
    expenseRatio: 0.0011,
    leverage: { kind: 'none' },
    hedged: false,
    backfillIndex: null,
    backfillDrag: 0.0,
  },
];

export function getProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

/** 계좌가 요구하는 시장. ISA와 국내ETF 계좌는 국내 상장만 담을 수 있다. */
function requiredMarket(accountId: AccountId): Market {
  return accountId === 'DIRECT_US' ? 'US' : 'KR';
}

const KR_UNAVAILABLE: Record<string, ProductUnavailableReason> = {
  NASDAQ100_3X: 'NOT_LISTED_IN_KR',
  SP500_3X: 'NOT_LISTED_IN_KR',
  SP500_2X: 'ONLY_HEDGED_IN_KR',
};

const REASON_MESSAGE: Record<ProductUnavailableReason, string> = {
  NOT_LISTED_IN_KR:
    '자본시장법상 2배 초과 레버리지 ETF는 국내 상장이 제한됩니다',
  ONLY_HEDGED_IN_KR: '국내에는 환헤지형만 상장되어 있습니다',
  US_ONLY_PRODUCT: '해외 직접투자 계좌에서만 거래할 수 있습니다',
};

export function resolveProduct(
  accountId: AccountId,
  exposure: IndexExposure,
): ProductResolution {
  const market = requiredMarket(accountId);
  const product = PRODUCTS.find(
    (p) => p.exposure === exposure && p.market === market,
  );

  if (product) return { available: true, product };

  const reason = market === 'KR'
    ? (KR_UNAVAILABLE[exposure] ?? 'NOT_LISTED_IN_KR')
    : 'US_ONLY_PRODUCT';

  return { available: false, reason, message: REASON_MESSAGE[reason] };
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test -- catalog`
Expected: PASS (10 tests)

- [ ] **Step 6: 커밋**

```bash
git add src/lib/data/types.ts src/lib/data/catalog.ts src/lib/data/catalog.test.ts
git commit -m "feat: 도메인 타입과 상품 카탈로그 추가"
```

---

### Task 3: Yahoo Finance 응답 파서

**Files:**
- Create: `src/lib/data/sources/yahoo.ts`
- Create: `src/lib/data/sources/__fixtures__/yahoo-spy-sample.json`
- Test: `src/lib/data/sources/yahoo.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `type RawSeries = { symbol: string; dates: string[]; close: number[]; adjClose: number[] }`
  - `parseYahooChart(json: unknown): RawSeries`
  - `yahooChartUrl(symbol: string): string`

- [ ] **Step 1: 픽스처 파일 작성**

`src/lib/data/sources/__fixtures__/yahoo-spy-sample.json` — 실제 응답의 축소판이다. 타임스탬프는 UTC 자정 기준 거래일이다.

```json
{
  "chart": {
    "result": [
      {
        "meta": { "currency": "USD", "symbol": "SPY" },
        "timestamp": [727920000, 728006400, 728092800],
        "indicators": {
          "quote": [{ "close": [43.9375, 43.96875, 44.25] }],
          "adjclose": [{ "adjclose": [24.11, 24.13, 24.29] }]
        }
      }
    ],
    "error": null
  }
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`src/lib/data/sources/yahoo.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseYahooChart, yahooChartUrl } from './yahoo';
import fixture from './__fixtures__/yahoo-spy-sample.json';

describe('parseYahooChart', () => {
  it('타임스탬프를 ISO 날짜로 변환한다', () => {
    const s = parseYahooChart(fixture);
    expect(s.symbol).toBe('SPY');
    expect(s.dates).toEqual(['1993-01-25', '1993-01-26', '1993-01-27']);
  });

  it('close와 adjClose를 모두 보존한다', () => {
    const s = parseYahooChart(fixture);
    expect(s.close[0]).toBe(43.9375);
    expect(s.adjClose[0]).toBe(24.11);
  });

  it('null 값이 있는 행은 제외한다', () => {
    const withNull = {
      chart: {
        result: [{
          meta: { currency: 'USD', symbol: 'X' },
          timestamp: [727920000, 728006400],
          indicators: {
            quote: [{ close: [10, null] }],
            adjclose: [{ adjclose: [10, null] }],
          },
        }],
        error: null,
      },
    };
    const s = parseYahooChart(withNull);
    expect(s.dates).toHaveLength(1);
    expect(s.close).toEqual([10]);
  });

  it('결과가 비어 있으면 예외를 던진다', () => {
    expect(() => parseYahooChart({ chart: { result: [], error: null } }))
      .toThrow(/결과가 비어/);
  });

  it('스키마에 맞지 않으면 예외를 던진다', () => {
    expect(() => parseYahooChart({ nope: true })).toThrow();
  });
});

describe('yahooChartUrl', () => {
  it('특수문자가 포함된 심볼을 인코딩한다', () => {
    expect(yahooChartUrl('^NDX')).toContain('%5ENDX');
    expect(yahooChartUrl('133690.KS')).toContain('133690.KS');
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npm test -- yahoo`
Expected: FAIL — `Failed to resolve import "./yahoo"`

- [ ] **Step 4: 파서 구현**

`src/lib/data/sources/yahoo.ts`:

```typescript
import { z } from 'zod';

export type RawSeries = {
  symbol: string;
  dates: string[];
  close: number[];
  adjClose: number[];
};

const chartSchema = z.object({
  chart: z.object({
    result: z.array(
      z.object({
        meta: z.object({ symbol: z.string() }),
        timestamp: z.array(z.number()),
        indicators: z.object({
          quote: z.array(
            z.object({ close: z.array(z.number().nullable()) }),
          ),
          adjclose: z
            .array(z.object({ adjclose: z.array(z.number().nullable()) }))
            .optional(),
        }),
      }),
    ),
  }),
});

/** UNIX 초를 UTC 기준 YYYY-MM-DD로 변환한다. */
function toIsoDate(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toISOString().slice(0, 10);
}

export function yahooChartUrl(symbol: string): string {
  const encoded = encodeURIComponent(symbol);
  return (
    `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}` +
    `?period1=0&period2=9999999999&interval=1d&events=div%7Csplit`
  );
}

export function parseYahooChart(json: unknown): RawSeries {
  const parsed = chartSchema.parse(json);
  const [result] = parsed.chart.result;

  if (!result) throw new Error('Yahoo 응답의 결과가 비어 있습니다');

  const [quote] = result.indicators.quote;
  if (!quote) throw new Error('Yahoo 응답에 quote가 없습니다');

  // 지수 심볼은 adjclose가 없다. 이 경우 close를 총수익으로 간주한다.
  const adjRaw = result.indicators.adjclose?.[0]?.adjclose ?? quote.close;

  const dates: string[] = [];
  const close: number[] = [];
  const adjClose: number[] = [];

  for (let i = 0; i < result.timestamp.length; i += 1) {
    const c = quote.close[i];
    const a = adjRaw[i];
    if (c === null || c === undefined) continue;
    if (a === null || a === undefined) continue;

    dates.push(toIsoDate(result.timestamp[i]));
    close.push(c);
    adjClose.push(a);
  }

  return { symbol: result.meta.symbol, dates, close, adjClose };
}
```

- [ ] **Step 5: tsconfig에 JSON import 허용 확인**

`tsconfig.json`의 `compilerOptions`에 다음이 있는지 확인하고 없으면 추가한다:

```json
{
  "compilerOptions": {
    "resolveJsonModule": true
  }
}
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npm test -- yahoo`
Expected: PASS (6 tests)

- [ ] **Step 7: 커밋**

```bash
git add src/lib/data/sources/
git commit -m "feat: Yahoo Finance 응답 파서 추가"
```

---

### Task 4: 한국은행 ECOS 응답 파서

**Files:**
- Create: `src/lib/data/sources/ecos.ts`
- Create: `src/lib/data/sources/__fixtures__/ecos-fx-sample.json`
- Test: `src/lib/data/sources/ecos.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `type FxSeries = { dates: string[]; rates: number[] }`
  - `parseEcosResponse(json: unknown): FxSeries`
  - `ecosFxUrl(apiKey: string, start: string, end: string, startRow: number, endRow: number): string`
  - `ECOS_FX_STAT_CODE = '731Y001'`, `ECOS_FX_ITEM_CODE = '0000001'`

- [ ] **Step 1: 픽스처 파일 작성**

`src/lib/data/sources/__fixtures__/ecos-fx-sample.json` — 실제 응답 형태다.

```json
{
  "StatisticSearch": {
    "list_total_count": 3,
    "row": [
      {
        "STAT_CODE": "731Y001",
        "STAT_NAME": "3.1.1.1. 주요국 통화의 대원화환율",
        "ITEM_CODE1": "0000001",
        "ITEM_NAME1": "원/미국달러(매매기준율)",
        "UNIT_NAME": "원",
        "TIME": "19950103",
        "DATA_VALUE": "788.7"
      },
      {
        "STAT_CODE": "731Y001",
        "STAT_NAME": "3.1.1.1. 주요국 통화의 대원화환율",
        "ITEM_CODE1": "0000001",
        "ITEM_NAME1": "원/미국달러(매매기준율)",
        "UNIT_NAME": "원",
        "TIME": "19950104",
        "DATA_VALUE": "789.1"
      },
      {
        "STAT_CODE": "731Y001",
        "STAT_NAME": "3.1.1.1. 주요국 통화의 대원화환율",
        "ITEM_CODE1": "0000001",
        "ITEM_NAME1": "원/미국달러(매매기준율)",
        "UNIT_NAME": "원",
        "TIME": "19950105",
        "DATA_VALUE": "790.2"
      }
    ]
  }
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`src/lib/data/sources/ecos.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseEcosResponse, ecosFxUrl } from './ecos';
import fixture from './__fixtures__/ecos-fx-sample.json';

describe('parseEcosResponse', () => {
  it('YYYYMMDD를 ISO 날짜로 변환한다', () => {
    const s = parseEcosResponse(fixture);
    expect(s.dates).toEqual(['1995-01-03', '1995-01-04', '1995-01-05']);
  });

  it('문자열 환율을 숫자로 변환한다', () => {
    const s = parseEcosResponse(fixture);
    expect(s.rates).toEqual([788.7, 789.1, 790.2]);
  });

  it('오류 응답이면 메시지를 담아 예외를 던진다', () => {
    const err = {
      RESULT: { CODE: 'INFO-200', MESSAGE: '해당하는 데이터가 없습니다.' },
    };
    expect(() => parseEcosResponse(err)).toThrow(/해당하는 데이터가 없습니다/);
  });

  it('숫자로 변환할 수 없는 값은 제외한다', () => {
    const withBlank = {
      StatisticSearch: {
        list_total_count: 2,
        row: [
          { TIME: '19950103', DATA_VALUE: '788.7' },
          { TIME: '19950104', DATA_VALUE: '' },
        ],
      },
    };
    const s = parseEcosResponse(withBlank);
    expect(s.dates).toEqual(['1995-01-03']);
  });
});

describe('ecosFxUrl', () => {
  it('경로에 통계코드와 항목코드를 포함한다', () => {
    const url = ecosFxUrl('KEY', '1995-01-03', '1995-12-31', 1, 1000);
    expect(url).toContain('/KEY/');
    expect(url).toContain('/731Y001/D/19950103/19951231/0000001');
    expect(url).toContain('/1/1000/');
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npm test -- ecos`
Expected: FAIL — `Failed to resolve import "./ecos"`

- [ ] **Step 4: 파서 구현**

`src/lib/data/sources/ecos.ts`:

```typescript
import { z } from 'zod';

export type FxSeries = { dates: string[]; rates: number[] };

/** 3.1.1.1 주요국 통화의 대원화환율 */
export const ECOS_FX_STAT_CODE = '731Y001';
/** 원/미국달러(매매기준율) */
export const ECOS_FX_ITEM_CODE = '0000001';

const errorSchema = z.object({
  RESULT: z.object({ CODE: z.string(), MESSAGE: z.string() }),
});

const successSchema = z.object({
  StatisticSearch: z.object({
    list_total_count: z.number(),
    row: z.array(
      z.object({ TIME: z.string(), DATA_VALUE: z.string() }),
    ),
  }),
});

function compactToIso(yyyymmdd: string): string {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

function isoToCompact(iso: string): string {
  return iso.replaceAll('-', '');
}

export function ecosFxUrl(
  apiKey: string,
  start: string,
  end: string,
  startRow: number,
  endRow: number,
): string {
  return (
    `https://ecos.bok.or.kr/api/StatisticSearch/${apiKey}/json/kr` +
    `/${startRow}/${endRow}/${ECOS_FX_STAT_CODE}/D` +
    `/${isoToCompact(start)}/${isoToCompact(end)}/${ECOS_FX_ITEM_CODE}`
  );
}

export function parseEcosResponse(json: unknown): FxSeries {
  const asError = errorSchema.safeParse(json);
  if (asError.success) {
    const { CODE, MESSAGE } = asError.data.RESULT;
    throw new Error(`ECOS 오류 ${CODE}: ${MESSAGE}`);
  }

  const parsed = successSchema.parse(json);

  const dates: string[] = [];
  const rates: number[] = [];

  for (const row of parsed.StatisticSearch.row) {
    const value = Number(row.DATA_VALUE);
    if (!Number.isFinite(value)) continue;
    dates.push(compactToIso(row.TIME));
    rates.push(value);
  }

  return { dates, rates };
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test -- ecos`
Expected: PASS (5 tests)

- [ ] **Step 6: 커밋**

```bash
git add src/lib/data/sources/ecos.ts src/lib/data/sources/ecos.test.ts src/lib/data/sources/__fixtures__/ecos-fx-sample.json
git commit -m "feat: 한국은행 ECOS 환율 응답 파서 추가"
```

---

### Task 5: 원천 데이터 수집 스크립트

**Files:**
- Create: `scripts/fetch-raw.ts`
- Create: `src/lib/data/sources/symbols.ts`
- Test: `src/lib/data/sources/symbols.test.ts`
- Create: `.env.example`

**Interfaces:**
- Consumes: `PRODUCTS` (Task 2), `yahooChartUrl`/`parseYahooChart` (Task 3), `ecosFxUrl`/`parseEcosResponse` (Task 4)
- Produces:
  - `AXIS_SYMBOL = '^GSPC'` — 날짜 축의 기준 심볼. Task 10이 사용한다.
  - `REQUIRED_YAHOO_SYMBOLS: readonly string[]` — 상품 티커 + 백필 지수 + 축 심볼
  - `data/raw/yahoo/<safe-symbol>.json`, `data/raw/ecos/fx.json` 캐시 파일
  - `rawPathForSymbol(symbol: string): string`, `RAW_DIR`, `RAW_FX_PATH`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/data/sources/symbols.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { REQUIRED_YAHOO_SYMBOLS, rawPathForSymbol, AXIS_SYMBOL } from './symbols';

describe('REQUIRED_YAHOO_SYMBOLS', () => {
  it('모든 상품 티커를 포함한다', () => {
    expect(REQUIRED_YAHOO_SYMBOLS).toContain('QQQ');
    expect(REQUIRED_YAHOO_SYMBOLS).toContain('133690.KS');
  });

  it('백필 기준 지수를 포함한다', () => {
    expect(REQUIRED_YAHOO_SYMBOLS).toContain('^NDX');
    expect(REQUIRED_YAHOO_SYMBOLS).toContain('^SP500TR');
  });

  it('날짜 축 심볼을 포함한다 — 어떤 상품도 백필 지수로 쓰지 않으므로 명시 추가가 필요하다', () => {
    expect(REQUIRED_YAHOO_SYMBOLS).toContain(AXIS_SYMBOL);
    expect(AXIS_SYMBOL).toBe('^GSPC');
  });

  it('중복이 없다', () => {
    const set = new Set(REQUIRED_YAHOO_SYMBOLS);
    expect(set.size).toBe(REQUIRED_YAHOO_SYMBOLS.length);
  });
});

describe('rawPathForSymbol', () => {
  it('파일명에 쓸 수 없는 문자를 치환한다', () => {
    expect(rawPathForSymbol('^NDX')).toMatch(/_NDX\.json$/);
    expect(rawPathForSymbol('133690.KS')).toMatch(/133690_KS\.json$/);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- symbols`
Expected: FAIL — `Failed to resolve import "./symbols"`

- [ ] **Step 3: 심볼 목록 구현**

`src/lib/data/sources/symbols.ts`:

```typescript
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- symbols`
Expected: PASS (4 tests)

- [ ] **Step 5: 환경변수 예시 파일 작성**

`.env.example`:

```
# 한국은행 ECOS API 키 — https://ecos.bok.or.kr 에서 무료 발급
# 샘플 키('sample')는 10건 제한이라 실제 수집에 쓸 수 없다.
ECOS_API_KEY=
```

`.gitignore`에 `.env.local`이 포함돼 있는지 확인하고 없으면 추가한다.

- [ ] **Step 6: 수집 스크립트 작성**

`scripts/fetch-raw.ts`:

```typescript
import fs from 'node:fs/promises';
import path from 'node:path';
import { yahooChartUrl, parseYahooChart } from '../src/lib/data/sources/yahoo';
import { ecosFxUrl, parseEcosResponse } from '../src/lib/data/sources/ecos';
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
  const merged: { dates: string[]; rates: number[] } = { dates: [], rates: [] };

  // ECOS는 1회 요청 행수에 제한이 있어 연 단위로 나눠 받는다.
  const startYear = Number(FX_START.slice(0, 4));
  const endYear = Number(today.slice(0, 4));

  for (let year = startYear; year <= endYear; year += 1) {
    const url = ecosFxUrl(apiKey, `${year}-01-01`, `${year}-12-31`, 1, 400);
    const chunk = parseEcosResponse(await fetchJson(url));
    merged.dates.push(...chunk.dates);
    merged.rates.push(...chunk.rates);
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
```

- [ ] **Step 7: 실제 수집 실행**

ECOS API 키를 발급받아 `.env.local`에 넣은 뒤 실행한다.

```bash
echo "ECOS_API_KEY=발급받은키" > .env.local
set -a && source .env.local && set +a && npm run fetch-raw
```

Expected: 11개 심볼 + 환율이 `data/raw/`에 저장된다. `^NDX`가 1985년부터, 환율이 1994년부터 나오는지 확인한다.

- [ ] **Step 8: 커밋**

```bash
git add scripts/fetch-raw.ts src/lib/data/sources/symbols.ts \
  src/lib/data/sources/symbols.test.ts .env.example .gitignore
git commit -m "feat: 원천 데이터 수집 스크립트 추가"
```

---

### Task 6: 날짜 축 정렬과 환율 결합

**Files:**
- Create: `src/lib/data/align.ts`
- Test: `src/lib/data/align.test.ts`

**Interfaces:**
- Consumes: `RawSeries` (Task 3), `FxSeries` (Task 4)
- Produces:
  - `buildDateAxis(source: string[], startDate: string): string[]`
  - `alignToAxis(axis: string[], series: RawSeries, field: 'close' | 'adjClose'): Float64Array`
  - `alignFxToAxis(axis: string[], fx: FxSeries): Float64Array`
  - 정렬 실패 시 값은 `NaN`으로 채운다. 상장 이전 구간을 뜻한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/data/align.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildDateAxis, alignToAxis, alignFxToAxis } from './align';
import type { RawSeries } from './sources/yahoo';

const series: RawSeries = {
  symbol: 'X',
  dates: ['1995-01-03', '1995-01-04', '1995-01-06'],
  close: [10, 11, 12],
  adjClose: [5, 5.5, 6],
};

describe('buildDateAxis', () => {
  it('시작일 이전을 잘라낸다', () => {
    const axis = buildDateAxis(
      ['1994-12-30', '1995-01-03', '1995-01-04'],
      '1995-01-03',
    );
    expect(axis).toEqual(['1995-01-03', '1995-01-04']);
  });

  it('중복을 제거하고 오름차순으로 정렬한다', () => {
    const axis = buildDateAxis(
      ['1995-01-04', '1995-01-03', '1995-01-04'],
      '1995-01-01',
    );
    expect(axis).toEqual(['1995-01-03', '1995-01-04']);
  });
});

describe('alignToAxis', () => {
  it('축의 날짜에 해당하는 값을 채운다', () => {
    const axis = ['1995-01-03', '1995-01-04'];
    const out = alignToAxis(axis, series, 'adjClose');
    expect([...out]).toEqual([5, 5.5]);
  });

  it('데이터가 없는 날짜는 NaN이다', () => {
    const axis = ['1995-01-03', '1995-01-05'];
    const out = alignToAxis(axis, series, 'close');
    expect(out[0]).toBe(10);
    expect(Number.isNaN(out[1])).toBe(true);
  });
});

describe('alignFxToAxis', () => {
  const fx = {
    dates: ['1995-01-03', '1995-01-05'],
    rates: [788.7, 790.2],
  };

  it('정확히 일치하는 날짜는 그 값을 쓴다', () => {
    const out = alignFxToAxis(['1995-01-03'], fx);
    expect(out[0]).toBe(788.7);
  });

  it('휴장일은 직전 영업일 환율로 전진 채움한다', () => {
    const out = alignFxToAxis(['1995-01-04'], fx);
    expect(out[0]).toBe(788.7);
  });

  it('첫 환율보다 이른 날짜는 첫 환율로 채운다', () => {
    const out = alignFxToAxis(['1995-01-01'], fx);
    expect(out[0]).toBe(788.7);
  });

  it('마지막 환율 이후는 마지막 값을 유지한다', () => {
    const out = alignFxToAxis(['1995-01-09'], fx);
    expect(out[0]).toBe(790.2);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- align`
Expected: FAIL — `Failed to resolve import "./align"`

- [ ] **Step 3: 구현**

`src/lib/data/align.ts`:

```typescript
import type { RawSeries } from './sources/yahoo';
import type { FxSeries } from './sources/ecos';

/**
 * 정규 날짜 축을 만든다.
 * 미국 거래일을 기준으로 삼는다 — 대상 상품 대부분이 미국 상장이기 때문이다.
 */
export function buildDateAxis(source: string[], startDate: string): string[] {
  const unique = new Set(source.filter((d) => d >= startDate));
  return [...unique].sort();
}

export function alignToAxis(
  axis: string[],
  series: RawSeries,
  field: 'close' | 'adjClose',
): Float64Array {
  const values = field === 'close' ? series.close : series.adjClose;
  const lookup = new Map<string, number>();
  for (let i = 0; i < series.dates.length; i += 1) {
    lookup.set(series.dates[i], values[i]);
  }

  const out = new Float64Array(axis.length);
  for (let i = 0; i < axis.length; i += 1) {
    const value = lookup.get(axis[i]);
    out[i] = value === undefined ? Number.NaN : value;
  }
  return out;
}

/**
 * 환율을 축에 맞춘다.
 * 한국 영업일과 미국 거래일이 어긋나므로 직전 영업일 환율로 전진 채움한다.
 * 축의 첫 날짜가 환율 데이터보다 이르면 첫 환율을 사용한다.
 */
export function alignFxToAxis(axis: string[], fx: FxSeries): Float64Array {
  const out = new Float64Array(axis.length);
  if (fx.dates.length === 0) {
    out.fill(Number.NaN);
    return out;
  }

  let cursor = 0;
  let current = fx.rates[0];

  for (let i = 0; i < axis.length; i += 1) {
    while (cursor < fx.dates.length && fx.dates[cursor] <= axis[i]) {
      current = fx.rates[cursor];
      cursor += 1;
    }
    out[i] = current;
  }
  return out;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- align`
Expected: PASS (8 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/data/align.ts src/lib/data/align.test.ts
git commit -m "feat: 날짜 축 정렬과 환율 전진 채움 추가"
```

---

### Task 7: 레버리지 합성 엔진

**Files:**
- Create: `src/lib/data/synthetic.ts`
- Test: `src/lib/data/synthetic.test.ts`

**Interfaces:**
- Consumes: 없음 (순수 수치 계산)
- Produces:
  - `dailyReturns(values: Float64Array): Float64Array` — 길이 N, 첫 원소는 `NaN`
  - `synthesizeLeveraged(indexReturns: Float64Array, multiplier: number, annualDrag: number): Float64Array`
  - `TRADING_DAYS_PER_YEAR = 252`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/data/synthetic.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  dailyReturns,
  synthesizeLeveraged,
  TRADING_DAYS_PER_YEAR,
} from './synthetic';

describe('dailyReturns', () => {
  it('첫 원소는 NaN이다', () => {
    const r = dailyReturns(Float64Array.from([100, 110]));
    expect(Number.isNaN(r[0])).toBe(true);
  });

  it('일별 수익률을 계산한다', () => {
    const r = dailyReturns(Float64Array.from([100, 110, 99]));
    expect(r[1]).toBeCloseTo(0.1, 10);
    expect(r[2]).toBeCloseTo(-0.1, 10);
  });

  it('직전 값이 NaN이면 결과도 NaN이다', () => {
    const r = dailyReturns(Float64Array.from([Number.NaN, 110, 121]));
    expect(Number.isNaN(r[1])).toBe(true);
    expect(r[2]).toBeCloseTo(0.1, 10);
  });
});

describe('synthesizeLeveraged', () => {
  it('배율 1에 드래그 0이면 원본과 같다', () => {
    const idx = Float64Array.from([Number.NaN, 0.01, -0.02]);
    const out = synthesizeLeveraged(idx, 1, 0);
    expect(out[1]).toBeCloseTo(0.01, 12);
    expect(out[2]).toBeCloseTo(-0.02, 12);
  });

  it('배율을 곱한다', () => {
    const idx = Float64Array.from([Number.NaN, 0.01]);
    const out = synthesizeLeveraged(idx, 3, 0);
    expect(out[1]).toBeCloseTo(0.03, 12);
  });

  it('연간 드래그를 거래일수로 나눠 차감한다', () => {
    const idx = Float64Array.from([Number.NaN, 0]);
    const out = synthesizeLeveraged(idx, 2, 0.0252);
    expect(out[1]).toBeCloseTo(-0.0252 / TRADING_DAYS_PER_YEAR, 12);
  });

  it('변동성 끌림을 재현한다 — 지수는 제자리인데 3배는 손실이다', () => {
    // -10% 후 +11.11% = 지수 원위치
    const idx = Float64Array.from([Number.NaN, -0.1, 1 / 0.9 - 1]);
    const out = synthesizeLeveraged(idx, 3, 0);
    const cumulative = (1 + out[1]) * (1 + out[2]) - 1;
    expect(cumulative).toBeLessThan(-0.06);
    expect(cumulative).toBeGreaterThan(-0.07);
  });

  it('NaN 입력은 NaN을 유지한다', () => {
    const idx = Float64Array.from([Number.NaN, Number.NaN, 0.01]);
    const out = synthesizeLeveraged(idx, 2, 0.01);
    expect(Number.isNaN(out[1])).toBe(true);
    expect(Number.isNaN(out[2])).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- synthetic`
Expected: FAIL — `Failed to resolve import "./synthetic"`

- [ ] **Step 3: 구현**

`src/lib/data/synthetic.ts`:

```typescript
export const TRADING_DAYS_PER_YEAR = 252;

/** 가격 시계열을 일별 수익률로 변환한다. 첫 원소는 직전 값이 없으므로 NaN이다. */
export function dailyReturns(values: Float64Array): Float64Array {
  const out = new Float64Array(values.length);
  out[0] = Number.NaN;

  for (let i = 1; i < values.length; i += 1) {
    const prev = values[i - 1];
    const curr = values[i];
    out[i] = Number.isFinite(prev) && Number.isFinite(curr) && prev !== 0
      ? curr / prev - 1
      : Number.NaN;
  }
  return out;
}

/**
 * 레버리지 ETF의 일별 수익률을 합성한다.
 *
 * 레버리지는 일별 복리로 정의되므로 반드시 일별 해상도에서 계산해야 한다.
 * 월별로 계산하면 변동성 끌림이 사라져 결과가 근본적으로 틀린다.
 *
 * annualDrag는 차입비용 + 추적오차 − 배당수익률을 합친 순드래그로,
 * 골든 테스트(Task 9)가 상품별로 캘리브레이션한 값이다.
 */
export function synthesizeLeveraged(
  indexReturns: Float64Array,
  multiplier: number,
  annualDrag: number,
): Float64Array {
  const dailyDrag = annualDrag / TRADING_DAYS_PER_YEAR;
  const out = new Float64Array(indexReturns.length);

  for (let i = 0; i < indexReturns.length; i += 1) {
    const r = indexReturns[i];
    out[i] = Number.isFinite(r) ? multiplier * r - dailyDrag : Number.NaN;
  }
  return out;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- synthetic`
Expected: PASS (9 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/data/synthetic.ts src/lib/data/synthetic.test.ts
git commit -m "feat: 레버리지 합성 엔진 추가"
```

---

### Task 8: 백필 스플라이싱

**Files:**
- Create: `src/lib/data/splice.ts`
- Test: `src/lib/data/splice.test.ts`

**Interfaces:**
- Consumes: `dailyReturns`, `synthesizeLeveraged` (Task 7)
- Produces:
  - `type SplicedSeries = { values: Float64Array; syntheticBefore: number }`
  - `spliceBackfill(actual: Float64Array, syntheticReturns: Float64Array): SplicedSeries`
  - `syntheticBefore`는 합성 구간의 마지막 인덱스 + 1. 즉 실제 데이터 시작 인덱스다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/data/splice.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { spliceBackfill } from './splice';

const N = Number.NaN;

describe('spliceBackfill', () => {
  it('실제 데이터 구간은 그대로 보존한다', () => {
    const actual = Float64Array.from([N, N, 100, 110]);
    const synth = Float64Array.from([N, 0.05, 0.05, 0.05]);
    const { values } = spliceBackfill(actual, synth);
    expect(values[2]).toBe(100);
    expect(values[3]).toBe(110);
  });

  it('실제 시작점에서 역방향으로 합성 수익률을 되감는다', () => {
    // 인덱스 2에서 100. 인덱스 2의 합성 수익률이 +25%였다면 인덱스 1은 80이다.
    const actual = Float64Array.from([N, N, 100]);
    const synth = Float64Array.from([N, 0.25, 0.25]);
    const { values } = spliceBackfill(actual, synth);
    expect(values[1]).toBeCloseTo(80, 10);
  });

  it('여러 구간을 연쇄적으로 되감는다', () => {
    const actual = Float64Array.from([N, N, N, 100]);
    const synth = Float64Array.from([N, 0.1, 0.1, 0.1]);
    const { values } = spliceBackfill(actual, synth);
    expect(values[2]).toBeCloseTo(100 / 1.1, 10);
    expect(values[1]).toBeCloseTo(100 / 1.1 / 1.1, 10);
  });

  it('합성 구간의 경계 인덱스를 반환한다', () => {
    const actual = Float64Array.from([N, N, 100, 110]);
    const synth = Float64Array.from([N, 0.05, 0.05, 0.05]);
    const { syntheticBefore } = spliceBackfill(actual, synth);
    expect(syntheticBefore).toBe(2);
  });

  it('실제 데이터가 처음부터 있으면 합성 구간이 없다', () => {
    const actual = Float64Array.from([100, 110]);
    const synth = Float64Array.from([N, 0.05]);
    const { values, syntheticBefore } = spliceBackfill(actual, synth);
    expect(syntheticBefore).toBe(0);
    expect([...values]).toEqual([100, 110]);
  });

  it('실제 데이터가 전혀 없으면 예외를 던진다', () => {
    const actual = Float64Array.from([N, N]);
    const synth = Float64Array.from([N, 0.05]);
    expect(() => spliceBackfill(actual, synth)).toThrow(/실제 데이터가 없/);
  });

  it('되감기 도중 합성 수익률이 NaN이면 그 이전은 NaN이다', () => {
    const actual = Float64Array.from([N, N, N, 100]);
    const synth = Float64Array.from([N, 0.1, N, 0.1]);
    const { values } = spliceBackfill(actual, synth);
    expect(values[2]).toBeCloseTo(100 / 1.1, 10);
    expect(Number.isNaN(values[1])).toBe(true);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- splice`
Expected: FAIL — `Failed to resolve import "./splice"`

- [ ] **Step 3: 구현**

`src/lib/data/splice.ts`:

```typescript
export type SplicedSeries = {
  values: Float64Array;
  /** 실제 데이터가 시작되는 인덱스. 이 값보다 작은 인덱스는 합성 구간이다. */
  syntheticBefore: number;
};

/**
 * 실제 데이터의 시작점에 앵커를 두고 합성 수익률로 과거를 역산한다.
 *
 * 앞에서부터 합성값을 쌓아 올리면 실제 데이터와 이어지는 지점에서 단차가 생긴다.
 * 실제 시작점을 고정하고 뒤로 되감으면 이음매가 정확히 맞는다.
 */
export function spliceBackfill(
  actual: Float64Array,
  syntheticReturns: Float64Array,
): SplicedSeries {
  const firstReal = actual.findIndex((v) => Number.isFinite(v));
  if (firstReal === -1) {
    throw new Error('실제 데이터가 없어 백필 기준점을 잡을 수 없습니다');
  }

  const values = new Float64Array(actual.length);
  values.set(actual);

  for (let i = firstReal - 1; i >= 0; i -= 1) {
    const nextValue = values[i + 1];
    const nextReturn = syntheticReturns[i + 1];

    values[i] =
      Number.isFinite(nextValue) &&
      Number.isFinite(nextReturn) &&
      nextReturn !== -1
        ? nextValue / (1 + nextReturn)
        : Number.NaN;
  }

  return { values, syntheticBefore: firstReal };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- splice`
Expected: PASS (7 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/data/splice.ts src/lib/data/splice.test.ts
git commit -m "feat: 백필 스플라이싱 추가"
```

---

### Task 9: 골든 테스트 — 합성 정확도 검증과 드래그 캘리브레이션

**Files:**
- Create: `src/lib/data/calibrate.ts`
- Test: `src/lib/data/calibrate.test.ts`
- Test: `src/lib/data/golden.test.ts`
- Modify: `src/lib/data/catalog.ts` (캘리브레이션 결과로 `backfillDrag` 갱신)

**Interfaces:**
- Consumes: `dailyReturns`, `synthesizeLeveraged` (Task 7), `PRODUCTS` (Task 2), `alignToAxis`/`buildDateAxis` (Task 6), `parseYahooChart` (Task 3)
- Produces:
  - `cagr(values: Float64Array, tradingDays: number): number`
  - `compoundReturns(returns: Float64Array): number` — 누적 배수
  - `calibrateDrag(indexReturns, actualValues, multiplier): { drag: number; errorCagr: number }`

- [ ] **Step 1: 캘리브레이션 단위 테스트 작성**

`src/lib/data/calibrate.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { cagr, compoundReturns, calibrateDrag } from './calibrate';
import { synthesizeLeveraged, TRADING_DAYS_PER_YEAR } from './synthetic';

describe('cagr', () => {
  it('1년 만에 2배면 100%다', () => {
    const values = Float64Array.from([100, 200]);
    expect(cagr(values, TRADING_DAYS_PER_YEAR)).toBeCloseTo(1.0, 6);
  });

  it('제자리면 0%다', () => {
    expect(cagr(Float64Array.from([100, 100]), TRADING_DAYS_PER_YEAR))
      .toBeCloseTo(0, 10);
  });
});

describe('compoundReturns', () => {
  it('NaN을 건너뛰고 누적한다', () => {
    const r = Float64Array.from([Number.NaN, 0.1, 0.1]);
    expect(compoundReturns(r)).toBeCloseTo(1.21, 10);
  });
});

describe('calibrateDrag', () => {
  it('알고 있는 드래그를 역으로 찾아낸다', () => {
    const trueDrag = 0.0125;
    const idxReturns = new Float64Array(TRADING_DAYS_PER_YEAR * 5);
    idxReturns[0] = Number.NaN;
    for (let i = 1; i < idxReturns.length; i += 1) {
      // 결정적인 톱니 패턴 — 변동성이 있어야 의미 있는 검증이 된다
      idxReturns[i] = i % 2 === 0 ? 0.008 : -0.005;
    }

    const synth = synthesizeLeveraged(idxReturns, 2, trueDrag);
    const actual = new Float64Array(idxReturns.length);
    actual[0] = 100;
    for (let i = 1; i < actual.length; i += 1) {
      actual[i] = actual[i - 1] * (1 + synth[i]);
    }

    const { drag, errorCagr } = calibrateDrag(idxReturns, actual, 2);
    expect(drag).toBeCloseTo(trueDrag, 3);
    expect(Math.abs(errorCagr)).toBeLessThan(0.001);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- calibrate`
Expected: FAIL — `Failed to resolve import "./calibrate"`

- [ ] **Step 3: 구현**

`src/lib/data/calibrate.ts`:

```typescript
import { synthesizeLeveraged, TRADING_DAYS_PER_YEAR } from './synthetic';

/** 유효 구간의 연평균 성장률. tradingDays는 첫 값에서 마지막 값까지의 거래일 수다. */
export function cagr(values: Float64Array, tradingDays: number): number {
  const first = values[0];
  const last = values[values.length - 1];
  const years = tradingDays / TRADING_DAYS_PER_YEAR;
  if (!Number.isFinite(first) || !Number.isFinite(last) || first <= 0) {
    return Number.NaN;
  }
  return (last / first) ** (1 / years) - 1;
}

/** 일별 수익률을 누적 배수로 접는다. NaN은 건너뛴다. */
export function compoundReturns(returns: Float64Array): number {
  let acc = 1;
  for (let i = 0; i < returns.length; i += 1) {
    const r = returns[i];
    if (!Number.isFinite(r)) continue;
    acc *= 1 + r;
    if (acc <= 0) return 0;
  }
  return acc;
}

/**
 * 실제 ETF를 가장 잘 재현하는 연간 순드래그를 이분탐색으로 찾는다.
 *
 * 드래그가 커질수록 합성 CAGR은 단조 감소하므로 이분탐색이 수렴한다.
 * 반환하는 errorCagr는 합성 CAGR − 실제 CAGR이다.
 */
export function calibrateDrag(
  indexReturns: Float64Array,
  actualValues: Float64Array,
  multiplier: number,
): { drag: number; errorCagr: number } {
  const span = actualValues.length - 1;
  const targetCagr = cagr(actualValues, span);

  const syntheticCagr = (drag: number): number => {
    const synth = synthesizeLeveraged(indexReturns, multiplier, drag);
    const growth = compoundReturns(synth);
    if (growth <= 0) return Number.NEGATIVE_INFINITY;
    return growth ** (TRADING_DAYS_PER_YEAR / span) - 1;
  };

  let lo = -0.05; // 배당이 비용을 넘어서면 음수 드래그가 나올 수 있다
  let hi = 0.20;

  for (let i = 0; i < 80; i += 1) {
    const mid = (lo + hi) / 2;
    if (syntheticCagr(mid) > targetCagr) lo = mid;
    else hi = mid;
  }

  const drag = (lo + hi) / 2;
  return { drag, errorCagr: syntheticCagr(drag) - targetCagr };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- calibrate`
Expected: PASS (4 tests)

- [ ] **Step 5: 골든 테스트 작성**

`src/lib/data/golden.test.ts` — 이 테스트는 `data/raw/` 캐시를 필요로 한다. 캐시가 없으면 스킵한다.

```typescript
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { parseYahooChart } from './sources/yahoo';
import { rawPathForSymbol } from './sources/symbols';
import { PRODUCTS } from './catalog';
import { buildDateAxis, alignToAxis } from './align';
import { dailyReturns } from './synthetic';
import { calibrateDrag } from './calibrate';

/** 실제 상장 이후 구간에서만 검증한다. */
const BACKFILLABLE = PRODUCTS.filter((p) => p.backfillIndex !== null);

function loadSeries(symbol: string) {
  const path = rawPathForSymbol(symbol);
  if (!fs.existsSync(path)) return null;
  return parseYahooChart(JSON.parse(fs.readFileSync(path, 'utf-8')));
}

describe('합성 골든 테스트', () => {
  for (const product of BACKFILLABLE) {
    it(`${product.id}의 합성 오차가 연 1% 미만이다`, () => {
      const etf = loadSeries(product.ticker);
      const index = loadSeries(product.backfillIndex ?? '');

      if (!etf || !index) {
        // 원천 캐시가 없으면 검증할 수 없다. npm run fetch-raw 후 다시 실행한다.
        return;
      }

      // 두 시계열이 겹치는 구간만 사용한다
      const common = etf.dates.filter((d) => index.dates.includes(d));
      const axis = buildDateAxis(common, product.listedAt);
      expect(axis.length).toBeGreaterThan(250);

      const etfValues = alignToAxis(axis, etf, 'adjClose');
      const indexValues = alignToAxis(axis, index, 'adjClose');
      const indexReturns = dailyReturns(indexValues);

      const multiplier =
        product.leverage.kind === 'none' ? 1 : product.leverage.multiplier;

      const { drag, errorCagr } = calibrateDrag(
        indexReturns,
        etfValues,
        multiplier,
      );

      process.stdout.write(
        `  ${product.id.padEnd(6)} 최적드래그 ${(drag * 100).toFixed(2)}%  ` +
        `오차 ${(errorCagr * 100).toFixed(3)}%p  ` +
        `(카탈로그 ${(product.backfillDrag * 100).toFixed(2)}%)\n`,
      );

      expect(Math.abs(errorCagr)).toBeLessThan(0.01);

      // 카탈로그 값이 최적값에서 크게 벗어나지 않아야 한다
      expect(Math.abs(drag - product.backfillDrag)).toBeLessThan(0.01);
    });
  }
});
```

- [ ] **Step 6: 골든 테스트 실행 후 카탈로그 갱신**

Run: `npm test -- golden`

출력된 `최적드래그` 값을 읽고, `src/lib/data/catalog.ts`의 각 상품 `backfillDrag`를 그 값으로 갱신한다. 갱신 후 다시 실행해 통과하는지 확인한다.

Run: `npm test -- golden`
Expected: PASS — 모든 백필 대상 상품의 오차가 1% 미만

- [ ] **Step 7: 커밋**

```bash
git add src/lib/data/calibrate.ts src/lib/data/calibrate.test.ts \
  src/lib/data/golden.test.ts src/lib/data/catalog.ts
git commit -m "feat: 합성 골든 테스트와 드래그 캘리브레이션 추가"
```

---

### Task 10: 바이너리 직렬화와 빌드 통합

**Files:**
- Create: `src/lib/data/binary.ts`
- Create: `src/lib/data/build.ts`
- Create: `scripts/build-data.ts`
- Test: `src/lib/data/binary.test.ts`
- Test: `src/lib/data/build.test.ts`

**Interfaces:**
- Consumes: 앞의 모든 모듈
- Produces:
  - `encodeSeries(values: Float64Array): Buffer`
  - `decodeSeries(buffer: ArrayBufferLike): Float32Array`
  - `type ProductMeta`, `type DataManifest`
  - `buildProductSeries(input: BuildInput): BuildOutput`
  - 산출물 `public/data/<id>.bin`, `public/data/meta.json`

- [ ] **Step 1: 직렬화 테스트 작성**

`src/lib/data/binary.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { encodeSeries, decodeSeries } from './binary';

describe('encodeSeries / decodeSeries', () => {
  it('왕복 후 f32 정밀도 내에서 값이 보존된다', () => {
    const input = Float64Array.from([1.5, 2.25, 1000.125]);
    const decoded = decodeSeries(encodeSeries(input));
    expect(decoded[0]).toBeCloseTo(1.5, 5);
    expect(decoded[2]).toBeCloseTo(1000.125, 3);
  });

  it('값당 4바이트를 사용한다', () => {
    const buffer = encodeSeries(new Float64Array(100));
    expect(buffer.byteLength).toBe(400);
  });

  it('NaN을 보존한다 — 합성 불가 구간을 뜻한다', () => {
    const decoded = decodeSeries(encodeSeries(Float64Array.from([Number.NaN, 1])));
    expect(Number.isNaN(decoded[0])).toBe(true);
    expect(decoded[1]).toBe(1);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- binary`
Expected: FAIL — `Failed to resolve import "./binary"`

- [ ] **Step 3: 직렬화 구현**

`src/lib/data/binary.ts`:

```typescript
/** 계산은 f64로 하고 저장만 f32로 줄인다. JSON 대비 약 1/5 크기다. */
export function encodeSeries(values: Float64Array): Buffer {
  const f32 = Float32Array.from(values);
  return Buffer.from(f32.buffer, f32.byteOffset, f32.byteLength);
}

export function decodeSeries(buffer: ArrayBufferLike): Float32Array {
  return new Float32Array(buffer);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- binary`
Expected: PASS (3 tests)

- [ ] **Step 5: 빌드 로직 테스트 작성**

`src/lib/data/build.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildProductSeries } from './build';
import type { Product } from './types';

const N = Number.NaN;

const baseProduct: Product = {
  id: 'TEST',
  ticker: 'TEST',
  displayName: '테스트',
  exposure: 'NASDAQ100_2X',
  market: 'US',
  listedAt: '1995-01-05',
  expenseRatio: 0.0095,
  leverage: { kind: 'usListed', multiplier: 2 },
  hedged: false,
  backfillIndex: '^NDX',
  backfillDrag: 0,
};

const axis = ['1995-01-03', '1995-01-04', '1995-01-05', '1995-01-06'];

describe('buildProductSeries', () => {
  it('미국 상품은 환율을 곱해 원화로 환산한다', () => {
    const out = buildProductSeries({
      product: { ...baseProduct, backfillIndex: null, listedAt: '1995-01-03' },
      axis,
      actualUsd: Float64Array.from([10, 10, 10, 10]),
      indexValues: null,
      fxRates: Float64Array.from([800, 800, 900, 900]),
    });
    expect(out.krwValues[0]).toBeCloseTo(8000, 6);
    expect(out.krwValues[2]).toBeCloseTo(9000, 6);
  });

  it('국내 상품은 환율을 곱하지 않는다', () => {
    const out = buildProductSeries({
      product: {
        ...baseProduct,
        market: 'KR',
        backfillIndex: null,
        listedAt: '1995-01-03',
      },
      axis,
      actualUsd: Float64Array.from([10, 10, 10, 10]),
      indexValues: null,
      fxRates: Float64Array.from([800, 800, 900, 900]),
    });
    expect(out.krwValues[0]).toBeCloseTo(10, 6);
  });

  it('백필 대상이면 상장 이전 구간을 채운다', () => {
    const out = buildProductSeries({
      product: baseProduct,
      axis,
      actualUsd: Float64Array.from([N, N, 100, 110]),
      indexValues: Float64Array.from([100, 100, 100, 100]),
      fxRates: Float64Array.from([1, 1, 1, 1]),
    });
    // 지수가 제자리이고 드래그가 0이므로 합성 수익률도 0 → 되감아도 100
    expect(out.krwValues[0]).toBeCloseTo(100, 6);
    expect(out.meta.syntheticUntil).toBe('1995-01-04');
  });

  it('백필하지 않으면 상장 이전은 NaN으로 남는다', () => {
    const out = buildProductSeries({
      product: { ...baseProduct, backfillIndex: null },
      axis,
      actualUsd: Float64Array.from([N, N, 100, 110]),
      indexValues: null,
      fxRates: Float64Array.from([1, 1, 1, 1]),
    });
    expect(Number.isNaN(out.krwValues[0])).toBe(true);
    expect(out.meta.syntheticUntil).toBeNull();
    expect(out.meta.availableFrom).toBe('1995-01-05');
  });

  it('백필 대상인데 지수가 없으면 예외를 던진다', () => {
    expect(() =>
      buildProductSeries({
        product: baseProduct,
        axis,
        actualUsd: Float64Array.from([N, N, 100, 110]),
        indexValues: null,
        fxRates: Float64Array.from([1, 1, 1, 1]),
      }),
    ).toThrow(/기준 지수/);
  });
});
```

- [ ] **Step 6: 테스트 실패 확인**

Run: `npm test -- build`
Expected: FAIL — `Failed to resolve import "./build"`

- [ ] **Step 7: 빌드 로직 구현**

`src/lib/data/build.ts`:

```typescript
import type { Product } from './types';
import { dailyReturns, synthesizeLeveraged } from './synthetic';
import { spliceBackfill } from './splice';

export type ProductMeta = {
  id: string;
  ticker: string;
  displayName: string;
  exposure: string;
  market: string;
  listedAt: string;
  expenseRatio: number;
  /** 유효한 값이 시작되는 날짜 */
  availableFrom: string;
  /** 합성 구간의 마지막 날짜. 백필하지 않았으면 null */
  syntheticUntil: string | null;
  length: number;
};

export type DataManifest = {
  formatVersion: number;
  generatedAt: string;
  startDate: string;
  dates: string[];
  products: ProductMeta[];
};

export type BuildInput = {
  product: Product;
  axis: string[];
  /** 상품의 원통화 총수익 시계열. 상장 이전은 NaN */
  actualUsd: Float64Array;
  /** 백필 기준 지수 시계열. 백필하지 않으면 null */
  indexValues: Float64Array | null;
  fxRates: Float64Array;
};

export type BuildOutput = {
  krwValues: Float64Array;
  meta: ProductMeta;
};

export function buildProductSeries(input: BuildInput): BuildOutput {
  const { product, axis, actualUsd, indexValues, fxRates } = input;

  let values = actualUsd;
  let syntheticBefore = 0;

  if (product.backfillIndex !== null) {
    if (indexValues === null) {
      throw new Error(
        `${product.id}는 백필 대상인데 기준 지수 데이터가 없습니다`,
      );
    }
    const multiplier =
      product.leverage.kind === 'none' ? 1 : product.leverage.multiplier;
    const syntheticReturns = synthesizeLeveraged(
      dailyReturns(indexValues),
      multiplier,
      product.backfillDrag,
    );
    const spliced = spliceBackfill(actualUsd, syntheticReturns);
    values = spliced.values;
    syntheticBefore = spliced.syntheticBefore;
  }

  // 국내 상장 상품은 이미 원화 표시라 환산하지 않는다
  const krwValues = new Float64Array(values.length);
  for (let i = 0; i < values.length; i += 1) {
    krwValues[i] =
      product.market === 'US' ? values[i] * fxRates[i] : values[i];
  }

  const firstValid = krwValues.findIndex((v) => Number.isFinite(v));

  return {
    krwValues,
    meta: {
      id: product.id,
      ticker: product.ticker,
      displayName: product.displayName,
      exposure: product.exposure,
      market: product.market,
      listedAt: product.listedAt,
      expenseRatio: product.expenseRatio,
      availableFrom: firstValid === -1 ? axis[axis.length - 1] : axis[firstValid],
      syntheticUntil: syntheticBefore > 0 ? axis[syntheticBefore - 1] : null,
      length: krwValues.length,
    },
  };
}
```

- [ ] **Step 8: 테스트 통과 확인**

Run: `npm test -- build`
Expected: PASS (5 tests)

- [ ] **Step 9: 빌드 스크립트 작성**

`scripts/build-data.ts`:

```typescript
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { parseYahooChart } from '../src/lib/data/sources/yahoo';
import {
  rawPathForSymbol,
  RAW_FX_PATH,
  AXIS_SYMBOL,
} from '../src/lib/data/sources/symbols';
import { PRODUCTS, BACKFILL_START } from '../src/lib/data/catalog';
import { buildDateAxis, alignToAxis, alignFxToAxis } from '../src/lib/data/align';
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

async function main(): Promise<void> {
  await fs.mkdir(OUT_DIR, { recursive: true });

  // 축은 S&P500 지수 기준이다 — 미국 거래일 커버리지가 가장 길다
  const axisSource = loadRaw(AXIS_SYMBOL);
  const axis = buildDateAxis(axisSource.dates, BACKFILL_START);
  log(`날짜 축 ${axis.length}일  ${axis[0]} ~ ${axis[axis.length - 1]}`);

  const fxRaw: { dates: string[]; rates: number[] } = JSON.parse(
    fsSync.readFileSync(RAW_FX_PATH, 'utf-8'),
  );
  const fxRates = alignFxToAxis(axis, fxRaw);

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

  const manifest: DataManifest = {
    formatVersion: DATA_FORMAT_VERSION,
    generatedAt: new Date().toISOString(),
    startDate: BACKFILL_START,
    dates: axis,
    products: metas,
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
```

- [ ] **Step 10: 전체 빌드 실행**

```bash
npm run build-data
```

Expected: `public/data/`에 11개 `.bin`과 `meta.json`이 생성된다. 로그에서 다음을 확인한다.
- 날짜 축이 1995-01-03부터 시작
- QLD·TQQQ·SSO·SPXL의 `availableFrom`이 1995-01-03 (백필 성공)
- SCHD의 `availableFrom`이 2011-10-20, 합성구간 `없음`
- 국내 상장 4종의 합성구간이 전부 `없음`

- [ ] **Step 11: 산출물 크기 확인**

```bash
ls -la public/data/ && du -sh public/data/
```

Expected: 종목당 약 32KB, 전체 400KB 이하

- [ ] **Step 12: 전체 테스트 실행**

Run: `npm test`
Expected: PASS — 모든 테스트 통과

- [ ] **Step 13: 커밋**

```bash
git add src/lib/data/binary.ts src/lib/data/binary.test.ts \
  src/lib/data/build.ts src/lib/data/build.test.ts scripts/build-data.ts
git commit -m "feat: 바이너리 직렬화와 데이터 빌드 파이프라인 통합"
```

---

## 완료 기준

- [ ] `npm test`가 전부 통과한다
- [ ] `npm run fetch-raw && npm run build-data`가 `public/data/`를 생성한다
- [ ] 골든 테스트에서 QLD·TQQQ·SSO·SPXL의 연환산 오차가 1% 미만이다
- [ ] `meta.json`의 `dates[0]`가 `1995-01-03`이다
- [ ] 국내 상장 4종과 SCHD의 `syntheticUntil`이 `null`이다
- [ ] `public/data/` 전체가 400KB 이하다
