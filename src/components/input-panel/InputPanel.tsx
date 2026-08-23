'use client';

import { useHistoricalCagrAutoFill } from '../../hooks/use-historical-cagr-auto-fill';
import { useScenariosState } from '../../hooks/use-scenarios';
import { useSimulationInputState } from '../../hooks/use-simulation-input';
import { useSimulationQueryContext } from '../../hooks/use-simulation-query-context';
import { DEFAULT_EXPOSURE, MAX_FUTURE_YEARS } from '../../lib/url/schema';
import { BacktestStartPicker } from './BacktestStartPicker';
import { BacktestYearsInput } from './BacktestYearsInput';
import { ExposureSelector } from './ExposureSelector';
import { isLumpSum, LumpSumToggle } from './LumpSumToggle';
import { YearlyScheduleTable } from './YearlyScheduleTable';
import { ReturnSourceToggle } from './ReturnSourceToggle';
import { ShareLinkButton } from './ShareLinkButton';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Slider } from '../ui/slider';

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
    <div className="flex flex-col gap-6 p-4">
      <Label className="flex flex-col gap-1">
        초기 원금(억원)
        <Input
          type="number"
          value={Math.round(input.initialAmount / 10_000) / 10_000}
          onChange={(e) => setInput({ ...input, initialAmount: Math.round(Number(e.target.value) * 100_000_000) })}
        />
      </Label>

      <Label className="flex flex-col gap-1">
        월 납입액(만원, 1년차)
        <Input
          type="number"
          className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          disabled={lumpSum}
          value={Math.round(input.contribution.base / 10_000)}
          onChange={(e) =>
            setInput({ ...input, contribution: { ...input.contribution, base: Number(e.target.value) * 10_000 } })
          }
        />
        <Slider
          min={0} max={3_000_000} step={10_000}
          disabled={lumpSum}
          value={[input.contribution.base]}
          onValueChange={([v]) =>
            setInput({ ...input, contribution: { ...input.contribution, base: v } })
          }
        />
      </Label>
      <Label className="flex flex-col gap-1">
        납입액 상승률(%, 매년 1월 증액): {(input.contribution.growthRate * 100).toFixed(1)}
        <Slider
          min={0} max={20} step={0.5}
          disabled={lumpSum}
          value={[input.contribution.growthRate * 100]}
          onValueChange={([v]) =>
            setInput({ ...input, contribution: { ...input.contribution, growthRate: v / 100 } })
          }
        />
      </Label>
      <YearlyScheduleTable
        title="월 납입액"
        schedule={input.contribution}
        years={input.years}
        onChange={(schedule) => setInput({ ...input, contribution: schedule })}
        formatValue={(v) => `${Math.round(v / 10_000).toLocaleString('ko-KR')}만원`}
        displayDivisor={10_000}
      />

      {mode === 'backtest' ? (
        <BacktestYearsInput input={input} setInput={setInput} />
      ) : (
        <Label className="flex flex-col gap-1">
          기간(년): {input.years}
          <Slider
            min={1}
            max={MAX_FUTURE_YEARS}
            value={[input.years]}
            onValueChange={([v]) => setInput({ ...input, years: v })}
          />
        </Label>
      )}

      {mode !== 'compare' && (
        <ExposureSelector value={input.exposure} onChange={(exposure) => setInput({ ...input, exposure })} />
      )}

      {(mode === 'future' || mode === 'compare') && (
        <ReturnSourceToggle
          value={input.returnSource}
          onChange={(returnSource) => setInput({ ...input, returnSource })}
          exposure={mode === 'future' ? input.exposure : undefined}
        />
      )}
      {mode === 'backtest' && (
        <>
          <BacktestStartPicker input={input} setInput={setInput} />
          <LumpSumToggle input={input} setInput={setInput} />
        </>
      )}

      <ShareLinkButton shareUrl={shareUrl} />
    </div>
  );
}
