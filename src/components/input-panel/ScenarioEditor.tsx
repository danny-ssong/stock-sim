'use client';

import type { IndexExposure } from '../../lib/data/types';
import { defaultLabel, MAX_SCENARIOS, MIN_SCENARIOS } from '../../lib/url/scenarios';
import type { ScenarioConfig } from '../../lib/sim/compare';
import { ExposureSelector } from './ExposureSelector';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

function newScenario(index: number): ScenarioConfig {
  return { label: defaultLabel(index), exposure: 'NASDAQ100_1X' };
}

/** 스펙 §5 "시나리오를 최대 4개까지 비교하되, 각 시나리오는 노출 선택만 다르다". */
export function ScenarioEditor({
  scenarios,
  onChange,
}: {
  scenarios: ScenarioConfig[];
  onChange: (next: ScenarioConfig[]) => void;
}) {
  const updateAt = (index: number, next: ScenarioConfig) => {
    onChange(scenarios.map((s, i) => (i === index ? next : s)));
  };
  const removeAt = (index: number) => onChange(scenarios.filter((_, i) => i !== index));
  const addScenario = () => onChange([...scenarios, newScenario(scenarios.length)]);

  return (
    <div className="flex flex-col gap-6">
      {scenarios.map((scenario, index) => (
        <fieldset key={index} className="flex flex-col gap-3 rounded-lg border p-3">
          <div className="flex items-center gap-2">
            <Input
              value={scenario.label}
              onChange={(e) => updateAt(index, { ...scenario, label: e.target.value })}
              className="flex-1"
            />
            <Button type="button" variant="ghost" disabled={scenarios.length <= MIN_SCENARIOS} onClick={() => removeAt(index)}>
              삭제
            </Button>
          </div>
          <ExposureSelector
            value={scenario.exposure}
            onChange={(exposure: IndexExposure) => updateAt(index, { ...scenario, exposure })}
            name={`scenario-exposure-${index}`}
          />
        </fieldset>
      ))}
      <Button type="button" disabled={scenarios.length >= MAX_SCENARIOS} onClick={addScenario}>
        + 시나리오 추가
      </Button>
    </div>
  );
}
