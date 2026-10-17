import { redirect } from 'next/navigation';
import { boardPicker, myPostingSocieties } from '@dtour/shared';
import { currentUser } from '@/lib/supabase-server';
import { Composer } from './Composer';

export const metadata = { title: 'New post' };

export default async function NewPost({ searchParams }: { searchParams: Promise<{ type?: string; board?: string; title?: string; draft?: string }> }) {
  const sp = await searchParams;
  const { sb, me } = await currentUser();
  if (!me) redirect('/login?next=/new');
  const [boards, societies, subjects, draft] = await Promise.all([
    boardPicker(sb),
    myPostingSocieties(sb, me.userId),
    sb.from('subjects').select('code,name,branch_code,semester').order('code'),
    sp.draft ? sb.from('drafts').select('*').eq('id', sp.draft).eq('user_id', me.userId).maybeSingle() : Promise.resolve(null),
  ]);
  return <Composer me={me.profile} boards={boards} societies={societies} subjects={subjects.data ?? []} initialType={sp.type} initialBoard={sp.board} initialTitle={sp.title} initialDraft={draft?.data ?? null} />;
}
