import { redirect } from 'next/navigation';
import { getConfig, getExamCountdown, getLoungeRooms, getModQueue } from '@dtour/shared';
import { currentUser } from '@/lib/supabase-server';
import { Shell } from '@/components/shell/Shell';
import { Header } from '@/components/shell/Header';
import { SearchPalette } from '@/components/shell/SearchPalette';
import { Lounge } from '@/components/shell/Lounge';

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const { sb, me } = await currentUser();
  if (me && !me.profile.onboarded) redirect('/onboarding');
  const isMod = me?.profile.role === 'moderator' || me?.profile.role === 'admin';
  const [config, exam, rooms, queue] = await Promise.all([
    getConfig(sb), getExamCountdown(sb, me?.profile ?? null), getLoungeRooms(sb), isMod ? getModQueue(sb) : null,
  ]);
  return (
    <Shell me={me?.profile ?? null}>
      <div className="page">
        <Header config={config} exam={exam} modQueue={queue ? queue.articles.length + queue.revisions.length : null} />
        <main>{children}</main>
      </div>
      <Lounge rooms={rooms} />
      <SearchPalette />
    </Shell>
  );
}
