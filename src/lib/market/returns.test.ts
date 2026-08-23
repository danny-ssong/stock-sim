import { describe, it, expect } from 'vitest';
import {
  resolvePathIndices,
  buildConstantReturns,
  tileReturns,
  describePathAssumption,
} from './returns';

/** 2020-01-01부터 평일만 뽑은 가짜 축 — 인덱스 계산만 검증하면 되므로 충분하다 */
function makeDates(count: number): string[] {
  const dates: string[] = [];
  const cursor = new Date(Date.UTC(2020, 0, 1));
  while (dates.length < count) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) {
      dates.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

const DATES = makeDates(1000);

describe('resolvePathIndices', () => {
  it('참조 구간의 수익률 인덱스를 순서대로 낸다', () => {
    const result = resolvePathIndices({
      from: DATES[10],
      to: DATES[19],
      dates: DATES,
      availableFrom: DATES[0],
      productId: 'QQQ',
      totalDays: 5,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 수익률은 직전 값이 필요하므로 from의 다음 날부터 시작한다
    expect(Array.from(result.indices)).toEqual([11, 12, 13, 14, 15]);
  });

  it('시뮬이 참조 구간보다 길면 처음부터 다시 순환한다', () => {
    const result = resolvePathIndices({
      from: DATES[10],
      to: DATES[13],
      dates: DATES,
      availableFrom: DATES[0],
      productId: 'QQQ',
      totalDays: 8,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 참조 수익률 인덱스는 11,12,13 세 개 → 8일이면 2.67회 반복
    expect(Array.from(result.indices)).toEqual([11, 12, 13, 11, 12, 13, 11, 12]);
    expect(result.reference.tradingDays).toBe(3);
    expect(result.reference.repeats).toBeCloseTo(8 / 3, 6);
  });

  it('인덱스가 절대 0이 되지 않는다 — 0번 수익률은 항상 NaN이다', () => {
    const result = resolvePathIndices({
      from: DATES[0],
      to: DATES[5],
      dates: DATES,
      availableFrom: DATES[0],
      productId: 'QQQ',
      totalDays: 20,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Math.min(...Array.from(result.indices))).toBeGreaterThanOrEqual(1);
  });

  it('참조 구간이 상장일보다 이르면 거부하고 CAGR 전환을 제안한다', () => {
    const result = resolvePathIndices({
      from: DATES[10],
      to: DATES[500],
      dates: DATES,
      availableFrom: DATES[300],
      productId: 'TIGER_NASDAQ100_2X',
      totalDays: 100,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('BEFORE_LISTING');
    expect(result.availableFrom).toBe(DATES[300]);
    expect(result.suggestion.type).toBe('constantCagr');
    expect(result.message).toContain('TIGER_NASDAQ100_2X');
  });

  it('참조 구간이 상장일과 정확히 같으면 허용한다', () => {
    const result = resolvePathIndices({
      from: DATES[300],
      to: DATES[500],
      dates: DATES,
      availableFrom: DATES[300],
      productId: 'SCHD',
      totalDays: 100,
    });
    expect(result.ok).toBe(true);
  });

  it('참조 구간에 거래일이 2일 미만이면 거부한다 — 상장일 미달과 구분되는 사유다', () => {
    const result = resolvePathIndices({
      from: DATES[10],
      to: DATES[10],
      dates: DATES,
      availableFrom: DATES[0],
      productId: 'QQQ',
      totalDays: 100,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    // from >= availableFrom이므로 상장일 미달이 아니라 참조 구간 자체가 짧은 것이다
    expect(result.reason).toBe('REFERENCE_TOO_SHORT');
    expect(result.suggestion.type).toBe('constantCagr');
  });
});

describe('buildConstantReturns', () => {
  it('연 X%가 정확히 X%로 복리 누적된다', () => {
    const returns = buildConstantReturns(0.1, 252, 252);
    let compounded = 1;
    for (const r of returns) compounded *= 1 + r;
    expect(compounded).toBeCloseTo(1.1, 10);
  });

  it('축 길이가 261일이면 261일 기준으로 나눈다 (계획 D4)', () => {
    const returns = buildConstantReturns(0.1, 261, 261);
    let compounded = 1;
    for (const r of returns) compounded *= 1 + r;
    expect(compounded).toBeCloseTo(1.1, 10);
  });

  it('모든 원소가 같다 — 직선은 "같은 값 배열"의 특수 케이스다', () => {
    const returns = buildConstantReturns(0.08, 10, 252);
    expect(new Set(Array.from(returns)).size).toBe(1);
  });

  it('음수 수익률도 다룬다', () => {
    const returns = buildConstantReturns(-0.2, 252, 252);
    let compounded = 1;
    for (const r of returns) compounded *= 1 + r;
    expect(compounded).toBeCloseTo(0.8, 10);
  });
});

describe('tileReturns', () => {
  it('인덱스를 통해 원본 수익률을 읽어온다', () => {
    const source = Float64Array.from([Number.NaN, 0.01, 0.02, 0.03]);
    const tiled = tileReturns(source, Int32Array.from([1, 2, 3, 1, 2]));
    expect(Array.from(tiled)).toEqual([0.01, 0.02, 0.03, 0.01, 0.02]);
  });
});

describe('describePathAssumption', () => {
  it('구간 연수와 반복 횟수를 사용자에게 알린다 (§5.3)', () => {
    const label = describePathAssumption('2023-08-01', '2026-08-01', 10);
    expect(label).toContain('2023-08-01');
    expect(label).toContain('2026-08-01');
    expect(label).toContain('3.0년');
    expect(label).toContain('3.3회');
  });

  it('거래일 기준 describePath와 소수 첫째 자리까지 일치한다', () => {
    // 옛 describePath는 tradingDays 756 / 252 = 3.0년, repeats 3.33 → "3.3회"였다.
    // 달력 기준(365.25일/년)으로 바꿔도 표시 자릿수 안에서는 같은 값이어야 한다.
    const label = describePathAssumption('2023-08-01', '2026-08-01', 10);
    expect(label).toContain('3.0년');
    expect(label).toContain('3.3회');
  });

  it('설계 기간이 구간보다 짧으면 반복 횟수가 1 미만으로 나온다', () => {
    const label = describePathAssumption('2018-09-20', '2026-01-06', 3);
    expect(label).toContain('7.3년');
    expect(label).toContain('0.4회');
  });

  it('to가 from보다 이르면 반복 횟수를 말하지 않는다 — 0으로 나누지 않는다', () => {
    const label = describePathAssumption('2026-08-01', '2023-08-01', 10);
    expect(label).toContain('2026-08-01');
    expect(label).not.toContain('반복');
  });
});
