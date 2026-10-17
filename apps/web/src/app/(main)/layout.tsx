import { redirect } from 'next/navigation';
import { getConfig, getExamCountdown, getLoungeRooms } from '@dtour/shared';
import { currentUser } from '@/lib/supabase-server';
import { Shell } from '@/components/shell/Shell';
import { Header } from '@/components/shell/Header';
import { SearchPalette } from '@/components/shell/SearchPalette';
import { Lounge } from '@/components/shell/Lounge';

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const { sb, me } = await currentUser();
  if (!me) redirect('/login');
  if (!me.profile.onboarded) redirect('/onboarding');
  const [config, exam, rooms] = await Promise.all([getConfig(sb), getExamCountdown(sb, me.profile), getLoungeRooms(sb)]);
  return (
    <Shell me={me.profile}>
      <div className="page">
        <Header config={config} exam={exam} />
        <main>{children}</main>
      </div>
      <Lounge rooms={rooms} />
      <SearchPalette />
    </Shell>
  );
}
