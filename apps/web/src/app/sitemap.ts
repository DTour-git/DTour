import type { MetadataRoute } from 'next';
import { supabaseServer } from '@/lib/supabase-server';
import { SITE_URL } from '@/lib/seo';

// Reading through supabaseServer() (it uses cookies()) makes this render per request instead of at build time,
// when there is no database to ask. Supabase returns at most 1000 rows per request, so threads are read in pages.
const PAGE = 1000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const urls = ['/', '/boards', '/wiki', '/library', '/societies'].map((path) => ({ url: SITE_URL + path }));
  try {
    const sb = await supabaseServer();
    // Pending and demo content stay out (removed threads are deleted rows). Boards are kept when demo content is cleared, so all are listed.
    const [boards, wiki, subjects] = await Promise.all([
      sb.from('boards').select('slug').is('link_screen', null),
      sb.from('wiki_articles').select('slug,updated_at').eq('status', 'published').eq('is_demo', false),
      sb.from('subjects').select('code'),
    ]);
    urls.push(
      ...(boards.data ?? []).map((b) => ({ url: `${SITE_URL}/b/${b.slug}` })),
      ...(wiki.data ?? []).map((a) => ({ url: `${SITE_URL}/wiki/${a.slug}`, lastModified: a.updated_at })),
      ...(subjects.data ?? []).map((s) => ({ url: `${SITE_URL}/library/subject/${s.code}` })),
    );
    for (let from = 0; ; from += PAGE) {
      const { data } = await sb
        .from('threads')
        .select('id,updated_at,board:boards(slug)')
        .eq('is_demo', false)
        .order('id')
        .range(from, from + PAGE - 1);
      urls.push(
        ...(data ?? []).filter((t) => t.board).map((t) => ({ url: `${SITE_URL}/b/${t.board!.slug}/${t.id}`, lastModified: t.updated_at })),
      );
      if ((data?.length ?? 0) < PAGE) break;
    }
  } catch {
    /* the static pages are still worth listing */
  }
  return urls;
}
