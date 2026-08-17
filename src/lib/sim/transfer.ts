import type { Dataset } from '../data/dataset';
import type { AccountId } from '../data/types';
import { getTaxStrategy } from '../tax';
import { getTaxConstants, type TaxConstants } from '../tax/constants';
import { addMonths } from './calendar';
import { simulate } from './engine';
import { shiftSchedule } from './schedule';
import type {
  AnchoredSchedule,
  MonthEntry,
  SimulationInput,
  SimulationResult,
  SimulationWarning,
} from './types';

const MONTHS_PER_YEAR = 12;

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
};

function unsupported(message: string): { blocked: SimulationWarning[] } {
  return { blocked: [{ code: 'TRANSFER_NOT_SUPPORTED', message }] };
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
          // 청산 가정이므로 실현 전략은 결과에 영향을 주지 않는다
          { constants, realizationStrategy: { type: 'holdUntilExit' } },
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
 *  - 2구간의 납입은 이전 자금 스케줄로 대체된다 — 사용자의 정기 납입은
 *    ISA 한도와 경합하므로 v1에서는 함께 모델링하지 않는다.
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

  const legYears = Math.max(1, Math.round(event.atMonth / MONTHS_PER_YEAR));
  const secondLegYears = input.years - legYears;
  if (secondLegYears < 1) {
    return unsupported(
      '이전 시점이 시뮬 종료 시점과 같아 이전 이후 구간이 남지 않습니다.',
    );
  }

  const withoutOutcome = simulate({ ...input, transferEvents: [] }, dataset);
  if (!withoutOutcome.ok) return { blocked: withoutOutcome.blockers };

  const firstLeg = simulate(
    { ...input, transferEvents: [], years: legYears },
    dataset,
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
      // 2구간의 0년차는 원래 legYears년차다 — 연차에 매달린 소득 스케줄을 맞춘다
      employmentIncome: shiftSchedule(input.employmentIncome, legYears),
      allocations: input.allocations.map((a) => ({ ...a, accountId: event.to })),
    },
    dataset,
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

  let breakEvenMonth: number | null = null;
  const comparableMonths = Math.min(transferCurve.length, holdCurve.length);
  for (let month = event.atMonth; month < comparableMonths; month += 1) {
    if (transferCurve[month] > holdCurve[month]) {
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
  };
}
