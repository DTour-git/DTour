-- "Already asked?" suggestions in the composer (#17): full-text search over thread
-- titles/bodies and published wiki titles/deks, plus trigram similarity on titles.
-- The `simple` config does no stemming, which is what we want for Hinglish and
-- abbreviations (pyq, endsem); trigrams catch "endsem" vs "end-sem".
-- Only the first 10,000 characters of a body are indexed: it bounds the work per row
-- and keeps a huge body from overflowing the 1 MB tsvector limit on insert.

create index threads_fts on public.threads using gin (
  (setweight(to_tsvector('simple'::regconfig, title), 'A') || setweight(to_tsvector('simple'::regconfig, left(body, 10000)), 'D'))
);

-- Ranked matches for a draft title: threads and wiki articles in one list, best first.
-- Runs as the caller. Threads are public (removed ones are deleted), and the wiki
-- policy would also show pending articles to their author, so filter on status here.
-- A row is a candidate if a word matches (prefix, so "unit" finds "units") or a title is
-- trigram-similar (>= 0.3, so "endsem" finds "end-sem"); rank orders them.
create or replace function public.similar_threads(q text, p_limit int default 3)
returns table (kind text, id bigint, slug text, title text, board_name text, score int, reply_count int, editor_count int, rank real)
language sql stable security invoker
set search_path = '' set pg_trgm.word_similarity_threshold = '0.3' as $$
  with params as (
    -- "DSA end-sem units" -> 'dsa:* | end:* | sem:* | units:*': words of 3+ letters/digits (as in
    -- titleWords()) minus filler, from at most the first 140 characters (the title limit)
    select left(coalesce(q, ''), 140) as q,
           to_tsquery('simple'::regconfig, string_agg(w || ':*', ' | ')) as tsq
    from regexp_split_to_table(lower(left(coalesce(q, ''), 140)), '[^a-z0-9]+') w
    where length(w) > 2 and w <> all ('{the,and,for,how,can,what,where,when,who,why,are,was,you,your,this,that,with,from,have,has,does,any,get,not,kya,hai,kaise,kahan,kaun,mein}')
  ), hits as (
    select 'thread'::text as kind, t.id, null::text as slug, t.title, coalesce(b.short_name, b.name) as board_name, t.score, t.reply_count, null::int as editor_count,
           (ts_rank(setweight(to_tsvector('simple'::regconfig, t.title), 'A') || setweight(to_tsvector('simple'::regconfig, left(t.body, 10000)), 'D'), p.tsq)
            + extensions.word_similarity(p.q, t.title))::real as rank
    from public.threads t join public.boards b on b.id = t.board_id, params p
    where p.tsq is not null
      and (setweight(to_tsvector('simple'::regconfig, t.title), 'A') || setweight(to_tsvector('simple'::regconfig, left(t.body, 10000)), 'D') @@ p.tsq
           or p.q operator(extensions.<%) t.title)
    union all
    select 'wiki', a.id, a.slug, a.title, null, null, null, a.editor_count,
           (ts_rank(setweight(to_tsvector('simple'::regconfig, a.title), 'A') || setweight(to_tsvector('simple'::regconfig, coalesce(a.dek, '')), 'B'), p.tsq)
            + extensions.word_similarity(p.q, a.title))::real
    from public.wiki_articles a, params p
    where p.tsq is not null and a.status = 'published'
      and (setweight(to_tsvector('simple'::regconfig, a.title), 'A') || setweight(to_tsvector('simple'::regconfig, coalesce(a.dek, '')), 'B') @@ p.tsq
           or p.q operator(extensions.<%) a.title)
  )
  select * from hits
  order by rank desc, id desc
  limit greatest(1, least(coalesce(p_limit, 3), 10))
$$;

grant execute on function public.similar_threads(text, int) to anon, authenticated;
