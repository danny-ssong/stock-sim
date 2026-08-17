'use client';

import type { AccountId } from '../../lib/data/types';
import { useSimulationInputState } from '../../hooks/use-simulation-input';
import { useSimulationQueryContext } from '../../hooks/use-simulation-query-context';
import { DEFAULT_EXPOSURE } from '../../lib/url/schema';
import { AllocationSliders } from './AllocationSliders';
import { ExposureSelector } from './ExposureSelector';
import { YearlyScheduleTable } from './YearlyScheduleTable';
import { ReturnSourceToggle } from './ReturnSourceToggle';
import { ShareLinkButton } from './ShareLinkButton';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';

const ALL_ACCOUNT_IDS: AccountId[] = ['DIRECT_US', 'DOMESTIC_ETF', 'ISA'];

function toWeightRecord(
  allocations: { accountId: AccountId; weight: number }[],
): Record<AccountId, number> {
  const record: Record<AccountId, number> = { DIRECT_US: 0, DOMESTIC_ETF: 0, ISA: 0 };
  for (const allocation of allocations) record[allocation.accountId] = allocation.weight;
  return record;
}

export function InputPanel({ mode }: { mode: 'future' | 'backtest' }) {
  // 오늘 환율은 데이터셋 로딩 이후에야 알 수 있다 — Plan 3b~3d가 데이터셋과
  // 함께 연결하기 전까지는 잠정값을 쓴다. 데이터셋이 준비되면 setInput으로
  // 실제 값으로 갱신할 수 있도록 fxAssumption.rate는 계산 시점에만 쓰인다.
  const context = useSimulationQueryContext(mode);
  const { query, setInput, shareUrl } = useSimulationInputState(context);
  const { input, target } = query;
  const isGoalMode = target !== null;

  const weights = toWeightRecord(input.allocations);
  const exposure = input.allocations[0]?.exposure ?? DEFAULT_EXPOSURE;

  return (
    <div className="flex flex-col gap-6 p-4">
      <Label className="flex flex-col gap-1">
        초기 원금(만원)
        <Input
          type="number"
          value={Math.round(input.initialAmount / 10_000)}
          onChange={(e) =>
            setInput({ ...input, initialAmount: Number(e.target.value) * 10_000 })
          }
        />
      </Label>

      <Label className="flex flex-col gap-1">
        월 납입액(만원, 1년차)
        <Input
          type="number"
          disabled={isGoalMode}
          value={Math.round(input.contribution.base / 10_000)}
          onChange={(e) =>
            setInput({
              ...input,
              contribution: { ...input.contribution, base: Number(e.target.value) * 10_000 },
            })
          }
        />
        {isGoalMode && (
          <span className="text-xs text-zinc-500">
            목표금액을 기준으로 자동 계산됩니다 — 결과 화면에서 확인하세요.
          </span>
        )}
      </Label>
      <Label className="flex flex-col gap-1">
        납입액 상승률(%, 매년 1월 증액): {(input.contribution.growthRate * 100).toFixed(1)}
        <Input
          type="range"
          min={0}
          max={20}
          step={0.5}
          value={input.contribution.growthRate * 100}
          onChange={(e) =>
            setInput({
              ...input,
              contribution: { ...input.contribution, growthRate: Number(e.target.value) / 100 },
            })
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
        현재 연봉(만원, 총급여)
        <Input
          type="number"
          value={Math.round(input.employmentIncome.base / 10_000)}
          onChange={(e) =>
            setInput({
              ...input,
              employmentIncome: {
                ...input.employmentIncome,
                base: Number(e.target.value) * 10_000,
              },
            })
          }
        />
      </Label>
      <Label className="flex flex-col gap-1">
        연봉 상승률(%, 납입액 상승률과 별도): {(input.employmentIncome.growthRate * 100).toFixed(1)}
        <Input
          type="range"
          min={0}
          max={10}
          step={0.5}
          value={input.employmentIncome.growthRate * 100}
          onChange={(e) =>
            setInput({
              ...input,
              employmentIncome: {
                ...input.employmentIncome,
                growthRate: Number(e.target.value) / 100,
              },
            })
          }
        />
      </Label>
      <YearlyScheduleTable
        title="연봉"
        schedule={input.employmentIncome}
        years={input.years}
        onChange={(schedule) => setInput({ ...input, employmentIncome: schedule })}
        formatValue={(v) => `${Math.round(v / 10_000).toLocaleString('ko-KR')}만원`}
        displayDivisor={10_000}
      />

      <details className="text-sm">
        <summary className="cursor-pointer text-zinc-500">
          과세표준 직접 입력(정확한 값을 아는 사용자용)
        </summary>
        <Label className="mt-2 flex flex-col gap-1">
          과세표준(만원) — 입력 시 총급여 대신 사용
          <Input
            type="number"
            value={
              input.taxBaseOverride === undefined
                ? ''
                : Math.round(input.taxBaseOverride / 10_000)
            }
            onChange={(e) => {
              const raw = e.target.value;
              setInput({
                ...input,
                taxBaseOverride: raw === '' ? undefined : Number(raw) * 10_000,
              });
            }}
          />
        </Label>
      </details>

      <Label className="flex flex-col gap-1">
        기간(년): {input.years}
        <Input
          type="range"
          min={1}
          max={30}
          value={input.years}
          onChange={(e) => setInput({ ...input, years: Number(e.target.value) })}
        />
      </Label>

      <AllocationSliders
        weights={weights}
        onChange={(next) =>
          setInput({
            ...input,
            allocations: ALL_ACCOUNT_IDS.filter((id) => (next[id] ?? 0) > 0).map((id) => ({
              accountId: id,
              exposure,
              weight: next[id] ?? 0,
            })),
          })
        }
      />

      <ExposureSelector
        value={exposure}
        onChange={(nextExposure) =>
          setInput({
            ...input,
            allocations: input.allocations.map((a) => ({ ...a, exposure: nextExposure })),
          })
        }
        accountIds={input.allocations.map((a) => a.accountId)}
      />

      <ReturnSourceToggle
        value={input.returnSource}
        onChange={(returnSource) => setInput({ ...input, returnSource })}
      />

      <Label className="flex items-center gap-2">
        <Switch
          checked={input.realizationStrategy.type === 'annualDeductionHarvest'}
          onCheckedChange={(checked) =>
            setInput({
              ...input,
              realizationStrategy: checked
                ? { type: 'annualDeductionHarvest' }
                : { type: 'holdUntilExit' },
            })
          }
        />
        연간 250만원 공제 소진
      </Label>

      <Label className="flex items-center gap-2">
        <Switch
          checked={input.displayCurrency === 'USD'}
          onCheckedChange={(checked) =>
            setInput({ ...input, displayCurrency: checked ? 'USD' : 'KRW' })
          }
        />
        달러로 표시
      </Label>

      <ShareLinkButton shareUrl={shareUrl} />
    </div>
  );
}
