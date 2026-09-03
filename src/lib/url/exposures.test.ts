import { describe, it, expect } from 'vitest';
import {
  DEFAULT_EXPOSURE,
  MAX_EXPOSURES,
  parseExposures,
  serializeExposures,
  toggleExposure,
} from './exposures';

describe('노출 순서', () => {
  it('고른 순서와 무관하게 항상 목록(카탈로그) 순서로 정렬한다', () => {
    // 나스닥 2배 → 3배 → 1배 순으로 골라도 요약·차트는 1배, 2배, 3배 순이어야 한다
    expect(parseExposures('NASDAQ100_2X,NASDAQ100_3X,NASDAQ100_1X')).toEqual([
      'NASDAQ100_1X',
      'NASDAQ100_2X',
      'NASDAQ100_3X',
    ]);
  });

  it('체크박스로 추가해도 목록 순서를 지킨다 — 뒤에 붙이지 않는다', () => {
    expect(toggleExposure(['NASDAQ100_3X'], 'NASDAQ100_1X')).toEqual([
      'NASDAQ100_1X',
      'NASDAQ100_3X',
    ]);
  });

  it('S&P와 나스닥이 섞여도 목록 순서를 지킨다', () => {
    expect(parseExposures('SP500_2X,NASDAQ100_3X,SP500_1X')).toEqual([
      'NASDAQ100_3X',
      'SP500_1X',
      'SP500_2X',
    ]);
  });
});

describe('parseExposures', () => {
  it('콤마로 구분된 여러 노출을 읽는다', () => {
    expect(parseExposures('NASDAQ100_1X,SP500_3X')).toEqual(['NASDAQ100_1X', 'SP500_3X']);
  });

  it('탭 시절의 단일 값 공유 링크도 그대로 통과시킨다', () => {
    expect(parseExposures('NASDAQ100_2X')).toEqual(['NASDAQ100_2X']);
  });

  it('값이 없으면 기본 노출 하나로 폴백한다', () => {
    expect(parseExposures(null)).toEqual([DEFAULT_EXPOSURE]);
    expect(parseExposures('')).toEqual([DEFAULT_EXPOSURE]);
  });

  it('무효한 값은 기본값으로 치환하지 않고 버린다 — 치환하면 중복 비교가 생긴다', () => {
    expect(parseExposures('NASDAQ100_1X,US_DIVIDEND_100,SP500_1X')).toEqual([
      'NASDAQ100_1X',
      'SP500_1X',
    ]);
  });

  it('전부 무효하면 기본 노출 하나로 폴백한다', () => {
    expect(parseExposures('NOPE,ALSO_NOPE')).toEqual([DEFAULT_EXPOSURE]);
  });

  it('중복을 제거한다', () => {
    expect(parseExposures('SP500_1X,SP500_1X,SP500_2X')).toEqual(['SP500_1X', 'SP500_2X']);
  });

  it('상한을 넘는 값은 앞에서부터 잘라낸다', () => {
    const parsed = parseExposures('NASDAQ100_1X,NASDAQ100_2X,NASDAQ100_3X,SP500_1X,SP500_2X');
    expect(parsed).toHaveLength(MAX_EXPOSURES);
    expect(parsed).toEqual(['NASDAQ100_1X', 'NASDAQ100_2X', 'NASDAQ100_3X', 'SP500_1X']);
  });

  it('공백이 섞여도 읽는다', () => {
    expect(parseExposures(' NASDAQ100_1X , SP500_1X ')).toEqual(['NASDAQ100_1X', 'SP500_1X']);
  });
});

describe('serializeExposures', () => {
  it('parse와 왕복한다', () => {
    const exposures = parseExposures('NASDAQ100_3X,SP500_2X');
    expect(parseExposures(serializeExposures(exposures))).toEqual(exposures);
  });
});

describe('toggleExposure', () => {
  it('선택되지 않은 노출을 뒤에 추가한다', () => {
    expect(toggleExposure(['NASDAQ100_1X'], 'SP500_1X')).toEqual(['NASDAQ100_1X', 'SP500_1X']);
  });

  it('선택된 노출을 해제한다', () => {
    expect(toggleExposure(['NASDAQ100_1X', 'SP500_1X'], 'NASDAQ100_1X')).toEqual(['SP500_1X']);
  });

  it('마지막 하나는 해제하지 않는다 — 비교 대상이 0개면 계산할 게 없다', () => {
    expect(toggleExposure(['NASDAQ100_1X'], 'NASDAQ100_1X')).toEqual(['NASDAQ100_1X']);
  });

  it('상한에 도달하면 추가를 무시한다', () => {
    const full = parseExposures('NASDAQ100_1X,NASDAQ100_2X,NASDAQ100_3X,SP500_1X');
    expect(toggleExposure(full, 'SP500_3X')).toEqual(full);
  });

  it('입력 배열을 변형하지 않는다', () => {
    const current = parseExposures('NASDAQ100_1X');
    toggleExposure(current, 'SP500_1X');
    expect(current).toEqual(['NASDAQ100_1X']);
  });
});
