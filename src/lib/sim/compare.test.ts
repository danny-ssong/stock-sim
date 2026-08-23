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
    // 백테스트는 데이터셋의 실제 날짜를 걷는다 — 미래 모드로 강제됐다면 원장 첫 줄이
    // startMonth(2010-01)가 아니라 오늘 이후 날짜로 나온다.
    expect(outcome.result.ledger.entries[0].date < '2011-01-01').toBe(true);
  });
});
