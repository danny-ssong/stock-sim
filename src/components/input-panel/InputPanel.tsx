'use client';

import { ALL_ACCOUNT_IDS, toWeightRecord } from '../../lib/allocation';
import { useSimulationInputState } from '../../hooks/use-simulation-input';
import { useSimulationQueryContext } from '../../hooks/use-simulation-query-context';
import { DEFAULT_EXPOSURE } from '../../lib/url/schema';
import { AllocationSliders } from './AllocationSliders';
import { BacktestStartPicker } from './BacktestStartPicker';
import { ExposureSelector } from './ExposureSelector';
import { isLumpSum, LumpSumToggle } from './LumpSumToggle';
import { YearlyScheduleTable } from './YearlyScheduleTable';
import { ReturnSourceToggle } from './ReturnSourceToggle';
import { ShareLinkButton } from './ShareLinkButton';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';

export function InputPanel({ mode }: { mode: 'future' | 'backtest' | 'compare' }) {
  // 오늘 환율은 데이터셋 로딩 이후에야 알 수 있다 — Plan 3b~3d가 데이터셋과
  // 함께 연결하기 전까지는 잠정값을 쓴다. 데이터셋이 준비되면 setInput으로
  // 실제 값으로 갱신할 수 있도록 fxAssumption.rate는 계산 시점에만 쓰인다.
  // QueryContext.mode는 'future' | 'backtest'만 정의한다(SimulationInput.mode와
  // 마찬가지로 엔진의 달력 생성 방식만 가르는 값이라 'compare'로 확장하지 않는다).
  // 탭 3(compare)은 미래 시뮬레이션이므로 탭 1과 동일한 'future' 규칙(고정 환율
  // 기본값, 오늘을 시작월로)을 그대로 물려받는다.
  const context = useSimulationQueryContext(mode === 'backtest' ? 'backtest' : 'future');
  const { query, setInput, shareUrl } = useSimulationInputState(context);
  const { input, target } = query;
  // target은 TabsNav가 쿼리스트링을 그대로 물려주므로 탭 1에서 목표금액을
  // 설정한 뒤 탭 2로 이동해도 target이 URL에 남는다. 탭 2에는 GoalSeekPanel이
  // 없으므로 target 유무와 무관하게 항상 직접 입력 모드여야 한다(M17류 버그 예방).
  const isGoalMode = mode === 'future' && target !== null;
  const lumpSum = mode === 'backtest' && isLumpSum(input);

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
          disabled={isGoalMode || lumpSum}
          value={Math.round(input.contribution.base / 10_000)}
          onChange={(e) =>
            setInput({
              ...input,
              contribution: { ...input.contribution, base: Number(e.target.value) * 10_000 },
            })
          }
        />
        <Input
          type="range"
          min={0}
          max={3_000_000}
          step={10_000}
          disabled={isGoalMode || lumpSum}
          value={input.contribution.base}
          onChange={(e) =>
            setInput({
              ...input,
              contribution: { ...input.contribution, base: Number(e.target.value) },
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
          disabled={isGoalMode || lumpSum}
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
        <span>
          마지막 해 예상 연봉(만원, 총급여)
          <span
            className="ml-1 cursor-help text-zinc-400"
            title="매도 시점 세금 계산에만 사용됩니다. 보유 기간 중에는 반영되지 않습니다."
          >
            ⓘ
          </span>
        </span>
        <Input
          type="number"
          value={Math.round(input.finalYearIncome / 10_000)}
          onChange={(e) =>
            setInput({ ...input, finalYearIncome: Number(e.target.value) * 10_000 })
          }
        />
      </Label>

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

      {mode !== 'compare' && (
        <>
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

          {(weights.ISA ?? 0) > 0 && (
            <Label className="flex flex-col gap-1">
              ISA 기존 가입년차(신규면 0)
              <Input
                type="number"
                min={0}
                value={input.isaExistingYears}
                onChange={(e) =>
                  setInput({
                    ...input,
                    isaExistingYears: Math.max(0, Math.round(Number(e.target.value))),
                  })
                }
              />
            </Label>
          )}
        </>
      )}

      {(mode === 'future' || mode === 'compare') && (
        <ReturnSourceToggle
          value={input.returnSource}
          onChange={(returnSource) => setInput({ ...input, returnSource })}
        />
      )}
      {mode === 'backtest' && (
        <>
          <BacktestStartPicker input={input} setInput={setInput} />
          <LumpSumToggle input={input} setInput={setInput} />
        </>
      )}

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
