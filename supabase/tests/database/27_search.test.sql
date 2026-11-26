-- Search (#18): search() still returns the rows the palette expects. The fuzzy
-- pattern is computed once per call (not once per row), and search() ranks and
-- limits on narrow columns before it builds sub/body (20261017000045), so results
-- and ordering must match a plain query over the search_documents view.
begin;
\ir 00_helpers.sql
select plan(19);

insert into public.threads (id, board_id, author_id, title)
overriding system value values
  (92701, '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-00000000e2e1', 'Qzx unique Wombat endsem'),
  (92702, '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-00000000e2e1', 'Qzx unique Wombat notes'),
  (92703, '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-00000000e2e1', 'Wombat zq a.b'),
  (92704, '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-00000000e2e1', 'Wombat zq axb');
-- Distinct popularity (score + reply_count) and a long body with runs of whitespace,
-- so the excerpt (collapse whitespace, then cut at 220) is exercised.
insert into public.threads (id, board_id, author_id, title, body, score, reply_count)
overriding system value values
  (92705, '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-00000000e2e1', 'Qzx popular Wombat',
   repeat(E'word \n\n  tab\t', 40), 900001, 7),
  (92706, '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-00000000e2e1', 'Qzx quiet Wombat',
   'short', 900000, 0);
insert into public.wiki_articles (id, slug, title, started_by, status)
overriding system value values
  (92701, 'test-18-pending', 'Qzx pending Wombat guide', '00000000-0000-4000-8000-00000000e2e1', 'pending'),
  (92702, 'test-18-live', 'Qzx published Wombat guide', '00000000-0000-4000-8000-00000000e2e1', 'published');

select is((select count(*) from public.search('qzxwomb') where kind = 'Thread'), 4::bigint,
  'a subsequence of a thread title finds it');
select is((select count(*) from public.search('QZX  wom', 'Thread')), 4::bigint,
  'case and spaces in the query are ignored');
select is((select count(*) from public.search('wombatqzx')), 0::bigint,
  'letters in the wrong order do not match');
select is((select count(*) from public.search('qzxwomb', 'Article')), 1::bigint,
  'the kind filter limits the results');
select is((select count(*) from public.search('qzxwomb', null, 1)), 1::bigint,
  'the limit is respected');
select is((select count(*) from public.search('zqa.b')), 1::bigint, 'regex characters in the query are matched literally ("." is not a wildcard)');
select lives_ok($$select * from public.search('a.(b[')$$, 'unbalanced regex characters do not break the query');
select is((select count(*) from public.search('', null, 5)) + (select count(*) from public.search(null, null, 5)), 10::bigint,
  'an empty or missing query lists everything, up to the limit');
select is(pg_temp.count_as('anon', null, $q$select count(*) from public.search('qzxwomb')$q$), 5::bigint,
  'visitors can search: the four threads and the published guide, not the pending guide');
select ok(has_function_privilege('anon', 'public.search(text, text, int)', 'execute')
      and has_function_privilege('anon', 'public.search_total(text)', 'execute'),
  'visitors can run search and search_total');
select is(pg_temp.count_as('anon', null, $q$select count(*) from public.search_documents where kind = 'Article' and title like 'Qzx%'$q$), 1::bigint,
  'only the published guide is searchable');

-- search() must return exactly what the view-based query returned before 20261017000045.
create function pg_temp.search_ref(q text, p_kind text, p_limit int) returns setof public.search_documents
language sql stable as $$
  select * from public.search_documents d
  where (p_kind is null or d.kind = p_kind)
    and (coalesce(q, '') = '' or lower(d.title) ~ (select public.fuzzy_pattern(q)))
  order by d.popularity desc
  limit p_limit
$$;
create temp table cases as
  select q, k from unnest(array['', null, 'a', 'ds', 'e', 'qzx', 'qzxwomb', 'wombat', 'zqa.b', '@e2e', '#', 'pyq', 'notes'])
    as q cross join unnest(array[null, 'Thread', 'Article', 'Library', 'Person', 'Board', 'Society', 'Team', 'Place']) as k;
grant select on cases to anon, authenticated;

select is((select count(distinct kind) from public.search('', null, 100000)), 8::bigint,
  'the comparisons below cover all eight kinds (seed data has every kind)');
select is((
  select count(*) from cases c, lateral (
    (select * from public.search(c.q, c.k, 100000) except all select * from pg_temp.search_ref(c.q, c.k, 100000))
    union all
    (select * from pg_temp.search_ref(c.q, c.k, 100000) except all select * from public.search(c.q, c.k, 100000))
  ) diff), 0::bigint,
  'every query and kind: search() returns the same rows as the view, every column included');
select is((
  select count(*) from cases c, unnest(array[1, 5, 80, 120]) l
  where (select array_agg(popularity) from public.search(c.q, c.k, l))
          is distinct from (select array_agg(popularity) from pg_temp.search_ref(c.q, c.k, l))
     or exists (select * from public.search(c.q, c.k, l)
                except all select * from pg_temp.search_ref(c.q, c.k, 100000))), 0::bigint,
  'with a limit: same popularity order as the view, and only rows the view would return');
select is((select array_agg(title) from public.search('qzx wombat', 'Thread', 2)),
  array['Qzx popular Wombat', 'Qzx quiet Wombat'],
  'the most popular matches come first, and the limit keeps them');
select is((select body from public.search('qzxpopular', 'Thread')),
  left(regexp_replace(repeat(E'word \n\n  tab\t', 40), '\s+', ' ', 'g'), 220),
  'the excerpt collapses whitespace and is cut at 220 characters');
select is((select row(kind, icon, sub, route)::text from public.search('qzxpopular', 'Thread')),
  row('Thread', 'chat-circle', (select coalesce(short_name, name) from public.boards where id = '00000000-0000-4000-8000-000000000201')
      || ' · 900,001 votes · 7 replies', '/t/92705')::text,
  'icon, sub and route are built for the rows that survive the limit');
select is(pg_temp.count_as('anon', null, $q$
  select count(*) from cases c, lateral (
    (select * from public.search(c.q, c.k, 100000) except all
     select * from public.search_documents d where (c.k is null or d.kind = c.k)
       and (coalesce(c.q, '') = '' or lower(d.title) ~ public.fuzzy_pattern(c.q)))
    union all
    (select * from public.search_documents d where (c.k is null or d.kind = c.k)
       and (coalesce(c.q, '') = '' or lower(d.title) ~ public.fuzzy_pattern(c.q))
     except all select * from public.search(c.q, c.k, 100000))
  ) diff$q$), 0::bigint,
  'as a visitor (RLS applies): search() returns the same rows as the view');
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$select count(*) from public.search('qzxpending')$q$), 0::bigint,
  'the pending guide stays out of search, even for its author');

select * from finish();
rollback;
