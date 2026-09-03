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
function firstOfEachGroup(xValues: readonly string[], groupOf: (value: string) => string): string[] {
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

/** recharts XAxis에 그대로 펼쳐 넣는 틱 설정 */
export type DateAxisProps = {
  ticks: string[] | undefined;
  tickFormatter: ((value: string) => string) | undefined;
};

/**
 * 시계열 x값 목록에서 축 틱 설정을 만든다. `<XAxis {...dateAxisProps(xValues)} />`처럼 쓴다.
 *
 * 틱을 한 곳에서 만드는 이유는 두 차트가 갈라지지 않게 하려는 것이다 — 예전에는
 * 자산 차트만 연도 라벨을 쓰고 가격 차트는 recharts 기본값(풀 날짜를 임의 간격으로)을
 * 써서, 같은 기간을 덮는 두 축의 라벨 형식도 위치도 서로 달랐다.
 *
 * 다운샘플링을 거치는 차트는 반드시 **솎아낸 뒤의 배열**을 넘겨야 한다. x축이 카테고리
 * 축이라 ticks의 각 값이 축에 실제로 남아 있는 라벨이어야 하고, 아니면 그 틱은 그냥
 * 사라진다(SimLineChart의 ReferenceArea가 같은 제약을 받는다). 대가로 틱 위치가 원본
 * 기준 최대 한 버킷만큼 밀릴 수 있다(30년 기준 한 달 남짓, 1px 미만).
 */
export function dateAxisProps(xValues: readonly string[]): DateAxisProps {
  if (xValues.length === 0) return { ticks: undefined, tickFormatter: undefined };

  const yearOnly = spanMonths(xValues) > LONG_RANGE_THRESHOLD_MONTHS;
  const groupOf = yearOnly ? yearOf : monthOf;
  // 라벨을 그룹 키로 그대로 쓴다 — 연도 틱은 '2020', 월 틱은 '2020-07'이 되고,
  // 월별 데이터에서는 원래 값과 같아 예전 표시와 달라지지 않는다.
  return { ticks: firstOfEachGroup(xValues, groupOf), tickFormatter: groupOf };
}
