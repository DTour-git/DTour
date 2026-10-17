import { redirect } from 'next/navigation';
import { boardPicker, myPostingSocieties } from '@dtour/shared';
import { currentUser } from '@/lib/supabase-server';
import { Composer } from './Composer';

export const metadata = { title: 'New post' };

export default async function NewPost({ searchParams }: { searchParams: Promise<{ type?: string; board?: string; title?: string }> }) {
  const sp = await searchParams;
  const { sb, me } = await currentUser();
  if (!me) redirect('/login?next=/new');
  const [boards, societies, subjects] = await Promise.all([
    boardPicker(sb),
    myPostingSocieties(sb, me.userId),
    sb.from('subjects').select('code,name,branch_code,semester').order('code'),
  ]);
  return <Composer me={me.profile} boards={boards} societies={societies} subjects={subjects.data ?? []} initialType={sp.type} initialBoard={sp.board} initialTitle={sp.title} />;
}
