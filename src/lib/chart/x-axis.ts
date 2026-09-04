/**
 * 세로로 나란히 놓인 두 차트(상품 가격 추이·내 자산 추이)가 같은 x축 틱을 쓰게 한다.
 *
 * 두 차트는 해상도가 다르다 — 가격은 일별('YYYY-MM-DD'), 자산은 월별('YYYY-MM').
 * 그래도 덮는 기간이 같으므로, 틱을 "값이 있는 첫 항목"으로 잡으면 두 축이 같은
 * 시점에 같은 라벨을 찍는다. 해상도가 아니라 라벨 규칙을 공유하는 게 요점이다.
 *
 * 두 포맷의 앞 7글자가 'YYYY-MM'으로 같다는 점만 쓰므로 어느 쪽이든 그대로 넘기면 된다.
 */

/** 이 기간을 넘으면 월 라벨을 포기하고 연도 라벨만 남긴다 — 10~20년 구간에서
 *  매달 라벨을 다 보여주면 겹쳐서 읽을 수 없다. */
const LONG_RANGE_THRESHOLD_MONTHS = 36;

function yearOf(value: string): string {
  return value.slice(0, 4);
}

function monthOf(value: string): string {
  return value.slice(0, 7);
}

function monthIndexOf(value: string): number {
  return Number(value.slice(0, 4)) * 12 + Number(value.slice(5, 7));
}

/**
 * 구간이 덮는 개월 수. 행 개수가 아니라 첫 값과 끝 값의 거리로 잰다 —
 * 일별이든 월별이든, 다운샘플링으로 행이 솎여 나갔든 같은 답이 나와야 한다.
 */
function spanMonths(xValues: readonly string[]): number {
  return monthIndexOf(xValues[xValues.length - 1]) - monthIndexOf(xValues[0]) + 1;
}

/**
 * 그룹(연 또는 월)이 바뀌는 첫 항목만 남긴다. 오름차순 정렬된 시계열을 전제한다.
 *
 * "1월인 항목"이 아니라 "그 해의 첫 항목"인 이유는 일별 축 때문이다 — 일별에서
 * 1월을 필터로 잡으면 1월의 거래일 21개가 전부 틱이 되고, 반대로 '01-01'을 찾으면
 * 휴장일이라 아예 없다. 첫 항목 규칙은 두 해상도에서 모두 연도당 정확히 하나를 낸다.
 */
export function firstOfEachGroup(xValues: readonly string[], groupOf: (value: string) => string): string[] {
  const ticks: string[] = [];
  let previousGroup: string | null = null;
  for (const value of xValues) {
    const group = groupOf(value);
    if (group === previousGroup) continue;
    previousGroup = group;
    ticks.push(value);
  }
  return ticks;
}

/**
 * 축이 실제로 그릴 라벨 개수의 목표치.
 *
 * 우리가 미리 솎아내는 이유는 recharts에 맡길 수 없기 때문이다. 카테고리 축은 틱
 * 위치를 날짜가 아니라 **배열 인덱스**로 잡으므로, 같은 틱 배열을 넘겨도 포인트 수가
 * 다른 두 차트(가격 약 400~800개 vs 자산 20~360개)에서 minTickGap 충돌 판정이 다르게
 * 나고, 결국 서로 다른 부분집합이 남는다 — 위는 3·7·10월, 아래는 5·9월 식으로 갈렸다.
 *
 * 6은 흔한 차트 폭에서 'YYYY-MM'(약 55px) 여섯 개가 겹치지 않고 들어가는 수다.
 * 좁은 화면까지 맞춰야 하면 dateAxisProps의 targetTickCount로 낮춰 넘기면 된다.
 */
export const TARGET_TICK_COUNT = 6;

/**
 * 후보 중 목표 개수만큼만 남긴다. 끝에서부터 같은 간격으로 고르므로 마지막 시점은
 * 항상 라벨을 받는다 — 두 차트가 같은 기간을 덮어 후보 목록이 같으니, 같은 규칙을
 * 적용하면 같은 라벨 집합이 나온다.
 */
export function thinToTarget(candidates: readonly string[], targetTickCount: number): string[] {
  const stride = Math.max(Math.ceil(candidates.length / targetTickCount), 1);
  const kept: string[] = [];
  for (let i = candidates.length - 1; i >= 0; i -= stride) kept.push(candidates[i]);
  return kept.reverse();
}

/**
 * 이 구간에 쓸 라벨 그룹 규칙을 고른다. 구간이 길면 연도, 짧으면 월이다.
 *
 * dateAxisProps 안에 있던 판단을 꺼낸 것이다 — canvas 재생 차트는 축이 매 프레임
 * 확장되므로 recharts 전용 반환형(DateAxisProps)이 아니라 규칙 자체가 필요하다.
 * 빈 배열이면 구간을 잴 수 없으므로 월 단위로 폴백한다(dateAxisProps는 애초에
 * 빈 배열을 만나면 이 함수를 부르지 않는다).
 */
export function labelGroupOf(xValues: readonly string[]): (value: string) => string {
  if (xValues.length === 0) return monthOf;
  return spanMonths(xValues) > LONG_RANGE_THRESHOLD_MONTHS ? yearOf : monthOf;
}

/** recharts XAxis에 그대로 펼쳐 넣는 틱 설정 */
export type DateAxisProps = {
  ticks: string[] | undefined;
  tickFormatter: ((value: string) => string) | undefined;
  /** 0 = 넘긴 틱을 하나도 빼지 말고 그대로 그려라 */
  interval: 0 | undefined;
};

/**
 * 시계열 x값 목록에서 축 틱 설정을 만든다. `<XAxis {...dateAxisProps(xValues)} />`처럼 쓴다.
 *
 * 틱을 한 곳에서 만드는 이유는 두 차트가 갈라지지 않게 하려는 것이다 — 예전에는
 * 자산 차트만 연도 라벨을 쓰고 가격 차트는 recharts 기본값(풀 날짜를 임의 간격으로)을
 * 써서, 같은 기간을 덮는 두 축의 라벨 형식도 위치도 서로 달랐다.
 *
 * 라벨 형식·후보 선정·솎아내기까지 전부 여기서 끝내고 interval 0으로 넘긴다 —
 * 어느 하나라도 recharts에 맡기면 포인트 수가 다른 두 차트에서 결과가 갈린다
 * (TARGET_TICK_COUNT 주석 참고).
 *
 * 다운샘플링을 거치는 차트는 반드시 **솎아낸 뒤의 배열**을 넘겨야 한다. x축이 카테고리
 * 축이라 ticks의 각 값이 축에 실제로 남아 있는 라벨이어야 하고, 아니면 그 틱은 그냥
 * 사라진다(SimLineChart의 ReferenceArea가 같은 제약을 받는다). 대가로 틱 위치가 원본
 * 기준 최대 한 버킷만큼 밀릴 수 있다(30년 기준 한 달 남짓, 1px 미만).
 *
 * 남는 오차: 카테고리 축은 틱을 인덱스로 배치하므로, 포인트 수가 다른 두 차트에서
 * 같은 라벨이 서로 몇 px 어긋날 수 있다(1300px 폭 기준 3px 안팎). 이걸 0으로 만들려면
 * 축을 시간축(type="number" + 공유 domain)으로 바꿔야 한다.
 */
export function dateAxisProps(
  xValues: readonly string[],
  targetTickCount: number = TARGET_TICK_COUNT,
): DateAxisProps {
  if (xValues.length === 0) return { ticks: undefined, tickFormatter: undefined, interval: undefined };

  const groupOf = labelGroupOf(xValues);
  // 라벨을 그룹 키로 그대로 쓴다 — 연도 틱은 '2020', 월 틱은 '2020-07'이 되고,
  // 월별 데이터에서는 원래 값과 같아 예전 표시와 달라지지 않는다.
  return {
    ticks: thinToTarget(firstOfEachGroup(xValues, groupOf), targetTickCount),
    tickFormatter: groupOf,
    interval: 0,
  };
}
