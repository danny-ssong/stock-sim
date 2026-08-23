/** 엔진 결과의 포트폴리오 레벨 한 점. engine.ts의 SimulationResult.portfolioIndex와 같은 모양이다. */
export type PortfolioIndexPoint = {
  monthIndex: number;
  /** 'YYYY-MM'. 백테스트 모드는 실제 캘린더월, 미래 모드는 가상 축의 월 레이블이다 */
  date: string;
  /** 시뮬 시작 시점을 1로 정규화한 포트폴리오 레벨. 절대 수준은 무의미하고 등락만 의미가 있다 */
  level: number;
  isSynthetic: boolean;
  /** 정규화하지 않은 원화 가격. 백테스트 모드는 실제 종가, 미래 모드는 최신 실제
   *  종가를 앵커로 level을 비례 확대한 값이다(engine.ts buildPortfolioIndex).
   *  대응하는 실제 가격이 없을 때만(방어적으로) null이 된다. */
  priceKrw: number | null;
};

export type DrawdownResult = {
  /** 0~1 사이 양수. 0.62면 고점 대비 -62% */
  maxDrawdown: number;
  peak: { monthIndex: number; date: string };
  trough: { monthIndex: number; date: string };
  /** 저점 이후 고점 수준을 다시 넘어선 시점. 시뮬 종료까지 못 넘었으면 null */
  recovery: { monthIndex: number; date: string } | null;
  /** 고점 → 회복까지 걸린 개월 수. recovery가 null이면 null */
  recoveryMonths: number | null;
};

/**
 * 포트폴리오(=선택한 상품) 가격 레벨 시계열에서 전역 최대낙폭(MDD)과 회복 소요기간을 구한다(§8 "이 탭의 핵심 지표").
 * 임계치 없이 "지금까지의 최고점 대비 지금 얼마나 빠졌나"의 전역 최댓값을 구하는
 * 표준 O(n) 알고리즘이다 — findLastCorrectionPeak의 지그재그 피벗 탐지와는
 * 목적이 달라 로직을 공유하지 않는다(전역 최댓값 vs 임계치로 걸러낸 최근 피벗).
 */
export function computeDrawdown(series: PortfolioIndexPoint[]): DrawdownResult | null {
  if (series.length === 0) return null;

  let peakIdx = 0;
  let maxDrawdown = 0;
  let maxDDPeakIdx = 0;
  let maxDDTroughIdx = 0;

  for (let i = 1; i < series.length; i += 1) {
    if (series[i].level > series[peakIdx].level) peakIdx = i;
    const drawdown = 1 - series[i].level / series[peakIdx].level;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
      maxDDPeakIdx = peakIdx;
      maxDDTroughIdx = i;
    }
  }

  const peakLevel = series[maxDDPeakIdx].level;
  let recoveryIdx: number | null = null;

  // 실제 낙폭이 있을 때만 회복을 찾는다
  if (maxDrawdown > 0) {
    for (let i = maxDDTroughIdx + 1; i < series.length; i += 1) {
      if (series[i].level >= peakLevel) {
        recoveryIdx = i;
        break;
      }
    }
  }

  return {
    maxDrawdown,
    peak: { monthIndex: series[maxDDPeakIdx].monthIndex, date: series[maxDDPeakIdx].date },
    trough: { monthIndex: series[maxDDTroughIdx].monthIndex, date: series[maxDDTroughIdx].date },
    recovery:
      recoveryIdx === null
        ? null
        : { monthIndex: series[recoveryIdx].monthIndex, date: series[recoveryIdx].date },
    recoveryMonths:
      recoveryIdx === null ? null : series[recoveryIdx].monthIndex - series[maxDDPeakIdx].monthIndex,
  };
}

/**
 * 임계 비율(thresholdRatio) 이상 하락한 가장 최근 "조정 전고점"을 찾는다.
 * backtest 모드의 "최근 조정 전고점" 프리셋 버튼에 쓴다 — 스펙 §8의 표는 이 값을
 * "실제 데이터 수신 후 확정"으로 비워 뒀는데, 고정 날짜를 하드코딩하면 시간이
 * 지날수록 "최근"이 아니게 되므로 매 렌더마다 실제 벤치마크(SPY) 시계열에서
 * 동적으로 계산한다.
 *
 * 표준 지그재그(zigzag) 피벗 탐지 — 상승 중 새 고점을 계속 갱신하다가, 그
 * 고점 대비 하락폭이 임계치를 넘으면 그 고점을 "확정된 조정 전고점"으로
 * 기록하고 그 저점부터 다시 고점 탐색을 시작한다. 마지막으로 확정된 고점을 반환한다
 * (아직 임계치를 못 넘은 채 진행 중인 고점은 반환하지 않는다).
 */
export function findLastCorrectionPeak(
  dates: string[],
  levels: Float64Array,
  thresholdRatio: number,
): { date: string; index: number } | null {
  if (dates.length === 0) return null;

  let peakIndex = 0;
  let peakValue = levels[0];
  let lastConfirmed: { date: string; index: number } | null = null;

  for (let i = 1; i < levels.length; i += 1) {
    if (levels[i] > peakValue) {
      peakValue = levels[i];
      peakIndex = i;
      continue;
    }
    const drawdown = 1 - levels[i] / peakValue;
    if (drawdown >= thresholdRatio) {
      lastConfirmed = { date: dates[peakIndex], index: peakIndex };
      peakValue = levels[i];
      peakIndex = i;
    }
  }

  return lastConfirmed;
}
