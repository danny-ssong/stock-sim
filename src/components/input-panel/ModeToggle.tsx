'use client';

import type { SimulationInputBase } from '../../lib/sim/types';
import { SegmentedControl, type SegmentedOption } from '../ui/segmented-control';

type Mode = SimulationInputBase['mode'];

const MODES: readonly SegmentedOption<Mode>[] = [
  { value: 'backtest', label: '과거 테스트' },
  { value: 'future', label: '미래 설계' },
];

/**
 * 시점 축. 탭 바를 대신하지만 탭이 아니다 — 두 상태가 같은 화면의 입력값이라
 * 라우트가 아니라 쿼리 파라미터 하나(mode)를 바꾼다.
 */
export function ModeToggle({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (mode: Mode) => void;
}) {
  return <SegmentedControl label="시점" value={mode} options={MODES} onChange={onChange} />;
}
