import { describe, expect, it } from 'vitest';
import { dateAxisProps, firstOfEachGroup, labelGroupOf, thinToTarget } from './x-axis';

/** 'YYYY-MM' 월별 x값을 from부터 count개 만든다 */
function months(from: string, count: number): string[] {
  const start = Number(from.slice(0, 4)) * 12 + Number(from.slice(5, 7)) - 1;
  return Array.from({ length: count }, (_, i) => {
    const index = start + i;
    return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
  });
}

/** 같은 기간을 일별로 채운다 — 달마다 daysPerMonth개의 거래일이 있다고 본다 */
function days(from: string, monthCount: number, daysPerMonth: number): string[] {
  return months(from, monthCount).flatMap((month) =>
    Array.from({ length: daysPerMonth }, (_, d) => `${month}-${String(d + 2).padStart(2, '0')}`),
  );
}

/** 축이 실제로 그리는 라벨 목록 */
function labelsOf(props: ReturnType<typeof dateAxisProps>): (string | undefined)[] | undefined {
  return props.ticks?.map((tick) => props.tickFormatter?.(tick));
}

describe('dateAxisProps', () => {
  it('빈 배열이면 recharts 기본값에 맡긴다', () => {
    expect(dateAxisProps([])).toEqual({
      ticks: undefined,
      tickFormatter: undefined,
      interval: undefined,
    });
  });

  it('interval 0을 함께 낸다 — 넘긴 틱을 recharts가 다시 솎지 못하게 한다', () => {
    expect(dateAxisProps(months('2020-01', 12)).interval).toBe(0);
  });

  describe('36개월 이하 — 월 라벨', () => {
    it('후보가 목표 개수 이하면 전부 남긴다', () => {
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
      expect(dateAxisProps(months('2020-01', 36)).tickFormatter?.('2021-07')).toBe('2021-07');
    });

    it('후보가 많으면 끝에서부터 같은 간격으로 솎아 마지막 시점을 항상 남긴다', () => {
      // 20개월 → stride 4 → 끝(2026-09)에서 4개월씩 거슬러 5개
      expect(labelsOf(dateAxisProps(months('2025-02', 20)))).toEqual([
        '2025-05', '2025-09', '2026-01', '2026-05', '2026-09',
      ]);
    });
  });

  describe('36개월 초과 — 연도 라벨', () => {
    it('경계값 37개월부터 연도 라벨로 넘어간다', () => {
      const { ticks, tickFormatter } = dateAxisProps(months('2020-01', 37));
      expect(ticks).toEqual(['2020-01', '2021-01', '2022-01', '2023-01']);
      expect(tickFormatter?.('2021-07')).toBe('2021');
    });

    it('일별 값이면 각 해의 첫 거래일을 틱으로 쓴다 — 1월 1일은 휴장이라 없다', () => {
      const { ticks, tickFormatter } = dateAxisProps([
        '2020-03-16', '2020-12-31',
        '2021-01-04', '2021-06-15',
        '2022-01-03', '2022-06-15',
        '2023-01-03', '2023-06-15',
        '2024-01-02',
      ]);
      expect(ticks).toEqual(['2020-03-16', '2021-01-04', '2022-01-03', '2023-01-03', '2024-01-02']);
      expect(tickFormatter?.('2021-06-15')).toBe('2021');
    });

    it('30년이면 연도 후보도 솎아낸다', () => {
      expect(labelsOf(dateAxisProps(months('1995-01', 360)))).toEqual([
        '1999', '2004', '2009', '2014', '2019', '2024',
      ]);
    });

    it('구간 길이는 행 개수가 아니라 첫 값~끝 값 거리로 잰다 — 다운샘플링으로 행이 솎여도 같다', () => {
      // 30년 구간을 4행으로 솎아낸 상태. 행 개수(4)로 판단하면 월 라벨이 됐을 것이다.
      const { tickFormatter } = dateAxisProps(['1995-01-03', '2005-06-14', '2015-09-21', '2024-12-31']);
      expect(tickFormatter?.('2005-06-14')).toBe('2005');
    });
  });

  describe('가격 차트(일별)와 자산 차트(월별)의 축 일치', () => {
    it('포인트 수가 10배 이상 달라도 같은 라벨을 같은 개수로 낸다', () => {
      // recharts 자동 솎아내기에 맡기던 시절 갈렸던 케이스 — 위는 3·7·10월,
      // 아래는 5·9월이 남아 두 차트의 연도/월 라벨이 세로로 어긋났다.
      const daily = dateAxisProps(days('2025-02', 20, 21));
      const monthly = dateAxisProps(months('2025-02', 20));

      expect(daily.ticks).toHaveLength(5);
      expect(monthly.ticks).toHaveLength(5);
      expect(labelsOf(daily)).toEqual(labelsOf(monthly));
    });

    it('장기 구간에서도 연도 라벨이 일치한다', () => {
      const daily = dateAxisProps(days('2018-03', 47, 21));
      const monthly = dateAxisProps(months('2018-03', 47));

      expect(labelsOf(daily)).toEqual(['2018', '2019', '2020', '2021', '2022']);
      expect(labelsOf(monthly)).toEqual(labelsOf(daily));
    });
  });
});

describe('labelGroupOf', () => {
  it('36개월 이하면 월 단위로 묶는다', () => {
    const groupOf = labelGroupOf(months('2020-01', 12));
    expect(groupOf('2020-03-17')).toBe('2020-03');
  });

  it('36개월을 넘으면 연 단위로 묶는다', () => {
    const groupOf = labelGroupOf(months('2015-01', 60));
    expect(groupOf('2020-03-17')).toBe('2020');
  });

  it('빈 배열이면 월 단위로 폴백한다 — 구간을 잴 값이 없다', () => {
    expect(labelGroupOf([])('2020-03-17')).toBe('2020-03');
  });
});

describe('firstOfEachGroup', () => {
  it('그룹이 바뀌는 첫 항목만 남긴다', () => {
    const values = ['2020-01-02', '2020-01-31', '2020-02-03', '2020-03-02'];
    expect(firstOfEachGroup(values, (v) => v.slice(0, 7))).toEqual([
      '2020-01-02', '2020-02-03', '2020-03-02',
    ]);
  });
});

describe('thinToTarget', () => {
  it('마지막 항목은 항상 남긴다', () => {
    const kept = thinToTarget(['a', 'b', 'c', 'd', 'e', 'f', 'g'], 3);
    expect(kept[kept.length - 1]).toBe('g');
    expect(kept.length).toBeLessThanOrEqual(3);
  });

  it('후보가 목표 이하면 그대로 낸다', () => {
    expect(thinToTarget(['a', 'b'], 6)).toEqual(['a', 'b']);
  });
});

