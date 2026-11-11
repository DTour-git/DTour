begin;
\ir 00_helpers.sql
select plan(24);

insert into public.threads (id, board_id, author_id, kind, title)
overriding system value values
  (90024, '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-00000000e2e2', 'poll', 'First interaction test'),
  (90025, '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-00000000e2e2', 'poll', 'Second interaction test');
insert into public.replies (id, thread_id, author_id, body)
overriding system value values
  (90024, 90024, '00000000-0000-4000-8000-00000000e2e2', 'first answer'),
  (90025, 90025, '00000000-0000-4000-8000-00000000e2e2', 'second answer');
insert into public.poll_options (id, thread_id, label)
overriding system value values (90024, 90024, 'First option'), (90025, 90024, 'Second option');

select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  'select public.set_thread_vote(90024, 1::smallint)'), 'ok', 'the vote RPC still inserts');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  'update public.thread_votes set thread_id = 90025 where thread_id = 90024'), '23514', 'a thread vote cannot move');
select is((select score from public.threads where id = 90024), 1, 'the original score stays correct');
select is((select score from public.threads where id = 90025), 0, 'the other score stays correct');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  'select public.set_thread_vote(90024, -1::smallint)'), 'ok', 'the vote RPC still changes direction');
select is((select score from public.threads where id = 90024), -1, 'the changed vote updates the score');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  'select public.set_thread_vote(90024, 0::smallint)'), 'ok', 'the vote RPC still removes a vote');
select is((select score from public.threads where id = 90024), 0, 'removing the vote leaves no phantom score');

select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  'select public.set_reply_vote(90024, 1::smallint)'), 'ok', 'the reply vote RPC still inserts');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  'update public.reply_votes set reply_id = 90025 where reply_id = 90024'), '23514', 'a reply vote cannot move');
select is((select score from public.replies where id = 90024), 1, 'the reply score stays correct');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$update public.reply_votes set user_id = '00000000-0000-4000-8000-00000000e2e2' where reply_id = 90024$q$),
  '23514', 'an interaction cannot change owners');

select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$insert into public.wiki_feedback (article_id, user_id, useful) values (1, '00000000-0000-4000-8000-00000000e2e1', true)
  on conflict (article_id, user_id) do update set article_id = excluded.article_id, user_id = excluded.user_id, useful = excluded.useful$q$),
  'ok', 'feedback upserts still insert');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$insert into public.wiki_feedback (article_id, user_id, useful) values (1, '00000000-0000-4000-8000-00000000e2e1', false)
  on conflict (article_id, user_id) do update set article_id = excluded.article_id, user_id = excluded.user_id, useful = excluded.useful$q$),
  'ok', 'feedback upserts still update the value');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  'update public.wiki_feedback set article_id = 2 where article_id = 1'), '23514', 'feedback cannot move to another guide');

select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$insert into public.poll_votes (thread_id, user_id, option_id) values (90024, '00000000-0000-4000-8000-00000000e2e1', 90024)$q$),
  'ok', 'a poll vote can be inserted');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  'update public.poll_votes set option_id = 90025 where thread_id = 90024'), '23514', 'poll votes change options through delete and insert');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  'update public.poll_votes set thread_id = 90025 where thread_id = 90024'), '23514', 'poll votes cannot move to another thread');

insert into public.saves (thread_id, user_id) values (90024, '00000000-0000-4000-8000-00000000e2e1');
insert into public.place_hearts (place_id, user_id) values (1, '00000000-0000-4000-8000-00000000e2e1');
insert into public.rsvps (post_id, user_id) values (1, '00000000-0000-4000-8000-00000000e2e1');
insert into public.board_members (board_id, user_id) values ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-00000000e2e1');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  'update public.saves set thread_id = 90025 where thread_id = 90024'), '23514', 'a save cannot move');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  'update public.place_hearts set place_id = 2 where place_id = 1'), '23514', 'a heart cannot move');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  'update public.rsvps set post_id = 2 where post_id = 1'), '23514', 'an RSVP cannot move');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$update public.board_members set board_id = '00000000-0000-4000-8000-000000000203' where board_id = '00000000-0000-4000-8000-000000000201'$q$),
  '23514', 'a board membership cannot move');

select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  'select public.set_reply_vote(90024, 0::smallint)'), 'ok', 'the reply vote RPC still removes a vote');
select is((select score from public.replies where id = 90024), 0, 'removing the reply vote restores its score');

select * from finish();
rollback;
