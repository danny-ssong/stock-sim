/**
 * 입력 패널의 의미 단위 그룹.
 *
 * 그룹 제목 스타일을 상수로 내보내는 이유: ExposureSelector와
 * ReturnSourceToggle은 이미 fieldset+legend라 그 자체가 그룹이다. 이들을
 * FieldGroup으로 한 번 더 감싸면 제목이 두 겹으로 겹치므로, 대신 legend가
 * 같은 스타일을 쓰게 해 네 그룹이 동일하게 보이도록 한다.
 */
export const FIELD_GROUP_TITLE_CLASS =
  'text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400';

export function FieldGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className={FIELD_GROUP_TITLE_CLASS}>{title}</h2>
      {children}
    </section>
  );
}
