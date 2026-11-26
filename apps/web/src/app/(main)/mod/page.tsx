import { notFound } from 'next/navigation';
import { getCampusAdmin, getModQueue, getOpenReports, getSuspensions } from '@dtour/shared';
import { currentUser } from '@/lib/supabase-server';
import { ModQueue } from '@/components/ModQueue';
import { CampusAdmin } from '@/components/CampusAdmin';
import { Suspensions } from '@/components/Suspensions';

export const metadata = { title: 'Moderation' };

export default async function ModPage() {
  const { sb, me } = await currentUser();
  if (!me || (me.profile.role !== 'moderator' && me.profile.role !== 'admin')) notFound();
  const [q, reports, campus, suspensions] = await Promise.all([
    getModQueue(sb),
    getOpenReports(sb),
    getCampusAdmin(sb),
    getSuspensions(sb),
  ]);
  return (
    <div className="px" style={{ paddingTop: 36, maxWidth: 900 }}>
      <h1 className="display" style={{ fontSize: 48, margin: 0, letterSpacing: '-.025em' }}>
        Moderation
      </h1>
      <div style={{ font: 'italic 400 19px var(--font-body)', color: 'var(--color-neutral-800)', marginTop: 6 }}>
        Reported posts, new guides and wiki edits wait here for a moderator.
      </div>
      <ModQueue articles={q.articles} revisions={q.revisions} reports={reports} />
      <Suspensions items={suspensions} />
      <h2 className="display" style={{ fontSize: 34, margin: '64px 0 0', letterSpacing: '-.02em' }}>
        Campus content
      </h2>
      <div style={{ font: 'italic 400 17px var(--font-body)', color: 'var(--color-neutral-800)', marginTop: 4 }}>
        What Today, the exam countdown, Team Up deadlines and the Lounge rooms show. Times are in IST.
      </div>
      <CampusAdmin data={campus} isAdmin={me.profile.role === 'admin'} />
    </div>
  );
}
