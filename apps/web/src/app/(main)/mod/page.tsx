import { notFound } from 'next/navigation';
import { getModQueue } from '@dtour/shared';
import { currentUser } from '@/lib/supabase-server';
import { ModQueue } from '@/components/ModQueue';

export const metadata = { title: 'Moderation' };

export default async function ModPage() {
  const { sb, me } = await currentUser();
  if (!me || (me.profile.role !== 'moderator' && me.profile.role !== 'admin')) notFound();
  const q = await getModQueue(sb);
  return (
    <div className="px" style={{ paddingTop: 36, maxWidth: 900 }}>
      <h1 className="display" style={{ fontSize: 48, margin: 0, letterSpacing: '-.025em' }}>Moderation</h1>
      <div style={{ font: 'italic 400 19px var(--font-body)', color: 'var(--color-neutral-800)', marginTop: 6 }}>
        New guides and wiki edits wait here until a moderator approves them.
      </div>
      <ModQueue articles={q.articles} revisions={q.revisions} />
    </div>
  );
}
