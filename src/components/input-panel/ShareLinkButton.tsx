'use client';

import { useState } from 'react';
import { Button } from '../ui/button';

export function ShareLinkButton({ shareUrl }: { shareUrl: () => string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl());
      setStatus('copied');
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" onClick={copy}>
        링크 공유
      </Button>
      {status === 'copied' && <p className="text-xs text-green-600">복사됐습니다.</p>}
      {status === 'error' && <p className="text-xs text-red-600">복사에 실패했습니다 — 브라우저 권한을 확인하세요.</p>}
    </div>
  );
}
