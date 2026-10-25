'use client';

import { useEffect, useState } from 'react';
import { handleProblem, handleStatus, handleStatusMessage, normalizeHandle, type HandleStatus } from '@dtour/shared';
import { supabaseBrowser } from './supabase-browser';

/** Live, debounced check of a handle as it's typed. */
export function useHandleCheck(value: string, current: string) {
  const h = normalizeHandle(value);
  const [result, setResult] = useState<{ for: string; status: HandleStatus } | null>(null);
  useEffect(() => {
    if (h === current || handleProblem(h)) return;
    let alive = true;
    const t = setTimeout(async () => {
      try { const status = await handleStatus(supabaseBrowser(), h); if (alive) setResult({ for: h, status }); } catch { /* offline: the save will check again */ }
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [h, current]);
  const status: HandleStatus | 'unchanged' | 'checking' = h === current ? 'unchanged'
    : handleProblem(h) ? 'invalid'
    : result?.for === h ? result.status : 'checking';
  const message = status === 'unchanged' ? null
    : status === 'checking' ? 'Checking…'
    : status === 'available' || status === 'yours' ? `@${h} is available.`
    : handleStatusMessage(status, h);
  return { handle: h, status, message, ok: status === 'unchanged' || status === 'available' || status === 'yours' };
}
