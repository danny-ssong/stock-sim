'use client';

import type { ChartPlayback } from './use-chart-playback';
import { PlaybackScrubber, PlayButton } from './PlaybackScrubber';

/**
 * 재생 조작 한 줄. **차트 아래에 둔다** — 순수한 도구라서 결과(차트)보다 먼저 눈에
 * 들어올 이유가 없다. 위에 두면 화면을 열자마자 만나는 것이 값이 아니라 버튼이었다.
 *
 * 날짜 헤드라인은 이 줄에 없다. 상세 화면에는 x축이 이미 있어 "지금 어디를 보고
 * 있는지"를 축 눈금과 그려지는 선 끝이 말해 주므로, 같은 정보를 숫자로 한 번 더
 * 적으면 중복이다. 숏츠 카드는 사정이 반대라(캡처한 한 장이 스스로 설명해야 한다)
 * 거기서만 PlaybackHeadline으로 크게 세운다 — display가 세 조각을 따로 내주는 이유다.
 *
 * 진행바도 이 줄에 없다. 스크럽 막대가 바로 옆에서 같은 진행도를 이미 채워 보이고
 * 조작까지 받으므로, 읽기 전용 막대를 하나 더 두면 같은 값을 두 번 그리는 셈이다.
 * 숏츠 카드는 스크럽이 카드 밖에 있어 대체재가 없으므로 거기서만 남는다
 * (PlaybackHeadline).
 *
 * 높이를 h-10으로 고정하는 이유: 스크럽이 재생 중에만 나타나는데, 높이가 내용에 따라
 * 변하면 등장·퇴장마다 위 차트가 밀린다. 고정해 두면 idle에서 못 쓰는 슬라이더를
 * 상시 노출하지 않아도 레이아웃이 안정적이다.
 */
export function PlaybackTransport({ playback }: { playback: ChartPlayback }) {
  const { status, start, seek, display, showsCanvas } = playback;
  // display를 통째로 JSX에 넘기면(display.sliderRef처럼 프로퍼티로 바로 접근하면)
  // react-hooks/refs가 렌더 중 ref 접근으로 오탐한다 — 반환값을 즉시 구조분해해
  // 두어야 규칙이 조용하다(use-chart-playback.ts의 계약과 같은 이유).
  //
  // headlineRef·progressRef는 꺼내 쓰지 않는다. 붙이지 않은 조각은 재생 루프가 조용히
  // 건너뛴다(use-playback-display.ts) — 이 화면에 날짜 문단과 진행바가 없어도 갱신이
  // 터지지 않는다.
  const { sliderRef } = display;

  return (
    <div className="flex h-10 items-center gap-3">
      <PlayButton status={status} onStart={start} />

      {showsCanvas ? (
        <PlaybackScrubber onSeek={seek} sliderRef={sliderRef} />
      ) : (
        <span className="text-xs text-zinc-400">재생하면 기간을 따라 그려집니다</span>
      )}
    </div>
  );
}
