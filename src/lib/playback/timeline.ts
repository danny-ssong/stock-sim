import {
  TARGET_TICK_COUNT,
  firstOfEachGroup,
  labelGroupOf,
  thinToTarget,
} from '../chart/x-axis';

/**
 * 재생 차트가 그리는 점 하나.
 *
 * time(ms)을 함께 들고 다니는 이유는 성능이다 — 축 좌표 변환이 프레임마다 모든
 * 점에서 일어나므로, 그때마다 날짜 문자열을 파싱하면 초당 수십만 번 파싱하게 된다.
 * date는 헤드라인·툴팁 표시용으로 남긴다.
 */
export type PlaybackPoint = { date: string; time: number; value: number };

/** 오름차순으로 정렬된 시계열 하나 */
export type PlaybackSeries = { key: string; points: readonly PlaybackPoint[] };

/**
 * 한 프레임에서 시리즈 하나가 그릴 범위.
 *
 * 배열을 잘라 새로 만들지 않고 개수만 낸다 — 30년 일별이면 7,500점이고, 이걸
 * 초당 60번 slice하면 복사만으로 프레임 예산을 갉아먹는다. 렌더러는
 * points[0..count-1]만 읽는다.
 */
export type VisibleSeries = { key: string; points: readonly PlaybackPoint[]; count: number };

export type PlaybackFrame = {
  /** 이 프레임이 가리키는 시점. 'YYYY-MM-DD'. 헤드라인에 그대로 쓴다 */
  date: string;
  time: number;
  visible: readonly VisibleSeries[];
};

export type TimelineBounds = { from: number; to: number };

/** 축에 그릴 라벨 하나 */
export type TimeTick = { time: number; label: string };

/**
 * 'YYYY-MM-DD' 또는 'YYYY-MM'을 UTC 밀리초로 읽는다.
 *
 * 월 표기('YYYY-MM')는 그 달의 1일로 본다 — 축 틱 라벨(labelGroupOf가 내는 연·월
 * 그룹 키)처럼 날짜가 아니라 월 단위로만 존재하는 값을 시간축에 얹을 때 쓴다.
 * Date.UTC를 쓰는 이유는 로컬 타임존이 끼면 같은 문자열이 환경마다 다른 값이 되기
 * 때문이다 — 여기서 필요한 건 절대 시각이 아니라 일관된 순서와 간격뿐이다.
 */
export function toTime(date: string): number {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = date.length >= 10 ? Number(date.slice(8, 10)) : 1;
  return Date.UTC(year, month - 1, day);
}

/** 도메인 행 목록을 재생 차트가 읽는 형태로 옮긴다 */
export function toPlaybackPoints<T>(
  rows: readonly T[],
  dateOf: (row: T) => string,
  valueOf: (row: T) => number,
): PlaybackPoint[] {
  return rows.map((row) => {
    const date = dateOf(row);
    return { date, time: toTime(date), value: valueOf(row) };
  });
}

/** 시리즈들이 함께 덮는 구간. 그릴 점이 하나도 없으면 null */
export function timelineBounds(series: readonly PlaybackSeries[]): TimelineBounds | null {
  let from = Infinity;
  let to = -Infinity;
  for (const one of series) {
    if (one.points.length === 0) continue;
    from = Math.min(from, one.points[0].time);
    to = Math.max(to, one.points[one.points.length - 1].time);
  }
  return Number.isFinite(from) && Number.isFinite(to) ? { from, to } : null;
}

/** time 이하인 마지막 점의 인덱스 + 1. 오름차순 정렬을 전제한 이진 탐색이다 */
function countUpTo(points: readonly PlaybackPoint[], time: number): number {
  let low = 0;
  let high = points.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (points[mid].time <= time) low = mid + 1;
    else high = mid;
  }
  return low;
}

/** UTC 밀리초를 'YYYY-MM-DD'로 되돌린다 */
export function toDateString(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

/**
 * 진행도(0~1)를 구간 안의 한 시점으로 옮기고, 시리즈마다 그 시점까지 그릴 개수를 낸다.
 *
 * 진행도를 배열 인덱스가 아니라 **날짜**로 옮기는 것이 요점이다 — 여러 트랙(가격·
 * 자산)이나 여러 노출을 함께 재생할 때 다운샘플링·데이터 구멍 등으로 트랙마다 점
 * 개수가 달라질 수 있는데, 인덱스로 진행하면 그 트랙들이 서로 다른 시점을 가리키게 된다.
 *
 * 값을 보간하지 않고 원본 점만 낸다 — 차트에 보이는 값은 언제나 실제로 존재했던
 * 날짜의 실제 값이다(lib/chart/downsample.ts와 같은 원칙).
 */
export function frameAt(
  series: readonly PlaybackSeries[],
  bounds: TimelineBounds,
  progress: number,
): PlaybackFrame {
  const clamped = Math.min(Math.max(progress, 0), 1);
  const time = bounds.from + (bounds.to - bounds.from) * clamped;
  return {
    date: toDateString(time),
    time,
    visible: series.map((one) => ({
      key: one.key,
      points: one.points,
      count: countUpTo(one.points, time),
    })),
  };
}

/**
 * 축 라벨 후보를 재생 시작 전에 한 번만 만든다.
 *
 * 확장 축이라 프레임마다 보이는 라벨이 달라지지만, **후보 목록 자체는 전체 구간
 * 기준으로 고정**이다. 프레임마다 전체 날짜 배열을 다시 훑으면 7,500개를 초당 60번
 * 순회하게 되므로, 여기서 수 개로 줄여두고 렌더러가 "현재 시점 이하"만 고른다.
 *
 * 그래서 재생 초반에는 라벨이 하나도 없거나 하나뿐이다 — 참고 영상과 같은 모습이다.
 *
 * 라벨 규칙은 정적 차트와 공유한다(lib/chart/x-axis.ts) — 같은 데이터를 보는 두
 * 차트가 서로 다른 축 형식을 쓰면 교대할 때 눈에 띈다.
 */
export function buildTimeTicks(dates: readonly string[]): TimeTick[] {
  if (dates.length === 0) return [];
  const groupOf = labelGroupOf(dates);
  const candidates = thinToTarget(firstOfEachGroup(dates, groupOf), TARGET_TICK_COUNT);
  return candidates.map((date) => ({ time: toTime(date), label: groupOf(date) }));
}
