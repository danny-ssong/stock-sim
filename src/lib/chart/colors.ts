import type { AccountId } from '../data/types';

/**
 * 계좌별 차트 색상. 탭 1의 StackedAreaChart가 계좌별 영역을 색으로 구분할 때 쓴다 —
 * 인라인으로 중복 정의하지 않고 이 상수를 공유한다. 탭 2의 LogScaleLineChart는
 * 계좌별로 나뉘지 않은 단일 블렌디드 라인을 그리므로(하드코딩된 단색 사용) 계좌별
 * 색상 구분이 필요 없어 이 상수를 쓰지 않는다.
 */
export const ACCOUNT_COLORS: Record<AccountId, string> = {
  DIRECT_US: '#2563eb',
  DOMESTIC_ETF: '#16a34a',
  ISA: '#d97706',
};
