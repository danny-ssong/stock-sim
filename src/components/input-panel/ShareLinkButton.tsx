'use client';

import { useState } from 'react';
import { Button } from '../ui/button';

export function ShareLinkButton({
  shareUrl,
}: {
  shareUrl: (options: { includeIncome: boolean }) => string;
}) {
  const [open, setOpen] = useState(false);

  async function copy(includeIncome: boolean) {
    await navigator.clipboard.writeText(shareUrl({ includeIncome }));
    setOpen(false);
  }

  return (
    <div className="relative">
      <Button type="button" variant="outline" onClick={() => setOpen((v) => !v)}>
        링크 공유
      </Button>
      {open && (
        <div className="absolute z-10 mt-1 flex flex-col gap-1 rounded border bg-white p-2 shadow dark:bg-zinc-900">
          <p className="max-w-xs text-xs text-zinc-500">
            연 근로소득은 URL에 그대로 담깁니다. 공유 시 소득이 노출된다는 점을
            확인하세요.
          </p>
          <Button type="button" size="sm" onClick={() => copy(true)}>
            소득 포함 링크 복사
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => copy(false)}>
            소득 제외 링크 복사
          </Button>
        </div>
      )}
    </div>
  );
}
