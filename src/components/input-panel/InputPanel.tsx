'use client';

import { useHistoricalCagrAutoFill } from '../../hooks/use-historical-cagr-auto-fill';
import { useScenariosState } from '../../hooks/use-scenarios';
import { useSimulationInputState } from '../../hooks/use-simulation-input';
import { useSimulationQueryContext } from '../../hooks/use-simulation-query-context';
import { DEFAULT_EXPOSURE, MAX_FUTURE_YEARS } from '../../lib/url/schema';
import { BacktestStartPicker } from './BacktestStartPicker';
import { BacktestYearsInput } from './BacktestYearsInput';
import { ExposureSelector } from './ExposureSelector';
import { FieldGroup } from './FieldGroup';
import { isLumpSum, LumpSumToggle } from './LumpSumToggle';
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

export function InputPanel({ mode }: { mode: 'future' | 'backtest' | 'compare' }) {
  const context = useSimulationQueryContext(mode === 'backtest' ? 'backtest' : 'future');
  const { input, setInput, shareUrl } = useSimulationInputState(context);
  const lumpSum = mode === 'backtest' && isLumpSum(input);

  // 탭1은 선택한 노출을, 탭3은 베이스라인(첫 번째) 시나리오의 노출을 기준으로
  // CAGR 디폴트를 계산한다 — 탭3은 exposure가 시나리오마다 다르지만 returnSource는
  // base input 하나를 공유해, 대표값이 필요하다. 탭2는 CAGR 토글이 없어 null.
  const { scenarios } = useScenariosState();
  const cagrDefaultExposure =
    mode === 'future' ? input.exposure : mode === 'compare' ? (scenarios[0]?.exposure ?? DEFAULT_EXPOSURE) : null;
  useHistoricalCagrAutoFill(cagrDefaultExposure, input, setInput);

  return (
    <div className="flex flex-col gap-8 p-4">
      <FieldGroup title="납입 계획">
        <SliderField
          label="초기 원금"
          value={input.initialAmount}
          onChange={(initialAmount) => setInput({ ...input, initialAmount })}
          min={0}
          max={INITIAL_AMOUNT_MAX}
          step={INITIAL_AMOUNT_STEP}
          formatValue={formatEok}
        />
        <SliderField
          label="월 납입액(1년차)"
          value={input.contribution.base}
          onChange={(base) =>
            setInput({ ...input, contribution: { ...input.contribution, base } })
          }
          min={0}
          max={CONTRIBUTION_MAX}
          step={CONTRIBUTION_STEP}
          disabled={lumpSum}
          formatValue={formatManwon}
        />
        <SliderField
          label="매년 증액"
          value={input.contribution.growthRate * 100}
          onChange={(percent) =>
            setInput({
              ...input,
              contribution: { ...input.contribution, growthRate: percent / 100 },
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
          schedule={input.contribution}
          years={input.years}
          onChange={(schedule) => setInput({ ...input, contribution: schedule })}
          formatValue={formatManwon}
          displayDivisor={MANWON}
        />
        {mode === 'backtest' ? (
          <BacktestYearsInput input={input} setInput={setInput} />
        ) : (
          <SliderField
            label="기간"
            value={input.years}
            onChange={(years) => setInput({ ...input, years })}
            min={1}
            max={MAX_FUTURE_YEARS}
            step={1}
            formatValue={(years) => `${years}년`}
          />
        )}
      </FieldGroup>

      {mode !== 'compare' && (
        <ExposureSelector value={input.exposure} onChange={(exposure) => setInput({ ...input, exposure })} />
      )}

      {(mode === 'future' || mode === 'compare') && (
        <ReturnSourceToggle
          value={input.returnSource}
          onChange={(returnSource) => setInput({ ...input, returnSource })}
          years={input.years}
          exposure={mode === 'future' ? input.exposure : undefined}
        />
      )}

      {mode === 'backtest' && (
        <FieldGroup title="조회 구간">
          <BacktestStartPicker input={input} setInput={setInput} />
          <LumpSumToggle input={input} setInput={setInput} />
        </FieldGroup>
      )}

      <div className="border-t pt-4">
        <ShareLinkButton shareUrl={shareUrl} />
      </div>
    </div>
  );
}
