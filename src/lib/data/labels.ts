import { getProduct } from './catalog';
import type { IndexExposure } from './types';

/**
 * 노출 → 사람이 읽는 라벨.
 *
 * `Record<IndexExposure, string>`으로 두면 노출이 추가될 때 컴파일이 깨져 라벨
 * 누락을 빌드 시점에 잡는다 — 노출 문자열을 파싱해 배율을 뽑아내는 방식은 그
 * 보장을 주지 못하고, 노출 enum의 표기 규칙에 몰래 의존하게 된다.
 */
const EXPOSURE_LABELS: Record<IndexExposure, string> = {
  NASDAQ100_1X: '나스닥100',
  NASDAQ100_2X: '나스닥100 2배',
  NASDAQ100_3X: '나스닥100 3배',
  SP500_1X: 'S&P500',
  SP500_2X: 'S&P500 2배',
  SP500_3X: 'S&P500 3배',
};

export function exposureLabel(exposure: IndexExposure): string {
  return EXPOSURE_LABELS[exposure];
}

/** 선택 목록과 비교 카드에 쓰는 라벨. 같은 지수의 배율이 나란히 놓이는 화면이므로
 *  티커를 함께 보여줘 실제로 어떤 상품을 산 결과인지 드러낸다. */
export function exposureLabelWithTicker(exposure: IndexExposure): string {
  return `${EXPOSURE_LABELS[exposure]} (${getProduct(exposure).ticker})`;
}

/**
 * 티커만. 폭이 극단적으로 좁은 화면(숏츠의 9:16 카드)에서 쓴다 — "나스닥100 2배"는
 * 제목에서 두 줄로 넘치고 차트 끝점 라벨에서는 오른쪽 여백을 잡아먹는다.
 * 짧은 게 목적이므로 한글 라벨과 병기하지 않는다.
 */
export function exposureTicker(exposure: IndexExposure): string {
  return getProduct(exposure).ticker;
}
