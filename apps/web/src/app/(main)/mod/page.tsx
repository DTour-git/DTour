import { notFound } from 'next/navigation';
import { getModQueue, getOpenReports } from '@dtour/shared';
import { currentUser } from '@/lib/supabase-server';
import { ModQueue } from '@/components/ModQueue';

export const metadata = { title: 'Moderation' };

export default async function ModPage() {
  const { sb, me } = await currentUser();
  if (!me || (me.profile.role !== 'moderator' && me.profile.role !== 'admin')) notFound();
  const [q, reports] = await Promise.all([getModQueue(sb), getOpenReports(sb)]);
  return (
    <div className="px" style={{ paddingTop: 36, maxWidth: 900 }}>
      <h1 className="display" style={{ fontSize: 48, margin: 0, letterSpacing: '-.025em' }}>Moderation</h1>
      <div style={{ font: 'italic 400 19px var(--font-body)', color: 'var(--color-neutral-800)', marginTop: 6 }}>
        Reported posts, new guides and wiki edits wait here for a moderator.
      </div>
      <ModQueue articles={q.articles} revisions={q.revisions} reports={reports} />
    </div>
  );
}
