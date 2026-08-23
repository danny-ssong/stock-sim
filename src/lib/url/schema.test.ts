import { describe, it, expect } from 'vitest';
import {
  parseSimulationQuery,
  serializeSimulationQuery,
  type QueryContext,
} from './schema';
import { DEFAULT_EXPOSURE, V1_AVAILABLE_EXPOSURES } from './exposures';

const CONTEXT: QueryContext = { today: '2026-08-17' };

function params(query: string): URLSearchParams {
  return new URLSearchParams(query);
}

describe('parseSimulationQuery — 금액 단위', () => {
  it('p·m은 만원 단위를 원 단위로 환산한다', () => {
    const { base } = parseSimulationQuery(params('p=1000&m=500'), CONTEXT);
    expect(base.initialAmount).toBe(10_000_000);
    expect(base.contribution.base).toBe(5_000_000);
  });

  it('값이 없으면 기본값을 쓴다', () => {
    const { base } = parseSimulationQuery(params(''), CONTEXT);
    expect(base.initialAmount).toBe(100_000_000);
    expect(base.contribution.base).toBe(1_500_000);
    expect(base.years).toBe(15);
  });

  it('숫자가 아닌 값은 기본값으로 폴백한다 — 에러를 던지지 않는다', () => {
    const { base } = parseSimulationQuery(params('p=abc&y=xyz'), CONTEXT);
    expect(base.initialAmount).toBe(100_000_000);
    expect(base.years).toBe(15);
  });

  it('빈 문자열은 기본값으로 폴백한다 — 0이 아니다(M13)', () => {
    const { base } = parseSimulationQuery(params('y='), CONTEXT);
    expect(base.years).toBe(15);
  });
});

describe('parseSimulationQuery — anchor', () => {
  it('연차:값(만원) 쌍을 파싱한다', () => {
    const { base } = parseSimulationQuery(params('ma=4:1000,9:1500'), CONTEXT);
    expect(base.contribution.anchors).toEqual({ 4: 10_000_000, 9: 15_000_000 });
  });

  it('깨진 쌍만 버리고 나머지는 유지한다', () => {
    const { base } = parseSimulationQuery(params('ma=4:1000,x:y,9:1500'), CONTEXT);
    expect(base.contribution.anchors).toEqual({ 4: 10_000_000, 9: 15_000_000 });
  });
});

describe('parseSimulationQuery — 모드(라우트가 아니라 쿼리에서 온다)', () => {
  it('mode가 없으면 미래 설계다', () => {
    const { base } = parseSimulationQuery(params(''), CONTEXT);
    expect(base.mode).toBe('future');
  });

  it('mode=backtest를 그대로 반영한다', () => {
    const { base } = parseSimulationQuery(params('mode=backtest'), CONTEXT);
    expect(base.mode).toBe('backtest');
  });

  it('알 수 없는 mode는 미래 설계로 폴백한다', () => {
    const { base } = parseSimulationQuery(params('mode=nonsense'), CONTEXT);
    expect(base.mode).toBe('future');
  });
});

describe('parseSimulationQuery — 노출 목록', () => {
  it('exp를 콤마 구분 배열로 읽는다', () => {
    const { exposures } = parseSimulationQuery(params('exp=NASDAQ100_2X,SP500_3X'), CONTEXT);
    expect(exposures).toEqual(['NASDAQ100_2X', 'SP500_3X']);
  });

  it('탭 시절 단일 값 공유 링크도 깨지지 않는다', () => {
    const { exposures } = parseSimulationQuery(params('exp=NASDAQ100_2X'), CONTEXT);
    expect(exposures).toEqual(['NASDAQ100_2X']);
  });

  it('exp가 없으면 기본 노출 하나를 쓴다', () => {
    const { exposures } = parseSimulationQuery(params(''), CONTEXT);
    expect(exposures).toEqual([DEFAULT_EXPOSURE]);
  });

  it('배당 노출(US_DIVIDEND_100)은 v1에 존재하지 않는다', () => {
    const { exposures } = parseSimulationQuery(params('exp=US_DIVIDEND_100'), CONTEXT);
    expect(exposures).toEqual([DEFAULT_EXPOSURE]);
    expect(V1_AVAILABLE_EXPOSURES).not.toContain('US_DIVIDEND_100');
  });
});

describe('parseSimulationQuery — 수익률 소스와 시작월(D3)', () => {
  it('src=cagr면 r을 연 수익률로 쓴다', () => {
    const { base } = parseSimulationQuery(params('src=cagr&r=7'), CONTEXT);
    expect(base.returnSource).toEqual({ type: 'constantCagr', annualRate: 0.07 });
  });

  it('src=path(기본)면 from~to를 참조 구간으로 쓴다', () => {
    const { base } = parseSimulationQuery(
      params('src=path&from=2011-08-01&to=2026-08-01'),
      CONTEXT,
    );
    expect(base.returnSource).toEqual({
      type: 'historicalPath',
      from: '2011-08-01',
      to: '2026-08-01',
      tileMode: 'repeat',
    });
  });

  it('미래 모드는 시작월을 오늘로 채운다', () => {
    const { base } = parseSimulationQuery(params(''), CONTEXT);
    expect(base.startMonth).toBe('2026-08');
  });

  it('백테스트 모드는 시작월을 from에서 가져온다(D3)', () => {
    const { base } = parseSimulationQuery(params('mode=backtest&from=2011-08-15'), CONTEXT);
    expect(base.startMonth).toBe('2011-08');
    expect(base.mode).toBe('backtest');
  });

  it('from이 BACKFILL_START(1995-01-03)보다 이르면 클램프한다 — buildBacktestCalendar 크래시 예방', () => {
    const { base } = parseSimulationQuery(params('mode=backtest&from=1980-01-01'), CONTEXT);
    expect(base.startMonth).toBe('1995-01');
  });

  it('백테스트 + 고정 수익률은 과거 구간 재생으로 교정된다 — 감춰진 토글의 경고를 남기지 않는다', () => {
    const { base } = parseSimulationQuery(
      params('mode=backtest&src=cagr&r=8&from=2011-08-01&to=2026-08-01'),
      CONTEXT,
    );
    expect(base.returnSource).toEqual({
      type: 'historicalPath',
      from: '2011-08-01',
      to: '2026-08-01',
      tileMode: 'repeat',
    });
    expect(base.startMonth).toBe('2011-08');
  });

  it('백테스트 + 고정 수익률도 왕복에서 시작월이 흔들리지 않는다', () => {
    const original = parseSimulationQuery(
      params('mode=backtest&src=cagr&r=8&from=2011-08-01'),
      CONTEXT,
    );
    const roundTripped = parseSimulationQuery(serializeSimulationQuery(original), CONTEXT);
    expect(roundTripped).toEqual(original);
    expect(roundTripped.base.startMonth).toBe('2011-08');
  });
});

describe('parseSimulationQuery — 제거된 레거시 파라미터', () => {
  it('탭 시절의 target=은 조용히 무시된다', () => {
    const { base } = parseSimulationQuery(params('p=1000&target=30000'), CONTEXT);
    expect(base.initialAmount).toBe(10_000_000);
  });

  it('탭 시절의 scenarios=는 조용히 무시되고 exp만 본다', () => {
    const query = parseSimulationQuery(
      params('exp=SP500_2X&scenarios=%EC%8B%9C%EB%82%98%EB%A6%AC%EC%98%A4%20A;NASDAQ100_1X'),
      CONTEXT,
    );
    expect(query.exposures).toEqual(['SP500_2X']);
  });

  it('직렬화 결과에 레거시 파라미터가 남지 않는다', () => {
    const serialized = serializeSimulationQuery(
      parseSimulationQuery(params('target=30000&scenarios=A;SP500_1X'), CONTEXT),
    );
    expect(serialized.has('target')).toBe(false);
    expect(serialized.has('scenarios')).toBe(false);
  });
});

describe('왕복 — parse(serialize(x)) === x', () => {
  it('노출 하나로 왕복한다', () => {
    const query = parseSimulationQuery(
      params('p=1000&m=100&y=10&exp=NASDAQ100_3X&src=cagr&r=8'),
      { today: '2026-08-19' },
    );
    expect(query.exposures).toEqual(['NASDAQ100_3X']);
    expect(query.base.years).toBe(10);

    const serialized = serializeSimulationQuery(query);
    expect(serialized.get('exp')).toBe('NASDAQ100_3X');
    expect(serialized.get('mode')).toBe('future');
    expect(serialized.has('alloc')).toBe(false);
    expect(serialized.has('fx')).toBe(false);
  });

  it('노출 여러 개가 순서까지 그대로 복원된다', () => {
    const original = parseSimulationQuery(
      params('mode=backtest&exp=SP500_3X,NASDAQ100_1X&from=2011-08-01&to=2026-08-01'),
      CONTEXT,
    );
    const roundTripped = parseSimulationQuery(serializeSimulationQuery(original), CONTEXT);
    expect(roundTripped).toEqual(original);
    expect(roundTripped.exposures).toEqual(['SP500_3X', 'NASDAQ100_1X']);
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
    const serialized = serializeSimulationQuery(
      parseSimulationQuery(params('mg=7&src=cagr&r=8'), CONTEXT),
    );
    expect(serialized.get('mg')).toBe('7');
    expect(serialized.get('r')).toBe('8');
  });
});
