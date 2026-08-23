import { BACKFILL_START } from '../data/catalog';
import type { ReturnSource, SimulationInputBase } from './types';

/**
 * 백테스트 모드에서 성립하지 않는 고정 수익률을 과거 구간 재생으로 바꾼다.
 *
 * 백테스트는 실제 과거 구간을 걷는 모드라 engine이 고정 수익률을 무시하고
 * RETURN_SOURCE_IGNORED 경고를 낸다. 그런데 UI는 백테스트에서 수익률 소스 토글을
 * 감추므로, 그 조합이 들어오면 사용자가 해소할 방법이 없는 경고만 남는다 — 손으로
 * 고친 공유 링크가 그 상태로 착지하는 것을 파싱 단계에서 막는다(§11 "에러 화면을
 * 띄우지 않는다").
 *
 * url/schema.ts의 parseSimulationQuery도 같은 규칙을 적용한다 — 왕복
 * (parse(serialize(x)) === x)이 그것에 의존한다: startMonth는 from에서
 * 파생되는데 직렬화는 historicalPath일 때만 from을 싣기 때문에, 백테스트 + 고정
 * 수익률 조합이 남아 있으면 재파싱에서 startMonth가 BACKFILL_START로 튄다.
 *
 * 이 함수는 원래 url/schema.ts에 있었다 — sim/이 url/을 참조하는 유일한 예외였고,
 * zod를 포함한 URL 파서 전체를 순수 도메인 규칙 하나가 끌어오게 만들었다. 도메인
 * 규칙이므로 이제 여기(sim/)에 두고, url/schema.ts가 여기서 import한다 — 코드베이스가
 * 지키는 한 방향 의존(url → sim)이 이 지점에서도 성립한다.
 */
export function coerceBacktestReturnSource(
  source: ReturnSource,
  window: { from: string; to: string },
): ReturnSource {
  if (source.type === 'historicalPath') return source;
  return { type: 'historicalPath', from: window.from, to: window.to, tileMode: 'repeat' };
}

/**
 * 모드를 바꾸면서 입력을 그 모드에서 유효한 상태로 맞춘다.
 *
 * 백테스트는 실제 과거 구간을 그대로 걷는 모드라 고정 수익률이 성립하지 않고,
 * engine이 RETURN_SOURCE_IGNORED 경고를 낸다. 그런데 백테스트 모드에서는 수익률
 * 소스 UI 자체를 감추므로, 그 조합으로 넘어가면 사용자가 해소할 방법이 없는 경고만
 * 남는다 — 전환 시점에 과거 구간 재생으로 바꿔준다. 데이터를 불러오지 않아도
 * 결정되는 값(BACKFILL_START ~ today)만 쓰므로 이 함수는 순수하게 유지된다.
 *
 * startMonth는 여기서 계산하지 않는다. 직렬화 대상이 아니고(url/schema.ts) URL
 * 왕복 과정에서 mode·from으로부터 다시 파생되므로, 손대면 같은 값을 두 곳에서
 * 계산하게 된다.
 *
 * 백테스트 모드에서 고정 수익률 → 과거 구간 재생 변환은 parseSimulationQuery도
 * 같은 규칙을 적용하므로(coerceBacktestReturnSource 사용), 이 함수도 그 헬퍼를
 * 거쳐 변환한다. 그렇게 규칙이 한 곳에만 존재한다.
 */
export function applyMode(
  base: SimulationInputBase,
  mode: SimulationInputBase['mode'],
  today: string,
): SimulationInputBase {
  if (mode !== 'backtest') return { ...base, mode };
  return {
    ...base,
    mode,
    returnSource: coerceBacktestReturnSource(base.returnSource, {
      from: BACKFILL_START,
      to: today,
    }),
  };
}
