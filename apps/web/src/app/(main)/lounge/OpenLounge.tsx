'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useShell } from '@/components/shell/Shell';

export function OpenLounge({ room }: { room: string }) {
  const { openLounge } = useShell();
  const router = useRouter();
  useEffect(() => { openLounge(room); router.replace('/'); }, [room]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
