import { describe, expect, it } from 'vitest';
import { dateAxisProps } from './x-axis';

/** 'YYYY-MM' 월별 x값을 from부터 count개 만든다 */
function months(from: string, count: number): string[] {
  const start = Number(from.slice(0, 4)) * 12 + Number(from.slice(5, 7)) - 1;
  return Array.from({ length: count }, (_, i) => {
    const index = start + i;
    return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
  });
}

describe('dateAxisProps', () => {
  it('빈 배열이면 recharts 기본값에 맡긴다', () => {
    expect(dateAxisProps([])).toEqual({ ticks: undefined, tickFormatter: undefined });
  });

  describe('36개월 이하 — 월 라벨', () => {
    it('월이 바뀌는 첫 항목마다 틱을 낸다', () => {
      const { ticks, tickFormatter } = dateAxisProps(['2020-01', '2020-02', '2020-03']);
      expect(ticks).toEqual(['2020-01', '2020-02', '2020-03']);
      expect(tickFormatter?.('2020-02')).toBe('2020-02');
    });

    it('일별 값이면 각 달의 첫 거래일만 남기고 라벨은 월까지 자른다', () => {
      const { ticks, tickFormatter } = dateAxisProps([
        '2020-01-02', '2020-01-03', '2020-02-03', '2020-02-04', '2020-03-02',
      ]);
      expect(ticks).toEqual(['2020-01-02', '2020-02-03', '2020-03-02']);
      expect(tickFormatter?.('2020-02-03')).toBe('2020-02');
    });

    it('경계값 36개월까지는 월 라벨을 유지한다', () => {
      const { tickFormatter } = dateAxisProps(months('2020-01', 36));
      expect(tickFormatter?.('2021-07')).toBe('2021-07');
    });
  });

  describe('36개월 초과 — 연도 라벨', () => {
    it('경계값 37개월부터 연도 라벨로 넘어간다', () => {
      const { ticks, tickFormatter } = dateAxisProps(months('2020-01', 37));
      expect(ticks).toEqual(['2020-01', '2021-01', '2022-01', '2023-01']);
      expect(tickFormatter?.('2021-07')).toBe('2021');
    });

    it('일별 값이면 각 해의 첫 거래일을 틱으로 쓴다 — 1월 1일은 휴장이라 없다', () => {
      const xValues = [
        '2020-03-16', '2020-12-31',
        '2021-01-04', '2021-06-15',
        '2022-01-03', '2022-06-15',
        '2023-01-03', '2023-06-15',
        '2024-01-02',
      ];
      const { ticks, tickFormatter } = dateAxisProps(xValues);
      expect(ticks).toEqual(['2020-03-16', '2021-01-04', '2022-01-03', '2023-01-03', '2024-01-02']);
      expect(tickFormatter?.('2021-06-15')).toBe('2021');
    });

    it('구간 길이는 행 개수가 아니라 첫 값~끝 값 거리로 잰다 — 다운샘플링으로 행이 솎여도 같다', () => {
      // 30년 구간을 4행으로 솎아낸 상태. 행 개수(4)로 판단하면 월 라벨이 됐을 것이다.
      const { tickFormatter } = dateAxisProps(['1995-01-03', '2005-06-14', '2015-09-21', '2024-12-31']);
      expect(tickFormatter?.('2005-06-14')).toBe('2005');
    });
  });

  it('가격 차트(일별)와 자산 차트(월별)가 같은 기간에서 같은 라벨을 낸다', () => {
    const daily = dateAxisProps([
      '2018-03-15', '2018-11-02',
      '2019-01-04', '2019-08-09',
      '2020-01-03', '2020-07-10',
      '2021-01-05', '2021-09-30',
      '2022-01-04',
    ]);
    const monthly = dateAxisProps(months('2018-03', 47));

    const labelsOf = (props: ReturnType<typeof dateAxisProps>) =>
      props.ticks?.map((tick) => props.tickFormatter?.(tick));
    expect(labelsOf(daily)).toEqual(['2018', '2019', '2020', '2021', '2022']);
    expect(labelsOf(monthly)).toEqual(labelsOf(daily));
  });
});
