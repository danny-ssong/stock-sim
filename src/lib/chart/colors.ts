import type { IndexExposure } from '../data/types';

/**
 * 노출 → 시리즈 색.
 *
 * Record로 두는 이유는 labels.ts의 EXPOSURE_LABELS와 같다 — 노출이 추가되면
 * 컴파일이 깨져 색 누락을 빌드 시점에 잡는다.
 *
 * 색을 "선택 배열에서의 위치"가 아니라 노출 자체에서 파생시키는 이유: 위치 기반이면
 * (1) blocked가 섞일 때 요약 행과 차트 선의 색이 어긋나고, (2) 비교 도중 한 상품을
 * 빼면 남은 상품의 색이 바뀌며, (3) 단일 화면과 비교 화면이 같은 상품에 다른 색을
 * 준다. 셋 다 "위치"라는 비국소적 사실에서 나온다 — 위치를 없애면 함께 사라진다.
 *
 * 팔레트 선정 기준:
 * - 가장 흔한 비교인 **같은 지수의 배수 조합**에서 잘 갈릴 것
 *   (나스닥 파랑·분홍·주황 / S&P 초록·보라·청록)
 * - 빨강(#dc2626)을 쓰지 않을 것 — blocked 행과 blocker 메시지의 에러 색이다
 * - 원금 회색(CONTRIBUTED_COLOR)과 겹치지 않을 것
 * - light/dark 양쪽 배경에서 보일 것 (Tailwind 600 계열)
 */
const EXPOSURE_COLORS: Record<IndexExposure, string> = {
  NASDAQ100_1X: '#2563eb', // blue-600
  NASDAQ100_2X: '#db2777', // pink-600
  NASDAQ100_3X: '#d97706', // amber-600
  SP500_1X: '#16a34a', // green-600
  SP500_2X: '#7c3aed', // violet-600
  SP500_3X: '#0891b2', // cyan-600
};

export function exposureColor(exposure: IndexExposure): string {
  return EXPOSURE_COLORS[exposure];
}

/**
 * 원금 라인의 색. 노출이 아니라 모든 화면에 공통인 기준선이라 Record 밖에 둔다.
 * 정적 차트(AssetChart·CompareResultsView)와 재생(series.ts)이 같은 값을 써야
 * 둘이 교대할 때 색이 바뀌지 않는다.
 */
export const CONTRIBUTED_COLOR = '#71717a'; // zinc-500
