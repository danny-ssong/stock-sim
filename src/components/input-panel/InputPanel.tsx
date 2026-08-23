'use client';

import { useHistoricalCagrAutoFill } from '../../hooks/use-historical-cagr-auto-fill';
import { useSimulationInputState } from '../../hooks/use-simulation-input';
import { useSimulationQueryContext } from '../../hooks/use-simulation-query-context';
import { applyMode } from '../../lib/sim/mode-transition';
import { isLumpSum } from '../../lib/sim/schedule';
import { MAX_FUTURE_YEARS } from '../../lib/url/schema';
import { BacktestStartPicker } from './BacktestStartPicker';
import { BacktestYearsInput } from './BacktestYearsInput';
import { ExposureSelector } from './ExposureSelector';
import { FieldGroup } from './FieldGroup';
import { ModeToggle } from './ModeToggle';
import { ReturnSourceToggle } from './ReturnSourceToggle';
import { ShareLinkButton } from './ShareLinkButton';
import { SliderField } from './SliderField';
import { YearlyScheduleTable } from './YearlyScheduleTable';

const EOK = 100_000_000;
const MANWON = 10_000;

/** 초기 원금 슬라이더: 0~20억, 0.5억 단위. 기본값 1억은 0.5억 x 2로 떨어진다. */
const INITIAL_AMOUNT_MAX = 20 * EOK;
const INITIAL_AMOUNT_STEP = EOK / 2;

/** 월 납입액 슬라이더: 0~1,000만원, 10만원 단위. 기본값 150만원은 10만 x 15로 떨어진다. */
const CONTRIBUTION_MAX = 1_000 * MANWON;
const CONTRIBUTION_STEP = 10 * MANWON;

/** 납입액 상승률 슬라이더: 0~20%, 0.5%p 단위 */
const GROWTH_RATE_MAX_PERCENT = 20;
const GROWTH_RATE_STEP_PERCENT = 0.5;

function formatEok(amountKrw: number): string {
  return `${(amountKrw / EOK).toFixed(1)}억원`;
}

function formatManwon(amountKrw: number): string {
  return `${Math.round(amountKrw / MANWON).toLocaleString('ko-KR')}만원`;
}

function formatPercent(percent: number): string {
  return `${percent.toFixed(1)}%`;
}

/**
 * 입력 패널이 화면의 두 축을 모두 들고 있다 — 시점(ModeToggle)과 비교 대상
 * 개수(ExposureSelector). 탭 시절 이 둘은 라우트로 갈려 있었고, 그래서
 * "과거 × 비교" 조합이 존재하지 않았다.
 *
 * 모드에 따라 갈리는 입력(조회 구간 / 수익률 가정)은 납입 계획·상품 선택 다음의
 * 한 자리에 몰아둔다 — 변하는 영역을 한 곳에 가둬야 패널이 흔들리지 않는다.
 */
export function InputPanel() {
  const context = useSimulationQueryContext();
  const { base, exposures, setBase, setExposures, shareUrl } = useSimulationInputState(context);
  const isBacktest = base.mode === 'backtest';
  const lumpSum = isBacktest && isLumpSum(base.contribution);

  // 고정 수익률의 기본값은 "대표 노출의 과거 CAGR"이다. 노출이 여러 개면 첫 번째를
  // 대표로 쓴다 — 수익률 가정은 노출과 달리 하나만 존재하므로 대표값이 필요하다.
  // 백테스트 모드나 노출 2개 이상 비교 중에는 고정 수익률 UI 자체가 없어(파싱
  // 단계에서 항상 과거 흐름 재생으로 교정된다 — schema.ts) null을 넘겨 불필요한
  // 데이터 요청을 막는다.
  const comparing = exposures.length > 1;
  useHistoricalCagrAutoFill(isBacktest || comparing ? null : exposures[0], base, setBase);

  return (
    <div className="flex flex-col gap-8 p-4">
      <ModeToggle
        mode={base.mode}
        onChange={(mode) => setBase(applyMode(base, mode, context.today))}
      />

      <FieldGroup title="납입 계획">
        <SliderField
          label="초기 원금"
          value={base.initialAmount}
          onChange={(initialAmount) => setBase({ ...base, initialAmount })}
          min={0}
          max={INITIAL_AMOUNT_MAX}
          step={INITIAL_AMOUNT_STEP}
          formatValue={formatEok}
        />
        <SliderField
          label="월 납입액(1년차)"
          value={base.contribution.base}
          onChange={(contributionBase) =>
            setBase({ ...base, contribution: { ...base.contribution, base: contributionBase } })
          }
          min={0}
          max={CONTRIBUTION_MAX}
          step={CONTRIBUTION_STEP}
          disabled={lumpSum}
          formatValue={formatManwon}
        />
        <SliderField
          label="월 납입액 증가율"
          value={base.contribution.growthRate * 100}
          onChange={(percent) =>
            setBase({
              ...base,
              contribution: { ...base.contribution, growthRate: percent / 100 },
            })
          }
          min={0}
          max={GROWTH_RATE_MAX_PERCENT}
          step={GROWTH_RATE_STEP_PERCENT}
          disabled={lumpSum}
          formatValue={formatPercent}
        />
        <YearlyScheduleTable
          title="월 납입액"
          schedule={base.contribution}
          years={base.years}
          onChange={(schedule) => setBase({ ...base, contribution: schedule })}
          formatValue={formatManwon}
          displayDivisor={MANWON}
        />
        {!isBacktest && (
          <SliderField
            label="기간"
            value={base.years}
            onChange={(years) => setBase({ ...base, years })}
            min={1}
            max={MAX_FUTURE_YEARS}
            step={1}
            formatValue={(years) => `${years}년`}
          />
        )}
      </FieldGroup>

      <ExposureSelector value={exposures} onChange={setExposures} />

      {isBacktest ? (
        <FieldGroup title="조회 구간">
          <BacktestStartPicker input={base} setInput={setBase} />
          <BacktestYearsInput input={base} setInput={setBase} />
        </FieldGroup>
      ) : (
        <ReturnSourceToggle
          value={base.returnSource}
          onChange={(returnSource) => setBase({ ...base, returnSource })}
          years={base.years}
          comparing={comparing}
        />
      )}

      <div className="border-t pt-4">
        <ShareLinkButton shareUrl={shareUrl} />
      </div>
    </div>
  );
}
