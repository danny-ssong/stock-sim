'use client';

import type { AccountId, IndexExposure } from '../../lib/data/types';
import { ALL_ACCOUNT_IDS, toWeightRecord } from '../../lib/allocation';
import { DEFAULT_EXPOSURE } from '../../lib/url/schema';
import { defaultLabel, MAX_SCENARIOS, MIN_SCENARIOS } from '../../lib/url/scenarios';
import type { ScenarioConfig } from '../../lib/sim/compare';
import { AllocationSliders } from './AllocationSliders';
import { ExposureSelector } from './ExposureSelector';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

const TRANSFER_ACCOUNT_IDS: AccountId[] = ['DIRECT_US', 'ISA'];

function newAllocationScenario(index: number): ScenarioConfig {
  return {
    kind: 'allocation',
    label: defaultLabel(index),
    allocations: [{ accountId: 'ISA', exposure: DEFAULT_EXPOSURE, weight: 1 }],
  };
}

/** §8 "시나리오를 최대 4개까지 나란히 비교" — 각 시나리오는 allocation(계좌×노출×
 *  배분) 또는 transfer(해외직투→ISA 이전) 중 하나다. transfer는 compareTransfer가
 *  전액 이전 + 해외직투 단일 계좌만 지원하므로 배분 슬라이더 대신 이전 시점
 *  슬라이더만 보여준다(lib/sim/compare.ts 설계 결정 참조). */
export function ScenarioEditor({
  scenarios,
  onChange,
  years,
}: {
  scenarios: ScenarioConfig[];
  onChange: (next: ScenarioConfig[]) => void;
  years: number;
}) {
  const updateAt = (index: number, next: ScenarioConfig) => {
    onChange(scenarios.map((s, i) => (i === index ? next : s)));
  };

  const removeAt = (index: number) => {
    onChange(scenarios.filter((_, i) => i !== index));
  };

  const addScenario = () => {
    onChange([...scenarios, newAllocationScenario(scenarios.length)]);
  };

  return (
    <div className="flex flex-col gap-6">
      {scenarios.map((scenario, index) => {
        const weights =
          scenario.kind === 'allocation' ? toWeightRecord(scenario.allocations) : null;
        const accountIds =
          scenario.kind === 'allocation'
            ? scenario.allocations.map((a) => a.accountId)
            : TRANSFER_ACCOUNT_IDS;
        const exposure =
          scenario.kind === 'allocation'
            ? (scenario.allocations[0]?.exposure ?? DEFAULT_EXPOSURE)
            : scenario.exposure;

        return (
          <fieldset key={index} className="flex flex-col gap-3 rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Input
                value={scenario.label}
                onChange={(e) => updateAt(index, { ...scenario, label: e.target.value })}
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                disabled={scenarios.length <= MIN_SCENARIOS}
                onClick={() => removeAt(index)}
              >
                삭제
              </Button>
            </div>

            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name={`scenario-kind-${index}`}
                  checked={scenario.kind === 'allocation'}
                  onChange={() =>
                    updateAt(index, {
                      kind: 'allocation',
                      label: scenario.label,
                      allocations: [{ accountId: 'ISA', exposure, weight: 1 }],
                    })
                  }
                />
                계좌·노출 조합
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name={`scenario-kind-${index}`}
                  checked={scenario.kind === 'transfer'}
                  onChange={() =>
                    updateAt(index, {
                      kind: 'transfer',
                      label: scenario.label,
                      exposure,
                      transferYear: Math.max(1, Math.min(years - 1, 3)),
                    })
                  }
                />
                해외직투 → ISA 이전
              </label>
            </div>

            {scenario.kind === 'allocation' && weights !== null && (
              <>
                <AllocationSliders
                  weights={weights}
                  onChange={(nextWeights) =>
                    updateAt(index, {
                      ...scenario,
                      allocations: ALL_ACCOUNT_IDS.filter(
                        (id) => (nextWeights[id] ?? 0) > 0,
                      ).map((id) => ({
                        accountId: id,
                        exposure,
                        weight: nextWeights[id] ?? 0,
                      })),
                    })
                  }
                />
                <ExposureSelector
                  value={exposure}
                  onChange={(nextExposure: IndexExposure) =>
                    updateAt(index, {
                      ...scenario,
                      allocations: scenario.allocations.map((a) => ({
                        ...a,
                        exposure: nextExposure,
                      })),
                    })
                  }
                  accountIds={accountIds}
                />
              </>
            )}

            {scenario.kind === 'transfer' && (
              <>
                <ExposureSelector
                  value={exposure}
                  onChange={(nextExposure: IndexExposure) =>
                    updateAt(index, { ...scenario, exposure: nextExposure })
                  }
                  accountIds={accountIds}
                />
                <Label className="flex flex-col gap-1 text-sm">
                  이전 시점(연차): {scenario.transferYear}
                  <input
                    type="range"
                    min={1}
                    max={Math.max(1, years - 1)}
                    value={scenario.transferYear}
                    onChange={(e) =>
                      updateAt(index, { ...scenario, transferYear: Number(e.target.value) })
                    }
                  />
                </Label>
              </>
            )}
          </fieldset>
        );
      })}

      <Button type="button" disabled={scenarios.length >= MAX_SCENARIOS} onClick={addScenario}>
        + 시나리오 추가
      </Button>
    </div>
  );
}
