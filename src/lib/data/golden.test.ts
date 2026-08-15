import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { parseYahooChart } from './sources/yahoo';
import { rawPathForSymbol, RATE_SYMBOL } from './sources/symbols';
import { PRODUCTS } from './catalog';
import { buildDateAxis, alignToAxis } from './align';
import { dailyReturns } from './synthetic';
import { calibrateSpread, validateOutOfSample } from './calibrate';

/** 실제 상장 이후 구간에서만 검증한다. */
const BACKFILLABLE = PRODUCTS.filter((p) => p.backfillIndex !== null);

function loadSeries(symbol: string) {
  const path = rawPathForSymbol(symbol);
  if (!fs.existsSync(path)) return null;
  return parseYahooChart(JSON.parse(fs.readFileSync(path, 'utf-8')));
}

describe('합성 골든 테스트', () => {
  for (const product of BACKFILLABLE) {
    it(`${product.id}의 표본 외 오차가 연 3% 미만이다`, () => {
      const etf = loadSeries(product.ticker);
      const index = loadSeries(product.backfillIndex ?? '');
      const rate = loadSeries(RATE_SYMBOL);

      if (!etf || !index || !rate) {
        // 원천 캐시가 없으면 검증할 수 없다. npm run fetch-raw 후 다시 실행한다.
        return;
      }

      // 두 시계열이 겹치는 구간만 사용한다.
      // index.dates가 최대 14,000개, etf.dates가 최대 8,000개라
      // 배열 includes로 필터링하면 O(n*m)이 되어 매우 느리다. Set으로 O(n)에 처리한다.
      const indexDateSet = new Set(index.dates);
      const common = etf.dates.filter((d) => indexDateSet.has(d));
      const axis = buildDateAxis(common, product.listedAt);
      expect(axis.length).toBeGreaterThan(250);

      const etfValues = alignToAxis(axis, etf, 'adjClose');
      const indexValues = alignToAxis(axis, index, 'adjClose');
      const indexReturns = dailyReturns(indexValues);

      // ^IRX(13주 국채 수익률)는 연율 퍼센트 단위로 온다(예: 3.70 = 3.70%).
      // 계산에 쓰려면 100으로 나눠 소수 비율로 바꿔야 한다.
      const rateValues = alignToAxis(axis, rate, 'adjClose');
      const riskFreeRates = new Float64Array(rateValues.length);
      for (let i = 0; i < rateValues.length; i += 1) {
        riskFreeRates[i] = rateValues[i] / 100;
      }

      const multiplier =
        product.leverage.kind === 'none' ? 1 : product.leverage.multiplier;

      const { spread } = calibrateSpread(
        indexReturns,
        riskFreeRates,
        etfValues,
        multiplier,
      );

      // calibrateSpread는 정의상 전 구간 오차를 0으로 만들도록 역산하므로
      // 그 자체는 검증이 아니라 피팅 결과다. 진짜 검증은 전반부에서 구한
      // 스프레드가 후반부(표본 외, 금리 체제가 달라질 수 있는 구간)에서도
      // 통하는가다.
      const { holdoutErrorCagr } = validateOutOfSample(
        indexReturns,
        riskFreeRates,
        etfValues,
        multiplier,
      );

      process.stdout.write(
        `  ${product.id.padEnd(6)} 스프레드 ${(spread * 100).toFixed(2)}%  ` +
        `표본외오차 ${(holdoutErrorCagr * 100).toFixed(3)}%p  ` +
        `(카탈로그 ${(product.backfillSpread * 100).toFixed(2)}%)\n`,
      );

      // 임계값 3%. 금리 연동 모델(차입비용 = (배율−1)×금리)을 적용한 뒤에도
      // 표본 외 오차가 이 값을 넘으면 공식 자체를 재검토해야 한다는 뜻이다.
      // 임계값을 올려 억지로 통과시키지 않는다 — 초과 자체가 유의미한 정보다.
      expect(Math.abs(holdoutErrorCagr)).toBeLessThan(0.03);

      // 카탈로그 값이 최적값에서 크게 벗어나지 않아야 한다 (회귀 핀)
      expect(Math.abs(spread - product.backfillSpread)).toBeLessThan(0.01);
    });
  }
});
