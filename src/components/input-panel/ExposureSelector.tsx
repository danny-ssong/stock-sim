'use client';

import type { IndexExposure } from '../../lib/data/types';
import { V1_AVAILABLE_EXPOSURES } from '../../lib/url/schema';
import { FIELD_GROUP_TITLE_CLASS } from './FieldGroup';

export function ExposureSelector({
  value,
  onChange,
  name = 'exposure',
}: {
  value: IndexExposure;
  onChange: (exposure: IndexExposure) => void;
  /** 같은 화면에 여러 인스턴스가 렌더링될 때(탭 3의 시나리오별 선택) 네이티브
   *  라디오 그룹이 겹치지 않도록 호출자가 고유한 name을 넘겨야 한다. */
  name?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className={FIELD_GROUP_TITLE_CLASS}>지수 노출</legend>
      {V1_AVAILABLE_EXPOSURES.map((exposure) => (
        <label key={exposure} className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name={name}
            value={exposure}
            checked={value === exposure}
            onChange={() => onChange(exposure)}
          />
          {exposure}
        </label>
      ))}
    </fieldset>
  );
}
