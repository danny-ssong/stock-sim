'use client';

import type { PlaybackView } from '../../lib/url/schema';
import { SegmentedControl, type SegmentedOption } from '../ui/segmented-control';

const VIEWS: readonly SegmentedOption<PlaybackView>[] = [
  { value: 'default', label: '상세' },
  { value: 'shorts', label: '숏츠' },
];

/**
 * 표현 축. 입력 조건이 아니라 "같은 결과를 어떻게 볼 것인가"라서 입력 패널이 아니라
 * 결과 영역 위에 둔다 — ModeToggle(시점)과 역할이 다르다.
 *
 * 라벨이 바뀌는 단일 버튼이 아니라 세그먼트인 이유: 그쪽은 상태 전환이 아니라
 * 네비게이션처럼 읽힌다. view는 URL에 사는 2값 축이고 mode와 같은 성격이므로
 * 같은 시각 언어를 쓴다.
 */
export function ResultsToolbar({
  view,
  onViewChange,
}: {
  view: PlaybackView;
  onViewChange: (view: PlaybackView) => void;
}) {
  return (
    <div className="flex justify-end">
      <SegmentedControl label="보기" value={view} options={VIEWS} onChange={onViewChange} />
    </div>
  );
}
