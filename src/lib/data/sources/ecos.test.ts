import { describe, it, expect } from 'vitest';
import { parseEcosResponse, ecosSeriesUrl, ECOS_FX_STAT_CODE, ECOS_FX_ITEM_CODE } from './ecos';
import fixture from './__fixtures__/ecos-fx-sample.json';

describe('parseEcosResponse', () => {
  it('일별(8자리) YYYYMMDD를 ISO 날짜로 변환한다', () => {
    const s = parseEcosResponse(fixture);
    expect(s.dates).toEqual(['1995-01-03', '1995-01-04', '1995-01-05']);
  });

  it('문자열 값을 숫자로 변환한다', () => {
    const s = parseEcosResponse(fixture);
    expect(s.values).toEqual([788.7, 789.1, 790.2]);
  });

  it('월별(6자리) YYYYMM은 그 달 1일로 앵커링한 ISO 날짜로 변환한다', () => {
    const monthly = {
      StatisticSearch: {
        list_total_count: 1,
        row: [{ TIME: '197501', DATA_VALUE: '4.436' }],
      },
    };
    const s = parseEcosResponse(monthly);
    expect(s.dates).toEqual(['1975-01-01']);
    expect(s.values).toEqual([4.436]);
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

describe('ecosSeriesUrl', () => {
  it('일별(D) 주기는 YYYYMMDD 그대로 쓴다', () => {
    const url = ecosSeriesUrl('KEY', ECOS_FX_STAT_CODE, ECOS_FX_ITEM_CODE, 'D', '1995-01-03', '1995-12-31', 1, 1000);
    expect(url).toContain('/KEY/');
    expect(url).toContain(`/${ECOS_FX_STAT_CODE}/D/19950103/19951231/${ECOS_FX_ITEM_CODE}`);
    expect(url).toContain('/1/1000/');
  });

  it('월별(M) 주기는 YYYYMM으로 자른다', () => {
    const url = ecosSeriesUrl('KEY', '901Y009', 'K01104', 'M', '1975-01-01', '2026-07-31', 1, 1000);
    expect(url).toContain('/901Y009/M/197501/202607/K01104');
  });
});
