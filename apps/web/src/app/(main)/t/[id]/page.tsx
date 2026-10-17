import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/lib/supabase-server';

// Short link /t/123 → canonical /b/{board}/123
export default async function ThreadShortLink({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sb } = await currentUser();
  const { data } = await sb.from('threads').select('id,board:boards(slug)').eq('id', Number(id)).maybeSingle();
  const slug = (data as unknown as { board: { slug: string } } | null)?.board.slug;
  if (!slug) notFound();
  redirect(`/b/${slug}/${id}`);
}
