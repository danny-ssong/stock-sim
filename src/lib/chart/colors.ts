/**
 * 탭 3(시나리오 비교)이 시나리오마다 겹쳐 그리는 선의 색이다. 계좌별 색상
 * (구 ACCOUNT_COLORS)은 계좌가 하나뿐이라 더 이상 구분할 대상이 없어져
 * 시나리오 순번 기반으로 바뀌었다(스펙 §5).
 */
export const SCENARIO_COLORS: readonly string[] = [
  '#2563eb', // A
  '#d97706', // B
  '#16a34a', // C
  '#dc2626', // D
];

export function scenarioColor(index: number): string {
  return SCENARIO_COLORS[index % SCENARIO_COLORS.length];
}
