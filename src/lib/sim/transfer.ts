import type { Dataset } from '../data/dataset';
import type { AccountId } from '../data/types';
import { getTaxStrategy } from '../tax';
import { getTaxConstants, type TaxConstants } from '../tax/constants';
import { addMonths } from './calendar';
import { simulate } from './engine';
import { resolveAtYear } from './schedule';
import type {
  AnchoredSchedule,
  MonthEntry,
  SimulationInput,
  SimulationResult,
  SimulationWarning,
} from './types';

const MONTHS_PER_YEAR = 12;

/**
 * 역전 판정의 상대 여유폭.
 *
 * 두 시나리오는 이전 시점에 경제적으로 같은 금액을 들고 있어야 하지만, 구간을
 * 쪼개면 1구간과 유지 쪽의 달력 길이가 달라 연 거래일 수(daysPerYear)가 미세하게
 * 어긋나 평가액이 조금 벌어진다 — 실측으로 1억 3,305만원 기준 63,121원(0.047%)
 * 차이가 났다. 이 크기의 달력 잡음이 "역전"으로 잡히지 않도록 0.1%를 넘어설 때만
 * 역전으로 인정한다. (과거 백테스트 모드는 절대 날짜 축을 밟아 이 오차가 0이다.)
 */
const BREAK_EVEN_MARGIN = 0.001;

export type IsaDepositPlan = Array<{ yearIndex: number; amount: number }>;

/**
 * 세후 현금을 ISA 납입한도에 맞춰 연도별로 쪼갠다.
 * 연 2,000만원 한도 초과분은 다음 해로 이월하고, 총 1억원 상한과
 * 남은 기간을 넘어가는 금액은 옮기지 못한 채 남는다(§5.8).
 *
 * startYearIndex는 "ISA를 여는 연차"다 — 그 전 연도의 미사용 한도는 쌓이지
 * 않는다(계좌가 없었으므로). 계좌가 이미 있는 상태의 이월 한도는
 * isaStrategy.contributionLimit이 원장 단계에서 따로 걸러낸다.
 */
export function planIsaDeposits(params: {
  proceeds: number;
  startYearIndex: number;
  years: number;
  constants: TaxConstants;
}): { deposits: IsaDepositPlan; leftover: number } {
  const { proceeds, startYearIndex, years, constants } = params;
  const { annualLimit, totalLimit } = constants.isa;

  const deposits: IsaDepositPlan = [];
  let remaining = Math.min(proceeds, totalLimit);
  const overTotalLimit = proceeds - remaining;

  for (
    let yearIndex = startYearIndex;
    yearIndex < years && remaining > 0;
    yearIndex += 1
  ) {
    const amount = Math.min(annualLimit, remaining);
    deposits.push({ yearIndex, amount });
    remaining -= amount;
  }

  // 총 한도를 넘긴 몫과 기간이 부족해 못 넣은 몫은 성격이 같다 — 계좌 밖에 남는다
  return { deposits, leftover: overTotalLimit + remaining };
}

export type TransferComparison = {
  /** [1구간 직투, 2구간 ISA] */
  withTransfer: SimulationResult[];
  /** 이전하지 않고 직투를 유지한 경우 */
  without: SimulationResult;
  /** 이전 시점에 즉시 발생한 양도소득세 */
  immediateTax: number;
  /** 이전한 쪽이 앞서기 시작하는 개월. 끝까지 역전하지 못하면 null */
  breakEvenMonth: number | null;
  /** 최종 세후 평가액 차이 (이전 − 유지) */
  finalDifference: number;
  /**
   * ISA 납입한도·남은 기간에 걸려 계좌에 넣지 못하고 남은 현금.
   * finalDifference에 이미 더해져 있지만, 이 금액이 수익 없이 놀고 있다는 사실이
   * 최종 숫자 뒤로 사라지지 않도록 따로 낸다.
   */
  idleCash: number;
  /** 손익분기 차트용 월별 "지금 청산하면 손에 남는 금액" 곡선(§8 "손익분기 그래프").
   *  이전한 경우와 유지한 경우가 같은 길이(전체 개월수)를 갖는다. */
  transferCurve: number[];
  holdCurve: number[];
  /** 이 비교가 이전 쪽을 과소평가하는 지점. UI가 반드시 노출한다(§13) */
  warnings: SimulationWarning[];
};

function unsupported(message: string): { blocked: SimulationWarning[] } {
  return { blocked: [{ code: 'TRANSFER_NOT_SUPPORTED', message }] };
}

/**
 * 이 비교가 이전 쪽을 과소평가하는 지점을 데이터로 드러낸다(§13).
 *
 * 소스 주석에만 적어 두면 UI를 만드는 사람이 읽지 못하고, 사용자는 한쪽이
 * 불리하게 계산된 사실을 모른 채 숫자만 본다. 두 제약 모두 모델의 한계이지
 * 사용자의 입력 오류가 아니므로 blocked가 아니라 경고로 낸다.
 */
function collectTransferWarnings(params: {
  input: SimulationInput;
  legYears: number;
  idleCash: number;
}): SimulationWarning[] {
  const { input, legYears, idleCash } = params;
  const warnings: SimulationWarning[] = [];

  let dropsContribution = false;
  for (let yearIndex = legYears; yearIndex < input.years; yearIndex += 1) {
    if (resolveAtYear(input.contribution, yearIndex) > 0) dropsContribution = true;
  }
  if (dropsContribution) {
    warnings.push({
      code: 'TRANSFER_CONTRIBUTION_DROPPED',
      message:
        '이전 후에는 정기 납입액이 시뮬레이션에 반영되지 않습니다. 이전 자금이 ISA 납입한도를 차지하므로, 정기 납입을 함께 담으려면 두 계좌를 동시에 굴려야 합니다.',
    });
  }

  // 1원 미만은 납입액 분할에서 생긴 부동소수점 잔여이므로 대기 현금으로 보지 않는다
  if (idleCash > 1) {
    warnings.push({
      code: 'TRANSFER_IDLE_CASH',
      amount: idleCash,
      message: `ISA 한도를 초과한 ${Math.round(idleCash).toLocaleString('ko-KR')}원은 수익 없이 대기 상태로 가정됩니다.`,
    });
  }

  return warnings;
}

/**
 * 이전 자금을 2구간의 납입 스케줄로 옮긴다.
 *
 * 첫해분은 이전 시점에 일시 납입하고(initialAmount), 이후 연도분은 그 해에
 * 매월 균등 납입하는 것으로 근사한다 — 원장이 월 단위라 연초 일시납을
 * 표현할 방법이 없다. 균등 납입은 수익을 늦게 태우므로 보수적인 쪽이다.
 */
function buildDepositSchedule(deposits: IsaDepositPlan): {
  initialAmount: number;
  contribution: AnchoredSchedule;
} {
  const anchors: Record<number, number> = {};
  for (const deposit of deposits) {
    if (deposit.yearIndex > 0) {
      anchors[deposit.yearIndex] = deposit.amount / MONTHS_PER_YEAR;
    }
  }

  // 마지막 납입 연도 다음 해부터는 0이다 — 명시하지 않으면 직전 anchor가 계속 이어진다
  const lastYearIndex =
    deposits.length > 0 ? deposits[deposits.length - 1].yearIndex : 0;
  anchors[lastYearIndex + 1] = 0;

  const firstYearDeposit = deposits.find((d) => d.yearIndex === 0);

  return {
    initialAmount: firstYearDeposit?.amount ?? 0,
    contribution: { base: 0, growthRate: 0, anchors },
  };
}

/** 월 → 그 달의 원장 행들. 원장이 월 순서로 쌓이므로 Map의 삽입 순서가 곧 월 순서다. */
function groupEntriesByMonth(entries: MonthEntry[]): Map<number, MonthEntry[]> {
  const byMonth = new Map<number, MonthEntry[]>();
  for (const entry of entries) {
    const bucket = byMonth.get(entry.monthIndex);
    if (bucket === undefined) byMonth.set(entry.monthIndex, [entry]);
    else bucket.push(entry);
  }
  return byMonth;
}

/** 그 연차 이전에 이미 확정돼 빠져나간 세금의 누적액. 자기 연차는 포함하지 않는다. */
function taxPaidBeforeYear(result: SimulationResult): number[] {
  const cumulative: number[] = [];
  let sum = 0;
  for (const year of result.yearlyTax) {
    cumulative.push(sum);
    sum += year.totalTax;
  }
  return cumulative;
}

type TransferLeg = {
  result: SimulationResult;
  /**
   * 이 구간이 손에 쥐고 시작한 현금. 한도·기간에 걸려 아직 계좌에 넣지 못한
   * 몫은 그대로 놀고 있는 현금으로 남는다. 이전 구간은 0이다.
   */
  cashReserve: number;
};

/**
 * "그 달에 전부 청산하면 손에 남는 금액"을 월별로 잇는다.
 *
 * 역전 시점은 세후로 비교해야 의미가 있다 — 이전한 쪽은 이전 시점에 세금을
 * 미리 냈고, 유지하는 쪽은 그 부담을 마지막까지 미루기 때문이다. 세전 평가액을
 * 비교하면 세금을 먼저 낸 쪽이 영원히 뒤처져 역전이 정의되지 않는다.
 *
 * 각 달의 값 = 평가액 − 그 달 청산 시 세금 − 그 연차 전에 이미 낸 세금
 *            + 아직 납입하지 못한 대기 현금
 *
 * 명시하는 근사 세 가지:
 *  - 대기 현금에는 이자를 붙이지 않는다(보수적).
 *  - 그 해의 배당 원천징수·종합과세는 연말에야 확정되므로 연중에는 반영되지 않는다.
 *  - 기본공제 소진 전략의 취득원가 step-up은 엔진 내부 상태라 반영하지 않아
 *    세금이 조금 크게 잡힐 수 있다. 두 시나리오에 같은 규칙을 쓰므로 비교는 공정하다.
 */
function monthlyAfterTaxCurve(legs: TransferLeg[]): number[] {
  const curve: number[] = [];

  for (const leg of legs) {
    const paidBefore = taxPaidBeforeYear(leg.result);
    let contributedSoFar = 0;

    for (const entries of groupEntriesByMonth(leg.result.ledger.entries).values()) {
      const yearIndex = Math.floor(entries[0].monthIndex / MONTHS_PER_YEAR);
      const calendarYear = Number(entries[0].date.slice(0, 4));
      const constants = getTaxConstants(calendarYear);

      // 청산세는 계좌 단위로 통산한다 — ISA 200만원 비과세와 해외 250만원
      // 기본공제가 상품별이 아니라 계좌별로 한 번씩 걸린다.
      const byAccount = new Map<
        AccountId,
        { productId: string; marketValue: number; costBasis: number; dividendIncome: number }
      >();
      let marketValueTotal = 0;

      for (const entry of entries) {
        marketValueTotal += entry.marketValue;
        contributedSoFar += entry.contribution;

        const held = byAccount.get(entry.accountId);
        byAccount.set(entry.accountId, {
          productId: entry.productId,
          marketValue: (held?.marketValue ?? 0) + entry.marketValue,
          costBasis: (held?.costBasis ?? 0) + entry.costBasis,
          // 엔진이 마지막 해 exitTax에 넘기는 값과 같은 정의를 쓴다(그 달에 계상된
          // 배당). 곡선의 마지막 점이 엔진의 세금 계산과 어긋나지 않게 한다.
          dividendIncome: (held?.dividendIncome ?? 0) + entry.dividendReceived,
        });
      }

      let exitTax = 0;
      for (const [accountId, account] of byAccount) {
        exitTax += getTaxStrategy(accountId).exitTax(
          {
            yearIndex,
            calendarYear,
            accountId,
            productId: account.productId,
            marketValue: account.marketValue,
            costBasis: account.costBasis,
            dividendIncome: account.dividendIncome,
            realizedGain: 0,
            heldYears: yearIndex + 1,
            isFinalYear: true,
          },
          // 청산 가정이므로 실현 전략·ISA 가입년차는 exitTax 결과에 영향을 주지 않는다
          { constants, realizationStrategy: { type: 'holdUntilExit' }, isaExistingYears: 0 },
        ).tax;
      }

      curve.push(
        marketValueTotal +
          Math.max(0, leg.cashReserve - contributedSoFar) -
          exitTax -
          (paidBefore[yearIndex] ?? 0),
      );
    }
  }

  return curve;
}

/**
 * 이전한 경우와 하지 않은 경우를 동일 경로로 병렬 시뮬하고 역전 시점을 찾는다(§5.8).
 *
 * 이전 처리 순서:
 *   1. 직투에서 매도 → 양도차익 실현
 *   2. 양도소득세 계산 (기본공제 250만원 적용)
 *   3. 세후 현금이 ISA 납입 원금이 된다
 *   4. 연 2,000만원 한도 초과분은 다음 해로 이월
 *   5. ISA에 대응 상품이 없으면 이전 자체를 거부한다
 *
 * 두 구간을 이어 붙이는 방식이라 다음 제약이 따른다. 조용히 삼키지 않고
 * 계산할 수 없는 입력은 blocked로 돌려보낸다(§13).
 *  - 이전 시점은 연 단위로 반올림된다(엔진의 세금 계산이 연 단위다).
 *  - 전액 이전만 다룬다. 일부만 옮기면 두 계좌를 동시에 굴려야 한다.
 *  - 미래 모드에서 과거 수익률 경로 재생, 그리고 고정이 아닌 환율 가정은
 *    구간 경계에서 경로가 이어지지 않아 거부한다.
 *
 * 거부까지는 아니지만 이전 쪽을 과소평가하는 두 가지는 warnings로 낸다 —
 * 2구간에서 빠지는 정기 납입, 그리고 ISA 한도 밖에서 노는 대기 현금.
 */
export function compareTransfer(params: {
  input: SimulationInput;
  dataset: Dataset;
}): TransferComparison | { blocked: SimulationWarning[] } {
  const { input, dataset } = params;

  if (input.transferEvents.length === 0) {
    return unsupported('이전 이벤트가 없습니다.');
  }
  if (input.transferEvents.length > 1) {
    return unsupported('이전은 한 번만 계산합니다. 이벤트를 하나로 합쳐 주세요.');
  }

  const event = input.transferEvents[0];
  if (event.amount !== 'all') {
    return unsupported(
      '일부 금액만 이전하는 경우는 두 계좌를 동시에 굴려야 해 아직 계산하지 않습니다. 전액 이전만 지원합니다.',
    );
  }
  if (input.allocations.length === 0) {
    return unsupported('배분이 비어 있습니다.');
  }
  if (input.allocations.some((a) => a.accountId !== event.from)) {
    return unsupported(
      `${event.from} 외의 계좌가 함께 있으면 이전 이후 구간을 한 계좌로 표현할 수 없습니다.`,
    );
  }

  // 이전받는 계좌에 같은 노출을 담을 수 있는지 먼저 확인한다 — 담을 수 없으면
  // 대체 상품을 조용히 끼워 넣지 않고 이전 자체를 거부한다(§13).
  for (const allocation of input.allocations) {
    const resolution = getTaxStrategy(event.to).canHold(allocation.exposure);
    if (!resolution.available) {
      return {
        blocked: [
          {
            code: 'PRODUCT_UNAVAILABLE',
            accountId: event.to,
            exposure: allocation.exposure,
            message: `${resolution.message} 이전할 수 없습니다.`,
          },
        ],
      };
    }
  }

  /**
   * 미래 모드에서 '움직이는 경로'는 구간을 쪼개면 이어지지 않는다.
   *
   * 수익률 경로: resolvePathIndices(Task 12)는 참조 구간의 처음부터 순환시키므로
   * (indices[i] = firstReturn + i % referenceLength) 2구간을 따로 시뮬하면
   * 시장 경로가 참조 구간 1일차로 되돌아간다. 유지 쪽은 한 번의 시뮬로 그
   * 구간을 계속 밟으므로, 두 시나리오가 서로 다른 시장을 타게 되어 역전
   * 시점과 최종 차이가 아무 의미 없는 숫자가 된다(§5.8은 '동일 경로 병렬
   * 시뮬'을 요구한다). 이어받을 지점을 resolvePathIndices에 넘기는 구조
   * 변경은 이 태스크의 범위가 아니므로, 틀린 숫자를 내는 대신 거부한다.
   *
   * 환율: fixed를 뺀 나머지(historicalPath·drift)는 모두 같은 문제를 갖는다.
   * 환율 레벨이 매 시뮬 startRate(오늘 환율)에서 다시 출발하므로, 2구간은
   * 1구간이 밀어 올려 둔 환율을 물려받지 못한다. 실측(drift 연 3%, 36개월
   * 이전): 1구간 종료 환율 1,639.09 → 2구간 시작 환율 1,503.41로 8.3% 급락,
   * 같은 달 유지 쪽은 1,643.05. 역전 판정 여유폭(0.1%)의 80배가 넘는 왜곡이라
   * 비교 자체가 성립하지 않는다. fixed만 경로라는 개념이 없어 안전하다.
   *
   * 이 검사는 simulate가 아니라 여기가 소유한다 — simulate 혼자서는
   * historicalPath를 정상적으로 처리하며, 제약은 '구간을 이어 붙인다'는
   * 이 함수의 방식에서만 생기기 때문이다.
   *
   * 과거 백테스트 모드는 달력 오프셋이 날짜 축의 절대 인덱스이고 경로도
   * 항등이라 이 문제가 없다(실측 확인: 3년 시뮬과 10년 시뮬의 36개월째
   * 평가액이 완전히 일치하고, 뒤로 옮긴 구간의 매수 단가·환율도 연속
   * 시뮬의 같은 날짜와 동일했다). 그래서 백테스트는 그대로 통과시킨다.
   */
  if (input.mode === 'future') {
    if (input.returnSource.type === 'historicalPath') {
      return unsupported(
        '미래 모드에서 과거 수익률 경로를 재생하면 이전 전후로 경로가 이어지지 않아 두 시나리오를 같은 조건으로 비교할 수 없습니다. 연 복리 직선(constantCagr)으로 비교하거나 과거 백테스트 모드를 사용하세요.',
      );
    }
    // 고정 환율만 통과시킨다 — 새 FxAssumption 종류가 생겨도 자동으로 막힌다.
    // 화이트리스트가 아니라 블랙리스트로 적으면 drift를 놓쳤던 실수가 반복된다.
    if (input.fxAssumption.type !== 'fixed') {
      return unsupported(
        '미래 모드에서 환율이 움직이는 가정(과거 경로 재생·추세)은 이전 전후로 환율 경로가 이어지지 않아 두 시나리오를 같은 조건으로 비교할 수 없습니다. 고정 환율로 비교하거나 과거 백테스트 모드를 사용하세요.',
      );
    }
  }

  const legYears = Math.max(1, Math.round(event.atMonth / MONTHS_PER_YEAR));
  const secondLegYears = input.years - legYears;
  if (secondLegYears < 1) {
    return unsupported(
      '이전 시점이 시뮬 종료 시점과 같아 이전 이후 구간이 남지 않습니다.',
    );
  }

  // 이 함수는 이월 한도·대기 현금(TRANSFER_IDLE_CASH)을 자체적으로 계산하므로
  // (아래 planIsaDeposits) engine.ts의 ISA 초과분 자동 라우팅은 끈다 — 같이 켜면
  // 대기 현금이 조용히 다른 계좌에 투자되어 두 계산이 어긋난다.
  const noAutoOverflow = { autoRouteIsaOverflow: false };

  const withoutOutcome = simulate(
    { ...input, transferEvents: [] },
    dataset,
    noAutoOverflow,
  );
  if (!withoutOutcome.ok) return { blocked: withoutOutcome.blockers };

  const firstLeg = simulate(
    { ...input, transferEvents: [], years: legYears },
    dataset,
    noAutoOverflow,
  );
  if (!firstLeg.ok) return { blocked: firstLeg.blockers };

  /**
   * 1구간의 finalAfterTax는 이미 세금을 뺀 '매도 후 현금'이다(SimulationResult
   * 참조: finalAfterTax = finalBeforeTax − totalTax). 이것을 2구간의 납입 원금으로
   * 그대로 쓰면 세금이 두 번 빠지지도, 빠져나가지도 않는다.
   */
  const proceeds = firstLeg.result.finalAfterTax;
  const transferYear =
    firstLeg.result.yearlyTax[firstLeg.result.yearlyTax.length - 1].calendarYear;
  // leftover는 여기서 쓰지 않는다 — 실제로 남는 현금은 원장이 확정한 납입액에서
  // 역산해야 납입한도에 걸려 덜 들어간 몫까지 놓치지 않는다.
  const { deposits } = planIsaDeposits({
    proceeds,
    startYearIndex: 0,
    years: secondLegYears,
    constants: getTaxConstants(transferYear),
  });
  const schedule = buildDepositSchedule(deposits);

  const secondLeg = simulate(
    {
      ...input,
      transferEvents: [],
      startMonth: addMonths(input.startMonth, legYears * MONTHS_PER_YEAR),
      years: secondLegYears,
      initialAmount: schedule.initialAmount,
      contribution: schedule.contribution,
      // 이전으로 새로 여는 ISA다 — 원래 시나리오의 기존 가입년차를 물려받지 않는다
      isaExistingYears: 0,
      allocations: input.allocations.map((a) => ({ ...a, accountId: event.to })),
    },
    dataset,
    noAutoOverflow,
  );
  if (!secondLeg.ok) return { blocked: secondLeg.blockers };

  const idleCash = proceeds - secondLeg.result.totalContributed;
  const transferCurve = monthlyAfterTaxCurve([
    { result: firstLeg.result, cashReserve: 0 },
    { result: secondLeg.result, cashReserve: proceeds },
  ]);
  const holdCurve = monthlyAfterTaxCurve([
    { result: withoutOutcome.result, cashReserve: 0 },
  ]);

  // 실제로 이전이 일어나는 달부터 본다. event.atMonth는 연 단위로 반올림되기 전
  // 값이라, 그 사이 달은 두 시나리오가 아직 같은 자산을 들고 있어 비교 대상이 아니다.
  const transferMonth = legYears * MONTHS_PER_YEAR;
  let breakEvenMonth: number | null = null;
  const comparableMonths = Math.min(transferCurve.length, holdCurve.length);
  for (let month = transferMonth; month < comparableMonths; month += 1) {
    const hold = holdCurve[month];
    if (transferCurve[month] > hold + Math.abs(hold) * BREAK_EVEN_MARGIN) {
      breakEvenMonth = month;
      break;
    }
  }

  return {
    withTransfer: [firstLeg.result, secondLeg.result],
    without: withoutOutcome.result,
    // 이전 시점에 '즉시' 나가는 세금은 매도로 확정된 양도소득세다.
    // 1구간의 totalTax에는 그 기간의 배당 원천징수·종합과세도 섞여 있어 쓰지 않는다.
    immediateTax: firstLeg.result.exitBreakdowns.reduce((sum, b) => sum + b.tax, 0),
    breakEvenMonth,
    // 한도·기간에 걸려 ISA에 넣지 못한 현금은 사라지지 않고 그대로 남는다
    finalDifference:
      secondLeg.result.finalAfterTax + idleCash - withoutOutcome.result.finalAfterTax,
    idleCash,
    transferCurve,
    holdCurve,
    warnings: collectTransferWarnings({ input, legYears, idleCash }),
  };
}
