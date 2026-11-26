-- Search (#18): rank and limit on narrow columns first, then build the wide ones.
--
-- search() used to select from search_documents, which computes `sub` (string
-- concatenation and fmt_n) and the `body` excerpt (regexp_replace over the whole
-- thread body) for every matching row, before `order by popularity limit N`
-- throws all but N of them away. For the empty query (the palette opening) and
-- 1-2 letter queries that is nearly every row of every table.
--
-- Now search() runs in two steps:
--   1. `hits`: kind, primary key, title and popularity of every searchable row,
--      filtered by kind and the same fuzzy pattern, ordered by popularity and
--      limited to p_limit. Only these narrow columns are computed per row.
--   2. For the p_limit survivors only, look the row up again by primary key and
--      compute icon, sub, body and route.
--
-- Results and ordering are unchanged: the sources, joins, filters (published
-- guides only), title, popularity and every wide expression are copied verbatim
-- from search_documents (20261017000005), and the pre-filter is still the
-- subsequence regex from fuzzy_pattern(q), built once per call (20261017000037).
-- Rows with equal popularity were already in no defined order; the step-1 order
-- is kept. The function is still SECURITY INVOKER, so RLS on every table applies
-- in both steps exactly as it does through the view.
--
-- search_documents itself is unchanged and still backs search_total(). If you
-- change a branch of the view, change it here too:
-- supabase/tests/database/27_search.test.sql compares search() with the view.
--
-- `create or replace` keeps the existing ACL (anon, authenticated, service_role).
create or replace function public.search(q text default '', p_kind text default null, p_limit int default 80)
returns setof public.search_documents language sql stable security invoker set search_path = '' as $$
  with hits as (
    -- id for bigint keys, uid for uuid keys: no casts, so no lookup can fail.
    select d.kind, d.id, d.uid, d.title, d.popularity
    from (
      select 'Thread'::text as kind, t.id, null::uuid as uid, t.title, t.score + t.reply_count as popularity
      from public.threads t join public.boards b on b.id = t.board_id
      union all
      select 'Article', a.id, null, a.title, a.views_week + a.useful_count
      from public.wiki_articles a where a.status = 'published'
      union all
      select 'Library', i.id, null, i.title || ' (' || i.subject_code || ')', i.downloads
      from public.library_items i join public.subjects s on s.code = i.subject_code
      union all
      select 'Person', null, p.id, '@' || p.handle, p.karma
      from public.profiles p
      union all
      select 'Board', null, b.id, '#' || b.slug || ' — ' || b.name, b.thread_count
      from public.boards b join public.board_categories c on c.id = b.category_id
      union all
      select 'Society', null, s.id, s.name, 0
      from public.societies s
      union all
      select 'Team', t.id, null, t.title, 0
      from public.teams t
      union all
      select 'Place', p.id, null, p.name, p.hearts + p.recs
      from public.places p
    ) d
    where (p_kind is null or d.kind = p_kind)
      and (coalesce(q, '') = '' or lower(d.title) ~ (select public.fuzzy_pattern(q)))
    order by d.popularity desc
    limit p_limit
  ),
  ordered as (
    select h.*, row_number() over () as n from hits h
  )
  select h.kind, w.icon, h.title, w.sub, w.body, w.route, h.popularity
  from ordered h
  cross join lateral (
    select 'chat-circle'::text as icon,
           coalesce(b.short_name, b.name) || ' · ' || public.fmt_n(t.score) || ' votes · ' || public.fmt_n(t.reply_count) || ' replies' as sub,
           left(regexp_replace(t.body, '\s+', ' ', 'g'), 220) as body,
           '/t/' || t.id as route
    from public.threads t join public.boards b on b.id = t.board_id
    where h.kind = 'Thread' and t.id = h.id
    union all
    select 'article',
           'Wiki · ' || a.editor_count || ' editors' || coalesce(' · checked ' || to_char(a.checked_at, 'Mon YYYY'), ''),
           coalesce(a.dek, ''), '/wiki/' || a.slug
    from public.wiki_articles a
    where h.kind = 'Article' and a.id = h.id
    union all
    select case when i.kind = 'pyq' then 'file-pdf' else 'file-text' end,
           'Library › ' || s.branch_code || ' › Sem ' || s.semester || ' · ' || public.fmt_n(i.downloads) || ' downloads',
           s.name, '/library/subject/' || s.code
    from public.library_items i join public.subjects s on s.code = i.subject_code
    where h.kind = 'Library' and i.id = h.id
    union all
    select 'user',
           coalesce(p.branch_code || ' ''' || right(p.grad_year::text, 2) || ' · ', '') || public.fmt_n(p.karma) || ' karma',
           coalesce(p.bio, ''), '/u/' || p.handle
    from public.profiles p
    where h.kind = 'Person' and p.id = h.uid
    union all
    select 'hash',
           c.name || ' · ' || public.fmt_n(b.thread_count) || ' threads', coalesce(b.description, ''),
           coalesce('/' || b.link_screen, '/b/' || b.slug)
    from public.boards b join public.board_categories c on c.id = b.category_id
    where h.kind = 'Board' and b.id = h.uid
    union all
    select 'flag-banner', case when s.verified then 'Verified society' else 'Society' end,
           coalesce(s.description, ''), '/societies'
    from public.societies s
    where h.kind = 'Society' and s.id = h.uid
    union all
    select 'users-three', 'Team Up · ' || coalesce(t.deadline_label, 'Rolling'),
           coalesce(t.description, ''), '/teams'
    from public.teams t
    where h.kind = 'Team' and t.id = h.id
    union all
    select 'map-pin', 'Kahan chalein? · ' || concat_ws(' · ', p.where_label, p.price_label),
           '', '/kahan-chalein'
    from public.places p
    where h.kind = 'Place' and p.id = h.id
  ) w
  order by h.n
$$;
