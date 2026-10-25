-- Reading is public; writing needs an account, and only as yourself.
begin;
\ir 00_helpers.sql
select plan(8);

select ok(pg_temp.count_as('anon', null, 'select count(*) from public.threads') > 0, 'visitors can read threads');
select ok(pg_temp.count_as('anon', null, 'select count(*) from public.wiki_articles') > 0, 'visitors can read published wiki articles');
select isnt(pg_temp.try_as('anon', null,
  $q$insert into public.threads (board_id, author_id, title) values ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-00000000e2e1', 'anon post')$q$),
  'ok', 'visitors cannot post threads');
select isnt(pg_temp.try_as('anon', null, 'select count(*) from public.saves'), 'ok', 'visitors cannot read anyone''s saves');

select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$insert into public.replies (thread_id, author_id, body) values (3, '00000000-0000-4000-8000-00000000e2e1', 'reply as myself')$q$),
  'ok', 'members can reply as themselves');
select isnt(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$insert into public.replies (thread_id, author_id, body) values (3, '00000000-0000-4000-8000-00000000e2e2', 'pretending to be someone else')$q$),
  'ok', 'members cannot post as someone else');

insert into public.saves (user_id, thread_id) values ('00000000-0000-4000-8000-00000000e2e2', 3);
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', 'select count(*) from public.saves'), 0::bigint,
  'members cannot see other people''s saves');
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e2', 'select count(*) from public.saves'), 1::bigint,
  'members see their own saves');

select * from finish();
rollback;
