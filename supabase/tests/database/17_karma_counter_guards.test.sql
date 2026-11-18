-- Karma and counters can't be preset or farmed (issues #36, #37, #38, #39).
begin;
\ir 00_helpers.sql
select plan(14);

-- e2e1 is the student, e2e2 the moderator account, used here as a second member.
create temp table k0 as select id, karma, accepted_count from public.profiles
  where id in ('00000000-0000-4000-8000-00000000e2e1', '00000000-0000-4000-8000-00000000e2e2');
grant select on k0 to public;
create function pg_temp.dkarma(uid uuid) returns int language sql as $$
  select p.karma - k0.karma from public.profiles p join k0 using (id) where p.id = uid
$$;
create function pg_temp.daccepted(uid uuid) returns int language sql as $$
  select p.accepted_count - k0.accepted_count from public.profiles p join k0 using (id) where p.id = uid
$$;

-- ── #36 A poll's author can't preset its result ──
insert into public.threads (id, board_id, author_id, title, body, kind)
overriding system value values (90301, '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-00000000e2e2', 'Poll guard test', 'body', 'poll');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  $q$insert into public.poll_options (id, thread_id, label, votes) overriding system value values (90391, 90301, 'Rigged', 4321)$q$),
  'ok', 'poll author adds an option');
select is((select votes from public.poll_options where id = 90391), 0, 'a new option starts at 0 votes whatever the client sends');

-- ── #37 No accepting your own answer ──
insert into public.replies (id, thread_id, author_id, body) overriding system value values
  (90311, 90301, '00000000-0000-4000-8000-00000000e2e2', 'my own answer'),
  (90312, 90301, '00000000-0000-4000-8000-00000000e2e1', 'someone else''s answer');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2', 'select public.accept_reply(90301, 90311)'),
  'P0001', 'the thread''s author can''t accept their own reply');
select is(pg_temp.daccepted('00000000-0000-4000-8000-00000000e2e2'), 0, 'no accepted answer was credited');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2', 'select public.accept_reply(90301, 90312)'),
  'ok', 'the thread''s author can still accept someone else''s reply');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2', 'select public.accept_reply(90301, null)'),
  'ok', 'and unaccept it');

-- ── #38 Deleting a thread takes back the karma it and its replies earned ──
delete from k0;
insert into k0 select id, karma, accepted_count from public.profiles
  where id in ('00000000-0000-4000-8000-00000000e2e1', '00000000-0000-4000-8000-00000000e2e2');
insert into public.threads (id, board_id, author_id, title, body)
overriding system value values (90302, '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-00000000e2e2', 'Delete karma test', 'body');
insert into public.replies (id, thread_id, author_id, body) overriding system value values
  (90321, 90302, '00000000-0000-4000-8000-00000000e2e1', 'answer');
select pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', 'select public.set_thread_vote(90302, 1::smallint)');
select pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2', 'select public.set_reply_vote(90321, 1::smallint)');
select pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2', 'select public.accept_reply(90302, 90321)');
select is(pg_temp.dkarma('00000000-0000-4000-8000-00000000e2e1'), 35, 'replier earned +10 upvote and +25 accepted');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2', 'delete from public.threads where id = 90302'),
  'ok', 'author deletes the thread');
select is(pg_temp.dkarma('00000000-0000-4000-8000-00000000e2e2'), 0, 'thread author''s upvote karma is gone');
select is(pg_temp.dkarma('00000000-0000-4000-8000-00000000e2e1'), 0, 'replier''s upvote and accepted karma are gone');
select is(pg_temp.daccepted('00000000-0000-4000-8000-00000000e2e1'), 0, 'accepted count is back');

-- ── #38 Deleting a reply takes back its karma ──
insert into public.threads (id, board_id, author_id, title, body)
overriding system value values (90303, '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-00000000e2e2', 'Reply delete karma test', 'body');
insert into public.replies (id, thread_id, author_id, body) overriding system value values
  (90331, 90303, '00000000-0000-4000-8000-00000000e2e1', 'answer');
select pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2', 'select public.set_reply_vote(90331, 1::smallint)');
select pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2', 'select public.accept_reply(90303, 90331)');
select pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', 'select public.delete_reply(90331)');
select ok(not exists (select 1 from public.replies where id = 90331), 'the reply is removed');
select is(pg_temp.dkarma('00000000-0000-4000-8000-00000000e2e1'), 0, 'its upvote and accepted karma are gone');

-- ── #39 A download counts once per member ──
create temp table d0 as select id, downloads from public.library_items order by id limit 1;
grant select on d0 to public;
select pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', format('select public.record_download(%s)', (select id from d0)));
select pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', format('select public.record_download(%s)', (select id from d0)));
select is((select i.downloads - d0.downloads from public.library_items i join d0 using (id)), 1,
  'downloading the same item twice counts once');

select * from finish();
rollback;
