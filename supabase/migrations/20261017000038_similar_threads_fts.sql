-- "Already asked?" suggestions in the composer (#17): full-text search over thread
-- titles/bodies and published wiki titles/deks, plus trigram similarity on titles.
-- The `simple` config does no stemming, which is what we want for Hinglish and
-- abbreviations (pyq, endsem); trigrams catch "endsem" vs "end-sem".

create index threads_fts on public.threads using gin (
  (setweight(to_tsvector('simple'::regconfig, title), 'A') || setweight(to_tsvector('simple'::regconfig, body), 'D'))
);
create index wiki_articles_fts on public.wiki_articles using gin (
  (setweight(to_tsvector('simple'::regconfig, title), 'A') || setweight(to_tsvector('simple'::regconfig, coalesce(dek, '')), 'B'))
) where status = 'published';

-- Ranked matches for a draft title: threads and wiki articles in one list, best first.
-- Runs as the caller. Threads are public (removed ones are deleted), and the wiki
-- policy would also show pending articles to their author, so filter on status here.
create or replace function public.similar_threads(q text, p_limit int default 3)
returns table (kind text, id bigint, slug text, title text, board_name text, score int, reply_count int, editor_count int, rank real)
language sql stable security invoker
set search_path = '' set pg_trgm.word_similarity_threshold = '0.3' as $$
  with params as (
    -- "dsa end-sem units" -> 'dsa:* | end:* | sem:* | units:*' (words of 3+ letters/digits, as in titleWords())
    select to_tsquery('simple'::regconfig, string_agg(w || ':*', ' | ')) as tsq
    from regexp_split_to_table(lower(coalesce(q, '')), '[^a-z0-9]+') w
    where length(w) > 2
  ), hits as (
    select 'thread'::text as kind, t.id, null::text as slug, t.title, coalesce(b.short_name, b.name) as board_name, t.score, t.reply_count, null::int as editor_count,
           (ts_rank(setweight(to_tsvector('simple'::regconfig, t.title), 'A') || setweight(to_tsvector('simple'::regconfig, t.body), 'D'), p.tsq)
            + extensions.word_similarity(q, t.title))::real as rank
    from public.threads t join public.boards b on b.id = t.board_id, params p
    where p.tsq is not null
      and (setweight(to_tsvector('simple'::regconfig, t.title), 'A') || setweight(to_tsvector('simple'::regconfig, t.body), 'D') @@ p.tsq
           or q operator(extensions.<%) t.title)
    union all
    select 'wiki', a.id, a.slug, a.title, null, null, null, a.editor_count,
           (ts_rank(setweight(to_tsvector('simple'::regconfig, a.title), 'A') || setweight(to_tsvector('simple'::regconfig, coalesce(a.dek, '')), 'B'), p.tsq)
            + extensions.word_similarity(q, a.title))::real
    from public.wiki_articles a, params p
    where p.tsq is not null and a.status = 'published'
      and (setweight(to_tsvector('simple'::regconfig, a.title), 'A') || setweight(to_tsvector('simple'::regconfig, coalesce(a.dek, '')), 'B') @@ p.tsq
           or q operator(extensions.<%) a.title)
  )
  select * from hits
  where rank >= 0.1
  order by rank desc, id desc
  limit greatest(1, least(coalesce(p_limit, 3), 10))
$$;

grant execute on function public.similar_threads(text, int) to anon, authenticated;
