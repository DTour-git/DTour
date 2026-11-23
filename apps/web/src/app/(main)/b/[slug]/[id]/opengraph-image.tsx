import { supabaseServer } from '@/lib/supabase-server';
import { ogImage, size as imageSize, contentType as imageType } from '@/lib/og';

export const alt = 'DTour thread';
export const size = imageSize;
export const contentType = imageType;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const sb = await supabaseServer();
    const { data } = await sb.from('threads').select('title,board:boards(name)').eq('id', Number(id)).maybeSingle();
    if (data) return await ogImage(data.title, data.board?.name);
  } catch { /* fall through to the default card: a share image must never fail */ }
  return ogImage('The campus, all in one place.');
}
