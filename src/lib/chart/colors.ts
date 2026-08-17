import type { AccountId } from '../data/types';

/**
 * 계좌별 차트 색상. 탭 1의 StackedAreaChart와 탭 2의 로그 스케일 차트가
 * 같은 계좌는 같은 색으로 보이도록 공유한다(M20) — 각 컴포넌트에 인라인으로
 * 중복 정의하지 않는다.
 */
export const ACCOUNT_COLORS: Record<AccountId, string> = {
  DIRECT_US: '#2563eb',
  DOMESTIC_ETF: '#16a34a',
  ISA: '#d97706',
};
