/** 버킷 하나에서 시리즈 하나의 극값 위치를 추적하는 스크래치 값 */
type Extremum = { minIndex: number; minValue: number; maxIndex: number; maxValue: number };

function emptyExtremum(): Extremum {
  return { minIndex: -1, minValue: Infinity, maxIndex: -1, maxValue: -Infinity };
}

/**
 * 극값을 보존하며 시계열 행을 화면 해상도만큼 솎아낸다.
 *
 * 30년 일별(약 7,500행)을 900px 차트에 그대로 그리면 픽셀당 8행이라, 8행 중 7행은
 * 같은 픽셀에 겹쳐 사라진다. 그런데 "균등하게 N행마다 하나"로 솎으면 하필 그날 안
 * 뽑혔다는 이유로 폭락 저점이 통째로 없어진다 — 월별 스냅샷 차트가 MDD를 못 보여주던
 * 것과 같은 실패다(engine.ts buildDailyDrawdown 주석 참고).
 *
 * 그래서 구간을 버킷으로 나눈 뒤 각 버킷에서 **최고 행과 최저 행을 둘 다** 남긴다.
 * 그러면 "어느 구간을 보든 남은 행들의 세로 범위 = 원본의 세로 범위"가 되어,
 * 전역 최고점·최저점이 절대 탈락하지 않는다. 차트에서 읽는 낙폭과 카드의 MDD가
 * 어긋나지 않는 근거가 이 성질이다.
 *
 * 값을 가공하지 않고 **원본 행을 골라서 낸다** — 그래서 툴팁에 뜨는 값은 언제나
 * 실제로 존재했던 날짜의 실제 값이지 보간값이 아니다.
 *
 * @param valuesOf 한 행에서 시리즈별 값을 꺼낸다. 시리즈 개수는 첫 행으로 정한다
 *                 (비교 모드처럼 열이 여러 개면 각 시리즈의 극값을 모두 남긴다).
 * @param maxPoints 목표 상한. 첫 행과 마지막 행은 극값이 아니어도 항상 포함하므로
 *                  실제 출력은 최대 maxPoints + 2개다. 원본이 이미 이 이하면 그대로 낸다.
 */
export function downsampleExtrema<T>(
  rows: readonly T[],
  valuesOf: (row: T) => readonly (number | null)[],
  maxPoints: number,
): T[] {
  if (rows.length <= maxPoints) return [...rows];

  const seriesCount = Math.max(valuesOf(rows[0]).length, 1);
  // 버킷마다 시리즈당 최대 2행(최고·최저)이 남으므로, 상한을 지키려면 버킷 수를
  // 시리즈 개수로 다시 나눠야 한다.
  const bucketCount = Math.max(Math.floor(maxPoints / (2 * seriesCount)), 1);
  const bucketSize = rows.length / bucketCount;

  // 서로 다른 시리즈가 같은 행을 극값으로 지목할 수 있어 집합으로 모은다.
  const keep = new Set<number>([0, rows.length - 1]);

  for (let bucket = 0; bucket < bucketCount; bucket += 1) {
    const from = Math.floor(bucket * bucketSize);
    const to = Math.min(Math.floor((bucket + 1) * bucketSize), rows.length);
    const extrema = Array.from({ length: seriesCount }, emptyExtremum);

    for (let i = from; i < to; i += 1) {
      const values = valuesOf(rows[i]);
      for (let s = 0; s < seriesCount; s += 1) {
        const value = values[s];
        // null(그 시리즈에 그 날짜 값이 없음)과 NaN(데이터 구멍)은 극값 후보가 아니다
        if (value === null || value === undefined || !Number.isFinite(value)) continue;
        if (value < extrema[s].minValue) {
          extrema[s].minValue = value;
          extrema[s].minIndex = i;
        }
        if (value > extrema[s].maxValue) {
          extrema[s].maxValue = value;
          extrema[s].maxIndex = i;
        }
      }
    }

    // 버킷 전체가 null인 시리즈는 남길 행이 없다(minIndex가 -1로 남는다)
    for (const { minIndex, maxIndex } of extrema) {
      if (minIndex !== -1) keep.add(minIndex);
      if (maxIndex !== -1) keep.add(maxIndex);
    }
  }

  return [...keep].sort((a, b) => a - b).map((index) => rows[index]);
}

/**
 * 차트 하나가 한 번에 그릴 점의 상한.
 *
 * ResponsiveContainer라 실제 픽셀 폭을 렌더 전에 알 수 없어 상수로 둔다. 800이면
 * 흔한 차트 폭(900~1200px)에서 픽셀당 1점 이하라, 더 그려 봐야 같은 픽셀에 겹칠 뿐이다.
 * 폭에 맞춰 동적으로 정해야 할 이유(초광폭 모니터에서 더 촘촘히 등)가 생기면
 * downsampleByKeys의 maxPoints 인자로 올려 보내면 된다.
 */
export const MAX_RENDERED_POINTS = 800;

/**
 * wide 포맷 행(한 행 = 한 날짜, 시리즈마다 열 하나)에 극값 보존 다운샘플링을 건다.
 * SimLineChart가 series의 key 목록을 그대로 넘겨 쓴다.
 *
 * 숫자가 아닌 열(x 라벨, isSynthetic 등)이 key로 섞여 들어와도 null로 취급해 건너뛴다 —
 * 값 열과 메타 열이 같은 행에 섞여 있는 포맷이라 방어한다.
 */
export function downsampleByKeys<T extends Record<string, unknown>>(
  rows: readonly T[],
  keys: readonly string[],
  maxPoints: number = MAX_RENDERED_POINTS,
): T[] {
  return downsampleExtrema(
    rows,
    (row) =>
      keys.map((key) => {
        const value = row[key];
        return typeof value === 'number' ? value : null;
      }),
    maxPoints,
  );
}
