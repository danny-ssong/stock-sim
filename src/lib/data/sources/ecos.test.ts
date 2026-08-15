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
