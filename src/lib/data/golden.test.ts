import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { parseYahooChart } from './sources/yahoo';
import { rawPathForSymbol, RATE_SYMBOL } from './sources/symbols';
import { PRODUCTS } from './catalog';
import { buildDateAxis, alignToAxis } from './align';
import { dailyReturns, synthesizeLeveragedWithRates } from './synthetic';
import { calibrateSpread, validateOutOfSample, stdev } from './calibrate';

/** 실제 상장 이후 구간에서만 검증한다. */
const BACKFILLABLE = PRODUCTS.filter((p) => p.backfillIndex !== null);

function loadSeries(symbol: string) {
  const path = rawPathForSymbol(symbol);
  if (!fs.existsSync(path)) return null;
  return parseYahooChart(JSON.parse(fs.readFileSync(path, 'utf-8')));
}

describe('합성 골든 테스트', () => {
  for (const product of BACKFILLABLE) {
    // 원천 캐시(data/raw/, .gitignore 대상)가 없으면 `return`으로 조용히
    // "통과"시키지 않는다. it.skipIf로 스킵 여부를 vitest 출력에 명시적으로 드러낸다 —
    // 신규 클론·CI에서 이 테스트들이 전부 초록으로 끝나는 것과 "스킵됨"이 보이는 것은
    // 완전히 다른 신호다.
    const cacheReady =
      fs.existsSync(rawPathForSymbol(product.ticker)) &&
      fs.existsSync(rawPathForSymbol(product.backfillIndex ?? '')) &&
      fs.existsSync(rawPathForSymbol(RATE_SYMBOL));

    it.skipIf(!cacheReady)(`${product.id}의 표본 외 오차가 3% 미만이다`, () => {
      const etf = loadSeries(product.ticker);
      const index = loadSeries(product.backfillIndex ?? '');
      const rate = loadSeries(RATE_SYMBOL);

      if (!etf || !index || !rate) {
        // cacheReady가 참이라 이 경로는 원천 파일이 손상된 경우에만 도달한다.
        // 조용히 통과시키지 않고 실패시켜 원인을 드러낸다.
        throw new Error(`${product.id}: 캐시 존재를 확인했지만 파싱에 실패했다`);
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
      const { calibrationSpread, holdoutErrorCagr } = validateOutOfSample(
        indexReturns,
        riskFreeRates,
        etfValues,
        multiplier,
      );

      // 표본 외 구간의 변동성 비율 — 배율 오기입을 잡아낸다.
      // CAGR 게이트는 배율을 3→2로 잘못 넣어도 통과할 만큼 판별력이 약하지만,
      // 변동성은 배율에 훨씬 민감하게 반응한다(배율이 3→2면 비율이 약 0.67로 떨어진다).
      // validateOutOfSample과 같은 분할 지점(mid)을 그대로 재현해 앞에서 구한
      // 스프레드로 합성한 표본 외 수익률과, 실제 표본 외 수익률의 표준편차를 비교한다.
      const mid = Math.floor(etfValues.length / 2);
      const holdoutIndexReturns = indexReturns.slice(mid + 1);
      const holdoutRates = riskFreeRates.slice(mid + 1);
      const holdoutActual = etfValues.slice(mid);

      const syntheticHoldoutReturns = synthesizeLeveragedWithRates(
        holdoutIndexReturns,
        holdoutRates,
        multiplier,
        calibrationSpread,
      );
      const actualHoldoutReturns = dailyReturns(holdoutActual);
      const volRatio =
        stdev(syntheticHoldoutReturns) / stdev(actualHoldoutReturns);

      process.stdout.write(
        `  ${product.id.padEnd(6)} 스프레드 ${(spread * 100).toFixed(2)}%  ` +
        `표본외오차 ${(holdoutErrorCagr * 100).toFixed(3)}%p  ` +
        `변동성비율 ${volRatio.toFixed(3)}  ` +
        `(카탈로그 ${(product.backfillSpread * 100).toFixed(2)}%)\n`,
      );

      // 임계값 3%. 금리 연동 모델(차입비용 = (배율−1)×금리)을 적용한 뒤에도
      // 표본 외 오차가 이 값을 넘으면 공식 자체를 재검토해야 한다는 뜻이다.
      // 임계값을 올려 억지로 통과시키지 않는다 — 초과 자체가 유의미한 정보다.
      expect(Math.abs(holdoutErrorCagr)).toBeLessThan(0.03);

      // 변동성 비율은 0.9~1.1 안에 있어야 한다. CAGR 게이트만으로는 배율
      // 오기입(예: 3배 상품에 2배를 넣음)을 잡아내지 못하므로 별도로 둔다.
      expect(volRatio).toBeGreaterThan(0.9);
      expect(volRatio).toBeLessThan(1.1);

      // 카탈로그 값이 최적값에서 크게 벗어나지 않아야 한다 (회귀 핀).
      // 이 핀은 같은 원천 데이터에 같은 결정적 알고리즘을 돌린 결과와 카탈로그
      // 상수를 비교하므로, 정상 상태라면 차이가 사실상 0이어야 한다. 0.002는
      // QLD의 backfillSpread(-0.0012)보다 절댓값이 커서 카탈로그를 0으로
      // 되돌려도 통과하는 문제가 있었다 — 0.0005로 좁힌다.
      expect(Math.abs(spread - product.backfillSpread)).toBeLessThan(0.0005);
    });
  }
});
