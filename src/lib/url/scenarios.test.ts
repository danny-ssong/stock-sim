import { describe, it, expect } from 'vitest';
import { parseScenarios, serializeScenarios, DEFAULT_SCENARIOS, MAX_SCENARIOS } from './scenarios';
import type { ScenarioConfig } from '../sim/compare';

describe('parseScenarios', () => {
  it('값이 없으면 기본 시나리오 1개를 반환한다', () => {
    expect(parseScenarios(null)).toEqual(DEFAULT_SCENARIOS);
    expect(parseScenarios('')).toEqual(DEFAULT_SCENARIOS);
  });

  it('label;exposure 포맷의 시나리오를 파싱한다', () => {
    const raw = `${encodeURIComponent('시나리오 A')};NASDAQ100_2X`;
    const scenarios = parseScenarios(raw);
    expect(scenarios).toEqual([{ label: '시나리오 A', exposure: 'NASDAQ100_2X' }]);
  });

  it('여러 시나리오를 |로 구분해 파싱한다', () => {
    const a = `${encodeURIComponent('A')};NASDAQ100_1X`;
    const b = `${encodeURIComponent('B')};SP500_2X`;
    const scenarios = parseScenarios(`${a}|${b}`);
    expect(scenarios).toEqual([
      { label: 'A', exposure: 'NASDAQ100_1X' },
      { label: 'B', exposure: 'SP500_2X' },
    ]);
  });

  it('라벨에 구분자 문자(세미콜론 등)가 있어도 안전하게 복원한다', () => {
    const label = 'A;B|C,D:E';
    const raw = serializeScenarios([{ label, exposure: 'NASDAQ100_1X' }]);
    expect(parseScenarios(raw)[0].label).toBe(label);
  });

  it('4개를 넘는 시나리오는 잘라낸다', () => {
    const one = `${encodeURIComponent('A')};NASDAQ100_1X`;
    const raw = Array.from({ length: 6 }, () => one).join('|');
    expect(parseScenarios(raw)).toHaveLength(MAX_SCENARIOS);
  });

  it('필드가 깨져도 크래시하지 않고 폴백한다', () => {
    expect(() => parseScenarios('garbage;;;;;;')).not.toThrow();
  });

  it('라벨의 잘못된 퍼센트 인코딩도 크래시 없이 기본 라벨로 폴백한다', () => {
    const raw = '%zz;NASDAQ100_1X';
    expect(() => parseScenarios(raw)).not.toThrow();
    expect(parseScenarios(raw)[0].label).toBe('시나리오 A');
  });
});

describe('serializeScenarios ↔ parseScenarios 왕복', () => {
  it('노출만 담아 왕복한다', () => {
    const serialized = serializeScenarios([
      { label: '시나리오 A', exposure: 'NASDAQ100_1X' },
      { label: '시나리오 B', exposure: 'NASDAQ100_3X' },
    ]);
    const parsed = parseScenarios(serialized);
    expect(parsed).toEqual([
      { label: '시나리오 A', exposure: 'NASDAQ100_1X' },
      { label: '시나리오 B', exposure: 'NASDAQ100_3X' },
    ]);
  });

  it('직렬화한 뒤 다시 파싱하면 원래 값으로 돌아온다', () => {
    const scenarios: ScenarioConfig[] = [
      { label: '시나리오 A', exposure: 'NASDAQ100_1X' },
      { label: '이전 시나리오', exposure: 'SP500_1X' },
    ];
    expect(parseScenarios(serializeScenarios(scenarios))).toEqual(scenarios);
  });
});
