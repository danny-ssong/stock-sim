import { BACKFILL_START } from '../data/catalog';

/** 'YYYY-MM' 또는 'YYYY-MM-DD'를 0년 1월 기준 절대 월 인덱스로 바꾼다. */
function monthIndex(date: string): number {
  return Number(date.slice(0, 4)) * 12 + (Number(date.slice(5, 7)) - 1);
}

/**
 * startMonth부터 lastAvailableDate까지 실제로 시뮬할 수 있는 개월 수.
 *
 * 백테스트 구간 길이의 기준값은 연이 아니라 이 개월 수다. 연 단위로 내림하면
 * 시작월에 따라 최신 데이터가 최대 11개월까지 통째로 사라지는데(2021-11 시작이면
 * 2025-10에서 끊기는 식), 어느 프리셋이 얼마나 잘리는지가 순전히
 * `(마지막월 - 시작월 + 1) % 12`에 달려 있어 사용자에게는 무작위로 보인다.
 */
export function maxBacktestMonths(startMonth: string, lastAvailableDate: string): number {
  return Math.max(0, monthIndex(lastAvailableDate) - monthIndex(startMonth) + 1);
}

/**
 * 데이터 끝까지 가려면 연 단위 입력(`input.years`)으로 몇 년을 골라야 하는가 — 올림.
 *
 * 기간 입력이 정수 연이라 잔여 개월을 그대로 표현할 수 없다. 내림값을 고르면
 * 잔여 개월이 통째로 빠지므로, 올림값을 골라 엔진의 개월 클램프
 * (engine.ts resolvePeriodMonths)가 데이터 끝에서 정확히 자르게 한다.
 * 그래서 기간 슬라이더의 상한과 시작 시점 프리셋이 넘기는 연수가 모두 이 값이다.
 */
export function backtestYearsToDataEnd(startMonth: string, lastAvailableDate: string): number {
  return Math.max(1, Math.ceil(maxBacktestMonths(startMonth, lastAvailableDate) / 12));
}

/**
 * dataset을 아직 모르는 시점(URL 파싱, 데이터 로딩 중 UI)에서 쓰는 백테스트 기간 상한.
 *
 * 데이터가 있을 수 있는 최대 구간은 BACKFILL_START부터 오늘까지이므로 그것이 곧
 * 상한이다. 예전에는 고정 30년이었는데, 데이터는 1995년부터 쌓이므로 2025년을
 * 넘긴 시점에는 이 상수 자체가 최신 구간을 잘라내는 원인이 됐다 — "데이터 시작"
 * 프리셋이 2024-12에서 멈추고 그 격차가 해마다 1년씩 벌어졌다.
 *
 * 실제 데이터는 이보다 짧을 수 있으므로, dataset을 아는 곳에서는
 * backtestYearsToDataEnd()로 다시 좁히고 최종적으로 엔진이 개월 단위로 자른다.
 */
export function backtestYearsCap(today: string): number {
  return backtestYearsToDataEnd(BACKFILL_START.slice(0, 7), today);
}

/**
 * startMonth부터 lastAvailableDate까지 온전히 채울 수 있는 최대 연수(내림).
 *
 * 실제 시뮬 구간 길이는 maxBacktestMonths가 정한다 — 이 함수는 "몇 년 가능한가"를
 * 연 단위 UI(기간 슬라이더 상한, 시작 시점 프리셋 라벨)에 보여주기 위한 표시용이다.
 *
 * 12개월 미만이면 0을 반환한다 — `input.years`는 항상 1 이상의 정수이므로
 * (url/schema.ts에서 `Math.max(1, Math.min(30, Math.round(...)))`로 클램프됨),
 * 호출부가 `input.years > maxBacktestYears(...)`로 비교하면 0인 경우도 자연히
 * "불가능"으로 걸러진다. 여기서 최소 1로 올림하면 "1년까지는 가능하다"는 거짓
 * 신호를 줘 buildBacktestCalendar가 크래시하는 조합을 통과시키게 된다.
 */
export function maxBacktestYears(startMonth: string, lastAvailableDate: string): number {
  return Math.floor(maxBacktestMonths(startMonth, lastAvailableDate) / 12);
}

/**
 * 백테스트를 **아예 계산할 수 없는** 조합인지 판정한다. 계산할 수 있으면 true.
 *
 * 여기서 막는 것은 `buildBacktestCalendar`(calendar.ts)가 빈 달을 만나 던질
 * 크래시뿐이다 — "기간이 데이터보다 길다"는 크래시가 아니라 조정 가능한
 * 상황이므로 여기서 막지 않는다. `simulate()`가 데이터 끝에 맞춰 개월 단위로 자른다(engine.ts).
 *
 * 예전 `backtestYearsShortfall`은 그 경우까지 화면 전체를 대체해, 엔진의
 * soft-clamp 경로를 UI에서 도달 불가능하게 만들고 있었다. 그 하드 게이트 때문에
 * BacktestYearsInput이 years를 URL에 되써야 했고(손실적 클램프), 그게 슬라이더
 * 드래그마다 커밋을 두 배로 만들던 원인이다.
 *
 * 미래 모드는 데이터 범위와 무관하므로 항상 true다.
 */
export function hasBacktestRange(
  input: { mode: 'future' | 'backtest'; startMonth: string },
  dates: readonly string[],
): boolean {
  if (input.mode !== 'backtest') return true;
  if (dates.length === 0) return false;

  // 데이터 첫 월보다 이른 시작월은 첫 달부터 거래일이 없어 크래시한다.
  if (input.startMonth < dates[0].slice(0, 7)) return false;

  // 1년도 채우지 못하면 엔진이 클램프하지 않는다(engine.ts는 available >= 1일 때만
  // 줄인다) — 그대로 두면 buildBacktestCalendar가 빈 달을 만난다.
  return maxBacktestYears(input.startMonth, dates[dates.length - 1]) >= 1;
}
