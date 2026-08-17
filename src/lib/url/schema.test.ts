import { describe, it, expect } from 'vitest';
import {
  parseSimulationQuery,
  serializeSimulationQuery,
  V1_AVAILABLE_EXPOSURES,
  type QueryContext,
} from './schema';

const CONTEXT: QueryContext = {
  mode: 'future',
  today: '2026-08-17',
  defaultFixedFxRate: 1400,
};

function params(query: string): URLSearchParams {
  return new URLSearchParams(query);
}

describe('parseSimulationQuery — 금액 단위', () => {
  it('p·m은 만원 단위를 원 단위로 환산한다', () => {
    const { input } = parseSimulationQuery(params('p=1000&m=500'), CONTEXT);
    expect(input.initialAmount).toBe(10_000_000);
    expect(input.contribution.base).toBe(5_000_000);
  });

  it('값이 없으면 기본값을 쓴다', () => {
    const { input } = parseSimulationQuery(params(''), CONTEXT);
    expect(input.initialAmount).toBe(0);
    expect(input.contribution.base).toBe(500_000);
    expect(input.years).toBe(15);
  });

  it('숫자가 아닌 값은 기본값으로 폴백한다 — 에러를 던지지 않는다', () => {
    const { input } = parseSimulationQuery(params('p=abc&y=xyz'), CONTEXT);
    expect(input.initialAmount).toBe(0);
    expect(input.years).toBe(15);
  });
});

describe('parseSimulationQuery — anchor', () => {
  it('연차:값(만원) 쌍을 파싱한다', () => {
    const { input } = parseSimulationQuery(params('ma=4:1000,9:1500'), CONTEXT);
    expect(input.contribution.anchors).toEqual({ 4: 10_000_000, 9: 15_000_000 });
  });

  it('깨진 쌍만 버리고 나머지는 유지한다', () => {
    const { input } = parseSimulationQuery(params('ma=4:1000,x:y,9:1500'), CONTEXT);
    expect(input.contribution.anchors).toEqual({ 4: 10_000_000, 9: 15_000_000 });
  });

  it('ia도 같은 방식으로 근로소득 anchor를 채운다', () => {
    const { input } = parseSimulationQuery(params('ia=5:9000'), CONTEXT);
    expect(input.employmentIncome.anchors).toEqual({ 5: 90_000_000 });
  });
});

describe('parseSimulationQuery — 노출과 배분', () => {
  it('exp 하나를 모든 배분 원소에 씌운다(D1)', () => {
    const { input } = parseSimulationQuery(
      params('alloc=ISA:60,DIRECT_US:40&exp=NASDAQ100_2X'),
      CONTEXT,
    );
    expect(input.allocations).toEqual([
      { accountId: 'ISA', exposure: 'NASDAQ100_2X', weight: 0.6 },
      { accountId: 'DIRECT_US', exposure: 'NASDAQ100_2X', weight: 0.4 },
    ]);
  });

  it('비중 합이 100이 아니면 정규화한다', () => {
    const { input } = parseSimulationQuery(params('alloc=ISA:30,DIRECT_US:30'), CONTEXT);
    const total = input.allocations.reduce((sum, a) => sum + a.weight, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it('배당 노출(US_DIVIDEND_100)은 v1에서 걸러 기본값으로 폴백한다', () => {
    const { input } = parseSimulationQuery(params('exp=US_DIVIDEND_100'), CONTEXT);
    expect(input.allocations[0].exposure).toBe('NASDAQ100_1X');
    expect(V1_AVAILABLE_EXPOSURES).not.toContain('US_DIVIDEND_100');
  });

  it('배분이 비어 있으면 ISA 100%를 기본값으로 쓴다', () => {
    const { input } = parseSimulationQuery(params(''), CONTEXT);
    expect(input.allocations).toEqual([
      { accountId: 'ISA', exposure: 'NASDAQ100_1X', weight: 1 },
    ]);
  });
});

describe('parseSimulationQuery — 수익률 소스와 시작월(D3)', () => {
  it('src=cagr면 r을 연 수익률로 쓴다', () => {
    const { input } = parseSimulationQuery(params('src=cagr&r=7'), CONTEXT);
    expect(input.returnSource).toEqual({ type: 'constantCagr', annualRate: 0.07 });
  });

  it('src=path(기본)면 from~to를 참조 구간으로 쓴다', () => {
    const { input } = parseSimulationQuery(
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
    const { input } = parseSimulationQuery(params(''), CONTEXT);
    expect(input.startMonth).toBe('2026-08');
  });

  it('백테스트 모드는 시작월을 from에서 가져온다(D3)', () => {
    const { input } = parseSimulationQuery(params('from=2011-08-15'), {
      ...CONTEXT,
      mode: 'backtest',
    });
    expect(input.startMonth).toBe('2011-08');
    expect(input.mode).toBe('backtest');
  });
});

describe('parseSimulationQuery — 환율 가정(D2)', () => {
  it('fx=fixed는 defaultFixedFxRate를 쓴다', () => {
    const { input } = parseSimulationQuery(params('fx=fixed'), CONTEXT);
    expect(input.fxAssumption).toEqual({ type: 'fixed', rate: 1400 });
  });

  it('fx=path는 historicalPath다', () => {
    const { input } = parseSimulationQuery(params('fx=path'), CONTEXT);
    expect(input.fxAssumption).toEqual({ type: 'historicalPath' });
  });

  it('fx=drift:2.0은 연 2% 상승 가정이다', () => {
    const { input } = parseSimulationQuery(params('fx=drift:2.0'), CONTEXT);
    expect(input.fxAssumption).toEqual({ type: 'drift', annualRate: 0.02 });
  });

  it('탭별 기본값이 다르다 — 미래는 fixed, 백테스트는 path', () => {
    const future = parseSimulationQuery(params(''), CONTEXT);
    const backtest = parseSimulationQuery(params(''), { ...CONTEXT, mode: 'backtest' });
    expect(future.input.fxAssumption.type).toBe('fixed');
    expect(backtest.input.fxAssumption.type).toBe('historicalPath');
  });
});

describe('parseSimulationQuery — 나머지 플래그', () => {
  it('harvest 기본값은 켜짐이다', () => {
    const { input } = parseSimulationQuery(params(''), CONTEXT);
    expect(input.realizationStrategy).toEqual({ type: 'annualDeductionHarvest' });
  });

  it('harvest=0이면 끈다', () => {
    const { input } = parseSimulationQuery(params('harvest=0'), CONTEXT);
    expect(input.realizationStrategy).toEqual({ type: 'holdUntilExit' });
  });

  it('cur=USD를 인식하고 그 외는 KRW로 폴백한다', () => {
    expect(parseSimulationQuery(params('cur=USD'), CONTEXT).input.displayCurrency).toBe('USD');
    expect(parseSimulationQuery(params('cur=???'), CONTEXT).input.displayCurrency).toBe('KRW');
  });

  it('target이 없으면 null이다', () => {
    expect(parseSimulationQuery(params(''), CONTEXT).target).toBeNull();
  });

  it('target=30000(만원)은 3억원이다', () => {
    expect(parseSimulationQuery(params('target=30000'), CONTEXT).target).toBe(300_000_000);
  });
});

describe('왕복 — parse(serialize(x)) === x (테스트 케이스 #20)', () => {
  it('일반적인 입력이 그대로 복원된다', () => {
    const original = parseSimulationQuery(
      params(
        'p=1000&m=500&mg=5&ma=4:1000,9:1500&inc=6000&ig=5&ia=5:9000' +
          '&y=15&alloc=ISA:60,DIRECT_US:40&exp=NASDAQ100_2X' +
          '&src=path&from=2011-08-01&to=2026-08-01&harvest=1&cur=KRW&target=30000',
      ),
      CONTEXT,
    );

    const roundTripped = parseSimulationQuery(
      serializeSimulationQuery(original),
      CONTEXT,
    );

    expect(roundTripped).toEqual(original);
  });

  it('includeIncome: false는 소득 관련 키를 모두 제외한다', () => {
    const original = parseSimulationQuery(
      params('inc=6000&ig=5&ia=5:9000&base=8000'),
      CONTEXT,
    );

    const redacted = serializeSimulationQuery(original, { includeIncome: false });
    expect(redacted.has('inc')).toBe(false);
    expect(redacted.has('ig')).toBe(false);
    expect(redacted.has('ia')).toBe(false);
    expect(redacted.has('base')).toBe(false);

    const reparsed = parseSimulationQuery(redacted, CONTEXT);
    expect(reparsed.input.employmentIncome.base).toBe(manwonToKrwForTest(0));
  });
});

function manwonToKrwForTest(value: number): number {
  return value * 10_000;
}
