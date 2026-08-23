import { describe, it, expect } from 'vitest';
import {
  parseSimulationQuery,
  serializeSimulationQuery,
  V1_AVAILABLE_EXPOSURES,
  DEFAULT_EXPOSURE,
  type QueryContext,
} from './schema';

const CONTEXT: QueryContext = {
  mode: 'future',
  today: '2026-08-17',
};

function params(query: string): URLSearchParams {
  return new URLSearchParams(query);
}

describe('parseSimulationQuery — 금액 단위', () => {
  it('p·m은 만원 단위를 원 단위로 환산한다', () => {
    const input = parseSimulationQuery(params('p=1000&m=500'), CONTEXT);
    expect(input.initialAmount).toBe(10_000_000);
    expect(input.contribution.base).toBe(5_000_000);
  });

  it('값이 없으면 기본값을 쓴다', () => {
    const input = parseSimulationQuery(params(''), CONTEXT);
    expect(input.initialAmount).toBe(100_000_000);
    expect(input.contribution.base).toBe(1_500_000);
    expect(input.years).toBe(15);
  });

  it('숫자가 아닌 값은 기본값으로 폴백한다 — 에러를 던지지 않는다', () => {
    const input = parseSimulationQuery(params('p=abc&y=xyz'), CONTEXT);
    expect(input.initialAmount).toBe(100_000_000);
    expect(input.years).toBe(15);
  });

  it('빈 문자열은 기본값으로 폴백한다 — 0이 아니다(M13)', () => {
    const input = parseSimulationQuery(params('y='), CONTEXT);
    expect(input.years).toBe(15);
  });
});

describe('parseSimulationQuery — anchor', () => {
  it('연차:값(만원) 쌍을 파싱한다', () => {
    const input = parseSimulationQuery(params('ma=4:1000,9:1500'), CONTEXT);
    expect(input.contribution.anchors).toEqual({ 4: 10_000_000, 9: 15_000_000 });
  });

  it('깨진 쌍만 버리고 나머지는 유지한다', () => {
    const input = parseSimulationQuery(params('ma=4:1000,x:y,9:1500'), CONTEXT);
    expect(input.contribution.anchors).toEqual({ 4: 10_000_000, 9: 15_000_000 });
  });
});

describe('parseSimulationQuery — 노출', () => {
  it('exp를 그대로 반영한다', () => {
    const input = parseSimulationQuery(params('exp=NASDAQ100_2X'), CONTEXT);
    expect(input.exposure).toBe('NASDAQ100_2X');
  });

  it('exp가 없으면 기본 노출을 쓴다', () => {
    const input = parseSimulationQuery(params(''), CONTEXT);
    expect(input.exposure).toBe(DEFAULT_EXPOSURE);
  });

  it('배당 노출(US_DIVIDEND_100)은 v1에서 걸러 기본값으로 폴백한다', () => {
    const input = parseSimulationQuery(params('exp=US_DIVIDEND_100'), CONTEXT);
    expect(input.exposure).toBe('NASDAQ100_1X');
    expect(V1_AVAILABLE_EXPOSURES).not.toContain('US_DIVIDEND_100');
  });

  it('알 수 없는 노출값도 기본값으로 폴백한다', () => {
    const input = parseSimulationQuery(params('exp=NOT_A_REAL_EXPOSURE'), CONTEXT);
    expect(input.exposure).toBe(DEFAULT_EXPOSURE);
  });
});

describe('parseSimulationQuery — 수익률 소스와 시작월(D3)', () => {
  it('src=cagr면 r을 연 수익률로 쓴다', () => {
    const input = parseSimulationQuery(params('src=cagr&r=7'), CONTEXT);
    expect(input.returnSource).toEqual({ type: 'constantCagr', annualRate: 0.07 });
  });

  it('src=path(기본)면 from~to를 참조 구간으로 쓴다', () => {
    const input = parseSimulationQuery(
      params('src=path&from=2011-08-01&to=2026-08-01'),
      CONTEXT,
    );
    expect(input.returnSource).toEqual({
      type: 'historicalPath',
      from: '2011-08-01',
      to: '2026-08-01',
      tileMode: 'repeat',
    });
  });

  it('미래 모드는 시작월을 오늘로 채운다', () => {
    const input = parseSimulationQuery(params(''), CONTEXT);
    expect(input.startMonth).toBe('2026-08');
  });

  it('백테스트 모드는 시작월을 from에서 가져온다(D3)', () => {
    const input = parseSimulationQuery(params('from=2011-08-15'), {
      ...CONTEXT,
      mode: 'backtest',
    });
    expect(input.startMonth).toBe('2011-08');
    expect(input.mode).toBe('backtest');
  });

  it('from이 BACKFILL_START(1995-01-03)보다 이르면 BACKFILL_START로 클램프한다 — buildBacktestCalendar 크래시 예방', () => {
    const input = parseSimulationQuery(params('from=1980-01-01'), {
      ...CONTEXT,
      mode: 'backtest',
    });
    expect(input.startMonth).toBe('1995-01');
  });
});

describe('parseSimulationQuery — 제거된 target 파라미터', () => {
  it('레거시 공유 링크의 target=은 조용히 무시된다', () => {
    const input = parseSimulationQuery(params('p=1000&target=30000'), CONTEXT);
    expect(input.initialAmount).toBe(10_000_000);
    expect(Object.keys(input)).not.toContain('target');
  });

  it('직렬화 결과에 target이 남지 않는다', () => {
    const input = parseSimulationQuery(params('target=30000'), CONTEXT);
    expect(serializeSimulationQuery(input).has('target')).toBe(false);
  });
});

describe('왕복 — parse(serialize(x)) === x', () => {
  it('노출·기간·납입액만으로 왕복한다', () => {
    const params = new URLSearchParams('p=1000&m=100&y=10&exp=NASDAQ100_3X&src=cagr&r=8');
    const input = parseSimulationQuery(params, { mode: 'future', today: '2026-08-19' });
    expect(input.exposure).toBe('NASDAQ100_3X');
    expect(input.years).toBe(10);

    const serialized = serializeSimulationQuery(input);
    expect(serialized.get('exp')).toBe('NASDAQ100_3X');
    expect(serialized.has('alloc')).toBe(false);
    expect(serialized.has('fx')).toBe(false);
    expect(serialized.has('inc')).toBe(false);
  });

  it('일반적인 입력이 그대로 복원된다', () => {
    const original = parseSimulationQuery(
      params(
        'p=1000&m=500&mg=5&ma=4:1000,9:1500' +
          '&y=15&exp=NASDAQ100_2X' +
          '&src=path&from=2011-08-01&to=2026-08-01&target=30000',
      ),
      CONTEXT,
    );

    const roundTripped = parseSimulationQuery(serializeSimulationQuery(original), CONTEXT);

    expect(roundTripped).toEqual(original);
  });
});

describe('serializeSimulationQuery — 부동소수점 노이즈(M7)', () => {
  it('growthRate·CAGR 직렬화가 소수 4자리를 넘는 노이즈를 남기지 않는다', () => {
    const input = parseSimulationQuery(params('mg=7&src=cagr&r=8'), CONTEXT);
    const serialized = serializeSimulationQuery(input);
    expect(serialized.get('mg')).toBe('7');
    expect(serialized.get('r')).toBe('8');
  });
});
