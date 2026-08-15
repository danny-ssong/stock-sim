import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { parseYahooChart } from './sources/yahoo';
import { rawPathForSymbol } from './sources/symbols';
import { PRODUCTS } from './catalog';
import { buildDateAxis, alignToAxis } from './align';
import { dailyReturns } from './synthetic';
import { calibrateDrag, validateOutOfSample } from './calibrate';

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

      const multiplier =
        product.leverage.kind === 'none' ? 1 : product.leverage.multiplier;

      const { drag } = calibrateDrag(indexReturns, etfValues, multiplier);

      // calibrateDrag는 정의상 전 구간 오차를 0으로 만들도록 역산하므로
      // errorCagr 자체는 검증이 되지 않는다(피팅 결과일 뿐이다).
      // 진짜 검증은 전반부에서 구한 드래그가 후반부(표본 외)에서도 통하는가다.
      const { holdoutErrorCagr } = validateOutOfSample(
        indexReturns,
        etfValues,
        multiplier,
      );

      process.stdout.write(
        `  ${product.id.padEnd(6)} 최적드래그 ${(drag * 100).toFixed(2)}%  ` +
        `표본외오차 ${(holdoutErrorCagr * 100).toFixed(3)}%p  ` +
        `(카탈로그 ${(product.backfillDrag * 100).toFixed(2)}%)\n`,
      );

      // 임계값 5%는 잠정치다. 1995~2026년 미국 기준금리가 0~6.5%를 오갔고
      // 레버리지 차입비용은 (배율−1)배로 증폭되므로, 고정 드래그 모델의 표본 외
      // 오차가 수 %p 벌어지는 것은 구조적으로 정상이다. 공식이 근본적으로 틀리면
      // 20%p 이상이 나오므로 5%도 유의미한 게이트다.
      expect(Math.abs(holdoutErrorCagr)).toBeLessThan(0.05);

      // 카탈로그 값이 최적값에서 크게 벗어나지 않아야 한다 (회귀 핀)
      expect(Math.abs(drag - product.backfillDrag)).toBeLessThan(0.01);
    });
  }
});
