export type SyntheticRange = { x1: string; x2: string };

/**
 * 연속된 합성 구간을 [시작 라벨, 끝 라벨] 범위로 묶는다.
 * 차트의 해칭 배경 영역(§8 "합성 데이터 표기")에 쓴다 — 포인트 하나하나에
 * ReferenceArea를 그리면 성능·가독성이 나빠지므로 연속 구간을 미리 병합한다.
 */
export function findSyntheticRanges(
  points: Array<{ label: string; isSynthetic: boolean }>,
): SyntheticRange[] {
  const ranges: SyntheticRange[] = [];
  let start: string | null = null;

  for (let i = 0; i < points.length; i += 1) {
    if (points[i].isSynthetic && start === null) start = points[i].label;
    if (!points[i].isSynthetic && start !== null) {
      ranges.push({ x1: start, x2: points[i - 1].label });
      start = null;
    }
  }
  if (start !== null) ranges.push({ x1: start, x2: points[points.length - 1].label });

  return ranges;
}
