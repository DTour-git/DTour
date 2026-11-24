-- "Already asked?" (#17): similar_threads ranks threads and published wiki guides
-- for a draft title, for visitors and students alike, and never shows pending guides.
-- "quillbert" is a made-up word so these rows rank first whatever demo content exists.
begin;
\ir 00_helpers.sql
select plan(10);

insert into public.threads (id, board_id, author_id, kind, title, body)
overriding system value values
  (90281, (select id from public.boards order by slug limit 1), '00000000-0000-4000-8000-00000000e2e1', 'thread',
   'Quillbert end-sem: which units matter? test-17', 'body'),
  (90282, (select id from public.boards order by slug limit 1), '00000000-0000-4000-8000-00000000e2e1', 'thread',
   'Mess timings test-17', 'mentions quillbert only in the body');
insert into public.wiki_articles (id, slug, title, dek, body, started_by, status)
overriding system value values
  (90283, 'test-17-pending', 'Quillbert pending guide', null, 'x', '00000000-0000-4000-8000-00000000e2e1', 'pending'),
  (90284, 'test-17-live', 'Quillbert endsem guide', null, 'x', '00000000-0000-4000-8000-00000000e2e1', 'published');
-- a body-only match for filler words must not suggest anything
insert into public.threads (id, board_id, author_id, kind, title, body)
overriding system value values
  (90285, (select id from public.boards order by slug limit 1), '00000000-0000-4000-8000-00000000e2e1', 'thread',
   'Mess timings (filler) test-17', 'how can you get the thing, what and why');

create function pg_temp.first_as(r text, uid uuid, q text, lim int default 3) returns text language plpgsql as $$
declare t text;
begin
  perform set_config('request.jwt.claims', pg_temp.claims(uid), true);
  execute format('set local role %I', r);
  select title into t from public.similar_threads(q, lim) order by rank desc, id desc limit 1;
  reset role;
  return t;
end $$;

select is(pg_temp.first_as('anon', null, 'quillbert endsem important units'), 'Quillbert endsem guide',
  'a visitor gets the closest match first ("endsem" matches "end-sem" and "endsem")');
select is(pg_temp.first_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', 'quillbert end-sem units'), 'Quillbert end-sem: which units matter? test-17',
  'a student gets the closest thread first');
select is(pg_temp.count_as('anon', null, $q$select count(*) from public.similar_threads('quillbert endsem units', 10) where title = 'Quillbert pending guide'$q$), 0::bigint,
  'a pending guide is not suggested to visitors');
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', $q$select count(*) from public.similar_threads('quillbert endsem units', 10) where title = 'Quillbert pending guide'$q$), 0::bigint,
  'or to its own author, who can otherwise read it');
select is(pg_temp.count_as('anon', null, $q$select count(*) from public.similar_threads('quillbert', 10) where id = 90282$q$), 1::bigint,
  'a thread whose body matches is suggested too');
select is(pg_temp.count_as('anon', null, $q$select count(*) from public.similar_threads('?! a', 10)$q$), 0::bigint,
  'a title with no searchable words suggests nothing');
select is(pg_temp.count_as('anon', null, $q$select count(*) from public.similar_threads('quillbert endsem units', 0)$q$), 1::bigint,
  'a limit below 1 still returns one row');
select is(pg_temp.count_as('anon', null, $q$select count(*) from public.similar_threads('how can you get the what and why', 10)$q$), 0::bigint,
  'filler words alone suggest nothing');
insert into public.threads (id, board_id, author_id, kind, title)
overriding system value
select 91000 + n, (select id from public.boards order by slug limit 1), '00000000-0000-4000-8000-00000000e2e1', 'thread', 'Quillbert filler ' || n
from generate_series(1, 12) n;
select is(pg_temp.count_as('anon', null, $q$select count(*) from public.similar_threads('quillbert', 1000)$q$), 10::bigint,
  'a large limit is capped at 10');

delete from public.threads where id = 90281;
select is(pg_temp.count_as('anon', null, $q$select count(*) from public.similar_threads('quillbert endsem units', 10) where id = 90281 and kind = 'thread'$q$), 0::bigint,
  'a deleted thread is no longer suggested');

select * from finish();
rollback;
