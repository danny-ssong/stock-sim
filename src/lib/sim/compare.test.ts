import { describe, it, expect } from 'vitest';
import { runExposure } from './compare';
import { makeDataset, baseInputWithoutExposure } from './__fixtures__/simulation';

/** 계좌가 하나뿐이라 비교 단위는 노출뿐이다 — QQQ/TQQQ 두 상품을 담는다. */
const DATASET = makeDataset({ days: 6000, dailyReturn: 0.0003, productIds: ['QQQ', 'TQQQ'] });

const BASE = baseInputWithoutExposure({ startMonth: '2026-01', years: 1 });

describe('runExposure', () => {
  it('노출만 바꿔 실행하고 어떤 노출의 결과인지 함께 낸다', () => {
    const outcome = runExposure(BASE, 'NASDAQ100_3X', DATASET);
    expect(outcome.kind).toBe('ready');
    if (outcome.kind !== 'ready') return;
    expect(outcome.exposure).toBe('NASDAQ100_3X');
    expect(outcome.result.ledger.entries[0].productId).toBe('TQQQ');
  });

  it('base.mode를 덮어쓰지 않는다 — 과거 검증에서도 같은 함수로 비교한다', () => {
    const outcome = runExposure(
      { ...BASE, mode: 'backtest', startMonth: '2010-01' },
      'NASDAQ100_1X',
      DATASET,
    );
    expect(outcome.kind).toBe('ready');
    if (outcome.kind !== 'ready') return;

    // 원장 첫 줄의 날짜로는 판별할 수 없다 — buildFutureCalendar도 startMonth를
    // 그대로 쓰고 fixture는 공휴일 없는 평일 축이라, 두 모드의 첫 매수일이 같다.
    // 대신 백테스트 분기에서만 나오는 경고를 본다: engine은 calendar.mode가
    // 'backtest'일 때만 RETURN_SOURCE_IGNORED를 낸다. mode가 'future'로 강제되면
    // 이 경고가 사라지므로 이 단정이 실제로 회귀를 잡는다.
    expect(outcome.result.warnings.some((w) => w.code === 'RETURN_SOURCE_IGNORED')).toBe(true);
  });
});
