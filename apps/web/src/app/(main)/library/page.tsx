import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/supabase-server';

export default async function LibraryHome() {
  const { me } = await currentUser();
  const branch = me?.profile.branch_code ?? 'COE';
  const sem = me?.profile.semester ?? 1;
  redirect(`/library/${branch}/${sem}`);
}
