import { describe, it, expect } from 'vitest';
import { parseScenarios, serializeScenarios, DEFAULT_SCENARIOS, MAX_SCENARIOS } from './scenarios';
import type { ScenarioConfig } from '../sim/compare';

describe('parseScenarios', () => {
  it('값이 없으면 기본 시나리오 1개를 반환한다', () => {
    expect(parseScenarios(null)).toEqual(DEFAULT_SCENARIOS);
    expect(parseScenarios('')).toEqual(DEFAULT_SCENARIOS);
  });

  it('allocation 시나리오를 파싱한다', () => {
    const raw = `${encodeURIComponent('시나리오 A')};a;NASDAQ100_2X;ISA:60,DIRECT_US:40;`;
    const scenarios = parseScenarios(raw);
    expect(scenarios).toEqual([
      {
        kind: 'allocation',
        label: '시나리오 A',
        allocations: [
          { accountId: 'ISA', exposure: 'NASDAQ100_2X', weight: 0.6 },
          { accountId: 'DIRECT_US', exposure: 'NASDAQ100_2X', weight: 0.4 },
        ],
      },
    ]);
  });

  it('transfer 시나리오를 파싱한다', () => {
    const raw = `${encodeURIComponent('ISA 이전')};t;NASDAQ100_1X;;5`;
    const scenarios = parseScenarios(raw);
    expect(scenarios).toEqual([
      { kind: 'transfer', label: 'ISA 이전', exposure: 'NASDAQ100_1X', transferYear: 5 },
    ]);
  });

  it('여러 시나리오를 |로 구분해 파싱한다', () => {
    const a = `${encodeURIComponent('A')};a;NASDAQ100_1X;ISA:100;`;
    const b = `${encodeURIComponent('B')};t;NASDAQ100_1X;;3`;
    const scenarios = parseScenarios(`${a}|${b}`);
    expect(scenarios).toHaveLength(2);
    expect(scenarios[0].kind).toBe('allocation');
    expect(scenarios[1].kind).toBe('transfer');
  });

  it('라벨에 구분자 문자(세미콜론 등)가 있어도 안전하게 복원한다', () => {
    const label = 'A;B|C,D:E';
    const raw = serializeScenarios([
      { kind: 'allocation', label, allocations: [{ accountId: 'ISA', exposure: 'NASDAQ100_1X', weight: 1 }] },
    ]);
    expect(parseScenarios(raw)[0].label).toBe(label);
  });

  it('4개를 넘는 시나리오는 잘라낸다', () => {
    const one = `${encodeURIComponent('A')};a;NASDAQ100_1X;ISA:100;`;
    const raw = Array.from({ length: 6 }, () => one).join('|');
    expect(parseScenarios(raw)).toHaveLength(MAX_SCENARIOS);
  });

  it('필드가 깨져도 크래시하지 않고 폴백한다', () => {
    expect(() => parseScenarios('garbage;;;;;;')).not.toThrow();
  });

  it('라벨의 잘못된 퍼센트 인코딩도 크래시 없이 기본 라벨로 폴백한다', () => {
    const raw = '%zz;a;NASDAQ100_1X;ISA:100;';
    expect(() => parseScenarios(raw)).not.toThrow();
    expect(parseScenarios(raw)[0].label).toBe('시나리오 A');
  });
});

describe('serializeScenarios ↔ parseScenarios 왕복', () => {
  it('직렬화한 뒤 다시 파싱하면 원래 값으로 돌아온다', () => {
    const scenarios: ScenarioConfig[] = [
      {
        kind: 'allocation',
        label: '시나리오 A',
        allocations: [{ accountId: 'ISA', exposure: 'NASDAQ100_1X', weight: 1 }],
      },
      { kind: 'transfer', label: '이전 시나리오', exposure: 'SP500_1X', transferYear: 7 },
    ];
    expect(parseScenarios(serializeScenarios(scenarios))).toEqual(scenarios);
  });
});
