/**
 * 노출 비교 오버레이가 노출마다 겹쳐 그리는 선의 색이다. 계좌별 색상
 * (구 ACCOUNT_COLORS)은 계좌가 하나뿐이라 더 이상 구분할 대상이 없어져
 * 노출 순번 기반으로 바뀌었다(스펙 §5).
 */
const SERIES_COLORS: readonly string[] = ['#2563eb', '#d97706', '#16a34a', '#dc2626'];

export function scenarioColor(index: number): string {
  return SERIES_COLORS[index % SERIES_COLORS.length];
}
