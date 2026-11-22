'use client';

import { useRouter } from 'next/navigation';
import { deletePlace } from '@dtour/shared';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { useShell } from './shell/Shell';
import { linkBtn } from './Manage';

/** "Delete" on a place you added, "Remove" on any place for a moderator; nothing for anyone else (#28). */
export function PlaceRemove({ placeId, authorId }: { placeId: number; authorId: string | null }) {
  const { me, toast } = useShell();
  const router = useRouter();
  if (!me) return null;
  const mine = authorId !== null && me.id === authorId;
  const moderator = me.role === 'moderator' || me.role === 'admin';
  if (!mine && !moderator) return null;
  const remove = async () => {
    if (!confirm(mine ? 'Delete the place you added? This can’t be undone.' : 'Remove this place for everyone?')) return;
    try {
      await deletePlace(supabaseBrowser(), placeId);
      toast(mine ? 'Place deleted.' : 'Place removed.');
      router.refresh();
    } catch (e) {
      toast((e as Error).message);
    }
  };
  return (
    <button style={{ ...linkBtn, fontSize: 13, color: 'var(--color-neutral-700)' }} onClick={remove}>
      {mine ? 'Delete' : 'Remove'}
    </button>
  );
}
