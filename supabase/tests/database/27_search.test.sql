-- Search (#18): search() still returns the rows the palette expects. The fuzzy
-- pattern is computed once per call (not once per row), so results must not change.
begin;
\ir 00_helpers.sql
select plan(9);

insert into public.threads (id, board_id, author_id, title)
overriding system value values
  (92701, '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-00000000e2e1', 'Qzx unique Wombat endsem'),
  (92702, '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-00000000e2e1', 'Qzx unique Wombat notes');
insert into public.wiki_articles (id, slug, title, started_by, status)
overriding system value values
  (92701, 'test-18-pending', 'Qzx pending Wombat guide', '00000000-0000-4000-8000-00000000e2e1', 'pending');

select is((select count(*) from public.search('qzxwomb') where kind = 'Thread'), 2::bigint,
  'a subsequence of a thread title finds it');
select is((select count(*) from public.search('QZX  wom')), 2::bigint,
  'case and spaces in the query are ignored');
select is((select count(*) from public.search('wombatqzx')), 0::bigint,
  'letters in the wrong order do not match');
select is((select count(*) from public.search('qzxwomb', 'Article')), 0::bigint,
  'the kind filter limits the results');
select is((select count(*) from public.search('qzxwomb', null, 1)), 1::bigint,
  'the limit is respected');
select lives_ok($$select * from public.search('a.(b[')$$, 'regex characters in the query are matched literally');
select is(pg_temp.count_as('anon', null, $q$select count(*) from public.search('qzxwomb')$q$), 2::bigint,
  'visitors can search, and the pending guide is not in the results');
select ok(has_function_privilege('anon', 'public.search(text, text, int)', 'execute')
      and has_function_privilege('anon', 'public.search_total(text)', 'execute'),
  'visitors can run search and search_total');
select is(pg_temp.count_as('anon', null, $q$select count(*) from public.search_documents where kind = 'Article' and title like 'Qzx%'$q$), 0::bigint,
  'the pending guide is not searchable');

select * from finish();
rollback;
