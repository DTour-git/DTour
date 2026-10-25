-- Scores, reply counts and karma are kept by triggers: +10 per upvote, +25 per accepted answer.
begin;
\ir 00_helpers.sql
select plan(6);

-- A thread by the moderator account (inserted directly, as the app would after posting).
insert into public.threads (id, board_id, author_id, title, body)
overriding system value values (90001, '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-00000000e2e2', 'Counter test thread', 'body');
create temp table k0 as select id, karma from public.profiles where id in ('00000000-0000-4000-8000-00000000e2e1', '00000000-0000-4000-8000-00000000e2e2');
grant select on k0 to public;

select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', 'select public.set_thread_vote(90001, 1::smallint)'), 'ok', 'student upvotes');
select is((select score from public.threads where id = 90001), 1, 'thread score went up by one');
select is((select p.karma - k0.karma from public.profiles p join k0 using (id) where p.id = '00000000-0000-4000-8000-00000000e2e2'), 10,
  'author earned +10 karma for the upvote');

select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$insert into public.replies (id, thread_id, author_id, body) overriding system value values (90101, 90001, '00000000-0000-4000-8000-00000000e2e1', 'answer')$q$),
  'ok', 'student replies');
select is((select reply_count from public.threads where id = 90001), 1, 'reply count went up by one');

select pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2', 'select public.accept_reply(90001, 90101)');
select is((select p.karma - k0.karma from public.profiles p join k0 using (id) where p.id = '00000000-0000-4000-8000-00000000e2e1'), 25,
  'accepted answer earned the student +25 karma');

select * from finish();
rollback;
