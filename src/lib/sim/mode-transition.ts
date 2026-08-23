import { BACKFILL_START } from '../data/catalog';
import { coerceBacktestReturnSource } from '../url/schema';
import type { SimulationInputBase } from './types';

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
