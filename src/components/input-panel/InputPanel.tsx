'use client';

import { useSimulationInputState } from '../../hooks/use-simulation-input';
import { useSimulationQueryContext } from '../../hooks/use-simulation-query-context';
import { BacktestStartPicker } from './BacktestStartPicker';
import { ExposureSelector } from './ExposureSelector';
import { isLumpSum, LumpSumToggle } from './LumpSumToggle';
import { YearlyScheduleTable } from './YearlyScheduleTable';
import { ReturnSourceToggle } from './ReturnSourceToggle';
import { ShareLinkButton } from './ShareLinkButton';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

export function InputPanel({ mode }: { mode: 'future' | 'backtest' | 'compare' }) {
  const context = useSimulationQueryContext(mode === 'backtest' ? 'backtest' : 'future');
  const { query, setInput, shareUrl } = useSimulationInputState(context);
  const { input, target } = query;
  const isGoalMode = mode === 'future' && target !== null;
  const lumpSum = mode === 'backtest' && isLumpSum(input);

  return (
    <div className="flex flex-col gap-6 p-4">
      <Label className="flex flex-col gap-1">
        초기 원금(만원)
        <Input
          type="number"
          value={Math.round(input.initialAmount / 10_000)}
          onChange={(e) => setInput({ ...input, initialAmount: Number(e.target.value) * 10_000 })}
        />
      </Label>

      <Label className="flex flex-col gap-1">
        월 납입액(만원, 1년차)
        <Input
          type="number"
          disabled={isGoalMode || lumpSum}
          value={Math.round(input.contribution.base / 10_000)}
          onChange={(e) =>
            setInput({ ...input, contribution: { ...input.contribution, base: Number(e.target.value) * 10_000 } })
          }
        />
        <Input
          type="range" min={0} max={3_000_000} step={10_000}
          disabled={isGoalMode || lumpSum}
          value={input.contribution.base}
          onChange={(e) =>
            setInput({ ...input, contribution: { ...input.contribution, base: Number(e.target.value) } })
          }
        />
        {isGoalMode && (
          <span className="text-xs text-zinc-500">목표금액을 기준으로 자동 계산됩니다 — 결과 화면에서 확인하세요.</span>
        )}
      </Label>
      <Label className="flex flex-col gap-1">
        납입액 상승률(%, 매년 1월 증액): {(input.contribution.growthRate * 100).toFixed(1)}
        <Input
          type="range" min={0} max={20} step={0.5}
          disabled={isGoalMode || lumpSum}
          value={input.contribution.growthRate * 100}
          onChange={(e) =>
            setInput({ ...input, contribution: { ...input.contribution, growthRate: Number(e.target.value) / 100 } })
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

      <Label className="flex flex-col gap-1">
        기간(년): {input.years}
        <Input type="range" min={1} max={30} value={input.years} onChange={(e) => setInput({ ...input, years: Number(e.target.value) })} />
      </Label>

      {mode !== 'compare' && (
        <ExposureSelector value={input.exposure} onChange={(exposure) => setInput({ ...input, exposure })} />
      )}

      {(mode === 'future' || mode === 'compare') && (
        <ReturnSourceToggle value={input.returnSource} onChange={(returnSource) => setInput({ ...input, returnSource })} />
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
