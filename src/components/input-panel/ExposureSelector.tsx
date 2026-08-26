'use client';

import { exposureLabelWithTicker } from '../../lib/data/labels';
import type { IndexExposure } from '../../lib/data/types';
import { MAX_EXPOSURES, toggleExposure, V1_AVAILABLE_EXPOSURES } from '../../lib/url/exposures';
import { FIELD_GROUP_TITLE_CLASS } from './FieldGroup';

/**
 * 비교 축. 체크를 하나 더 켜는 행위가 곧 비교의 시작이다 — 별도의 "비교 모드"가
 * 없는 이유다.
 *
 * 선택 규칙(마지막 하나는 해제 불가, 최대 MAX_EXPOSURES개)은 toggleExposure가
 * 지킨다. 여기서는 왜 누를 수 없는지를 시각적으로만 알린다 — 규칙을 UI에도 두면
 * 두 곳이 갈릴 수 있다.
 */
export function ExposureSelector({
  value,
  onChange,
}: {
  value: IndexExposure[];
  onChange: (next: IndexExposure[]) => void;
}) {
  const isFull = value.length >= MAX_EXPOSURES;
  const isOnlyOne = value.length <= 1;

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className={FIELD_GROUP_TITLE_CLASS}>비교할 상품</legend>
      {V1_AVAILABLE_EXPOSURES.map((exposure) => {
        const checked = value.includes(exposure);
        const disabled = checked ? isOnlyOne : isFull;
        return (
          <label
            key={exposure}
            className={`flex items-center gap-2 text-sm ${disabled ? 'text-zinc-400 dark:text-zinc-600' : ''}`}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={() => onChange(toggleExposure(value, exposure))}
            />
            {exposureLabelWithTicker(exposure)}
          </label>
        );
      })}
    </fieldset>
  );
}
