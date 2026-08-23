'use client';

import type { ReturnSource } from '../../lib/sim/types';
import { describePathAssumption } from '../../lib/market/returns';
import { InfoTooltip } from '../ui/tooltip';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { FIELD_GROUP_TITLE_CLASS } from './FieldGroup';
import { HistoricalPeakPresetButtons } from './HistoricalPeakPresetButtons';
import { SliderField } from './SliderField';

/** 고정 수익률 슬라이더: -20~30%, 0.5%p 단위 */
const CAGR_MIN_PERCENT = -20;
const CAGR_MAX_PERCENT = 30;
const CAGR_STEP_PERCENT = 0.5;

/** 재생 구간을 아직 고르지 않았을 때(고정 수익률 선택 중) 보여줄 일반 설명 */
const GENERIC_PATH_HINT =
  '선택한 과거 구간의 실제 일별 수익률을 그대로 재생합니다. 구간이 설계 기간보다 짧으면 처음부터 반복합니다.';

export function ReturnSourceToggle({
  value,
  onChange,
  years,
  comparing = false,
}: {
  value: ReturnSource;
  onChange: (source: ReturnSource) => void;
  /** 재생 구간 설명 툴팁이 "몇 회 반복해 기간을 채우는지" 계산하는 데 쓴다 */
  years: number;
  /** 노출을 2개 이상 비교하는 중이면 고정 수익률 선택지를 아예 감춘다 — 엔진이
   *  고정 수익률에서는 상품을 보지 않아(engine.ts) 어떤 노출을 골라도 카드가
   *  바이트 단위로 동일해진다. 파싱 단계에서 이미 과거 흐름 재생으로 교정돼
   *  있으므로(schema.ts) 여기서는 라디오만 숨기면 된다. */
  comparing?: boolean;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className={FIELD_GROUP_TITLE_CLASS}>수익률 가정</legend>
      {comparing ? (
        <p className="text-xs text-zinc-500">
          여러 상품을 비교할 때는 실제 과거 흐름을 그대로 재생합니다 — 고정 수익률
          가정은 상품 간 차이를 표현하지 못하기 때문입니다.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          {/* 툴팁 트리거는 label 밖에 둔다 — label 안의 button을 누르면 라디오가
              함께 토글돼 의도치 않게 모드가 바뀐다. */}
          <span className="flex items-center gap-1">
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="return-source"
                checked={value.type === 'historicalPath'}
                onChange={() =>
                  onChange({
                    type: 'historicalPath',
                    from: value.type === 'historicalPath' ? value.from : '2011-08-01',
                    to: value.type === 'historicalPath' ? value.to : '2026-08-01',
                    tileMode: 'repeat',
                  })
                }
              />
              과거 흐름 재생
            </label>
            <InfoTooltip label="과거 흐름 재생 방식 설명">
              {value.type === 'historicalPath'
                ? describePathAssumption(value.from, value.to, years)
                : GENERIC_PATH_HINT}
            </InfoTooltip>
          </span>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="return-source"
              checked={value.type === 'constantCagr'}
              onChange={() => onChange({ type: 'constantCagr', annualRate: 0.08 })}
            />
            고정 수익률
          </label>
        </div>
      )}

      {value.type === 'historicalPath' ? (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Label className="flex flex-col items-stretch text-xs">
              시작
              <Input
                type="date"
                value={value.from}
                onChange={(e) => onChange({ ...value, from: e.target.value })}
              />
            </Label>
            <Label className="flex flex-col items-stretch text-xs">
              종료
              <Input
                type="date"
                value={value.to}
                onChange={(e) => onChange({ ...value, to: e.target.value })}
              />
            </Label>
          </div>
          <HistoricalPeakPresetButtons
            from={value.from}
            onSelectRange={(from, to) => onChange({ ...value, from, to })}
          />
        </div>
      ) : (
        <SliderField
          label="연 수익률"
          value={value.annualRate * 100}
          onChange={(percent) => onChange({ type: 'constantCagr', annualRate: percent / 100 })}
          min={CAGR_MIN_PERCENT}
          max={CAGR_MAX_PERCENT}
          step={CAGR_STEP_PERCENT}
          formatValue={(percent) => `${percent.toFixed(1)}%`}
        />
      )}
    </fieldset>
  );
}
