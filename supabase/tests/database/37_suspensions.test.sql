-- Suspensions (#64): moderators suspend members from writing, admins also moderators;
-- a suspended member keeps reading and private housekeeping, every other write is
-- refused with DT403 (also through RPCs); suspensions lift at the end date or by a
-- moderator; the log is private to moderators and the member.
-- e2e1 is the student who gets suspended, e2e2 a moderator, profile 2 a second
-- moderator, profile 3 an admin, profile 4 another student.
begin;
\ir 00_helpers.sql
select plan(46);

update public.profiles set role = 'moderator' where id = '00000000-0000-4000-8000-000000000002';
update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-000000000003';
delete from public.suspensions;
delete from public.place_hearts where user_id = '00000000-0000-4000-8000-00000000e2e1'; -- so toggle_heart tries to add one

-- Content the student owns or can act on, created by a maintainer.
insert into public.threads (id, board_id, author_id, title, body) overriding system value values
  (93701, '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-00000000e2e1', 'Suspension test thread', 'body'),
  (93702, '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-00000000e2e1', 'Thread the student deletes', 'body');
insert into public.replies (id, thread_id, author_id, parent_id, body) overriding system value values
  (93711, 93701, '00000000-0000-4000-8000-00000000e2e1', null, 'reply with an answer under it'),
  (93712, 93701, '00000000-0000-4000-8000-00000000e2e2', 93711, 'the answer');
insert into public.teams (id, owner_id, category, event_name, title) overriding system value values
  (93721, '00000000-0000-4000-8000-00000000e2e2', 'project', 'Test', 'Suspension test team'),
  (93722, '00000000-0000-4000-8000-00000000e2e2', 'project', 'Test', 'Team the student asks to join');
insert into public.team_members (team_id, user_id) values (93721, '00000000-0000-4000-8000-00000000e2e1');

create function pg_temp.student(q text) returns text language sql as $$
  select pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', q)
$$;
create function pg_temp.active(uid uuid) returns bigint language sql as $$
  select count(*) from public.suspensions where user_id = uid and lifted_at is null and (ends_at is null or ends_at > now())
$$;

-- ── Who can suspend ──
select is(pg_temp.try_as('anon', null, $q$select public.suspend_member('e2e.student', 'Spam', 7)$q$), '42501', 'a visitor cannot suspend');
select is(pg_temp.student($q$select public.suspend_member('e2e.moderator', 'Spam', 7)$q$), '42501', 'a member cannot suspend');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2', $q$select public.suspend_member('e2e.moderator', 'Me', 1)$q$),
  'P0001', 'a moderator cannot suspend themselves');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  format('select public.suspend_member(%L, %L, 7)', (select handle from public.profiles where id = '00000000-0000-4000-8000-000000000002'), 'Spam')),
  'P0001', 'a moderator cannot suspend another moderator');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-000000000003',
  format('select public.suspend_member(%L, %L, 1)', (select handle from public.profiles where id = '00000000-0000-4000-8000-000000000002'), 'Testing admin powers')),
  'ok', 'an admin can suspend a moderator');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  format('select public.lift_suspension(%s)', (select id from public.suspensions where user_id = '00000000-0000-4000-8000-000000000002'))),
  'P0001', 'a moderator cannot lift a moderator''s suspension');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-000000000003',
  format('select public.lift_suspension(%s)', (select id from public.suspensions where user_id = '00000000-0000-4000-8000-000000000002'))),
  'ok', 'an admin can');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2', $q$select public.suspend_member('e2e.student', 'Spam', 5)$q$),
  'P0001', 'only 1, 7 or 30 days, or indefinitely');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2', $q$select public.suspend_member('nobody.here', 'Spam', 7)$q$),
  'P0001', 'the handle must exist');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2', $q$select public.suspend_member('@e2e.student', 'Spam in the Lounge', 7)$q$),
  'ok', 'a moderator can suspend a member for 7 days');
select ok((select ends_at between now() + interval '7 days' - interval '1 minute' and now() + interval '7 days' + interval '1 minute'
           and created_by = '00000000-0000-4000-8000-00000000e2e2'
           from public.suspensions where user_id = '00000000-0000-4000-8000-00000000e2e1'),
  'the suspension ends in 7 days and records who suspended');
select is(pg_temp.student($q$insert into public.suspensions (user_id, reason) values ('00000000-0000-4000-8000-00000000e2e2', 'payback')$q$),
  '42501', 'nobody writes suspensions directly');

-- ── Who can read the log ──
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', 'select count(*) from public.suspensions'), 1::bigint,
  'the member sees their own suspension');
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-000000000004', 'select count(*) from public.suspensions'), 0::bigint,
  'other members see none');
select is(pg_temp.try_as('anon', null, 'select count(*) from public.suspensions'), '42501', 'visitors see none');
select cmp_ok(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e2', 'select count(*) from public.suspensions'), '>=', 2::bigint,
  'moderators see the whole log');
select is(pg_temp.student($q$select public.suspension_message('00000000-0000-4000-8000-00000000e2e2')$q$), '42501',
  'nobody reads another member''s suspension through the helper');

-- ── Blocked while suspended (DT403), directly and through RPCs ──
select is(pg_temp.student($q$insert into public.threads (board_id, author_id, title, body) values ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-00000000e2e1', 'New', 'body')$q$),
  'DT403', 'cannot post a thread');
select is(pg_temp.student($q$insert into public.replies (thread_id, author_id, body) values (93701, '00000000-0000-4000-8000-00000000e2e1', 'hi')$q$),
  'DT403', 'cannot reply');
select is(pg_temp.student($q$update public.threads set body = 'edited' where id = 93701$q$), 'DT403', 'cannot edit their thread');
select is(pg_temp.student('select public.set_thread_vote(93701, 1::smallint)'), 'DT403', 'cannot vote');
select is(pg_temp.student('select public.toggle_heart((select id from public.places limit 1))'), 'DT403', 'cannot heart a place');
select is(pg_temp.student('select public.toggle_team_request(93722)'), 'DT403', 'cannot ask to join a team');
select is(pg_temp.student($q$insert into public.lounge_messages (room_slug, author_id, body) values ('global', '00000000-0000-4000-8000-00000000e2e1', 'hi')$q$),
  'DT403', 'cannot send a Lounge message');
select is(pg_temp.student($q$update public.profiles set bio = 'new bio' where id = '00000000-0000-4000-8000-00000000e2e1'$q$),
  'DT403', 'cannot edit their profile');
select is(pg_temp.student($q$insert into public.wiki_articles (slug, title, body, started_by) values ('suspended-guide', 'Guide', 'body', '00000000-0000-4000-8000-00000000e2e1')$q$),
  'DT403', 'cannot start a wiki guide');
select ok(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', 'select count(*) from (select 1 where public.am_suspended()) x') = 1,
  'am_suspended() is true for them');
select ok(exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                  and policyname = 'suspended members cannot upload' and permissive = 'RESTRICTIVE' and cmd = 'INSERT'),
  'uploads are refused by a restrictive storage policy');

-- The message names the end (in IST) and the reason.
update public.suspensions set ends_at = '2099-12-02 09:00:00+00' where user_id = '00000000-0000-4000-8000-00000000e2e1';
select is(public.suspension_message('00000000-0000-4000-8000-00000000e2e1'),
  'You’re suspended from writing until 2 Dec, 2:30 pm IST. Reason: Spam in the Lounge', 'the message names the end and the reason');

-- ── Still allowed: reading and housekeeping ──
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', 'select count(*) from public.threads where id = 93701'), 1::bigint,
  'they can still read');
select is(pg_temp.student($q$update public.profiles set boards_seen_at = now() where id = '00000000-0000-4000-8000-00000000e2e1'$q$), 'ok',
  'the boards "last seen" time still updates');
select is(pg_temp.student($q$insert into public.saves (user_id, thread_id) values ('00000000-0000-4000-8000-00000000e2e1', 93701)$q$), 'ok',
  'they can save a thread');
select is(pg_temp.student('select public.mark_notifications_read()'), 'ok', 'they can mark notifications read');
select is(pg_temp.student('select public.delete_reply(93711)'), 'ok', 'they can delete their reply (blanked, as it has an answer)');
select ok((select deleted_at is not null from public.replies where id = 93711), 'the reply is blanked');
select is(pg_temp.student('delete from public.threads where id = 93702'), 'ok', 'they can delete their thread');
select is((select count(*) from public.threads where id = 93702), 0::bigint, 'the thread is gone');
select is(pg_temp.student($q$delete from public.team_members where team_id = 93721 and user_id = '00000000-0000-4000-8000-00000000e2e1'$q$), 'ok',
  'they can leave a team');
select is((select count(*) from public.team_members where team_id = 93721 and user_id = '00000000-0000-4000-8000-00000000e2e1'), 0::bigint,
  'and are out of it');

-- ── A new suspension replaces the current one; lifting and expiry ──
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2', $q$select public.suspend_member('e2e.student', 'Still spamming', null)$q$),
  'ok', 'a moderator can suspend indefinitely');
select is(pg_temp.active('00000000-0000-4000-8000-00000000e2e1'), 1::bigint, 'the new suspension replaces the old one');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  format('select public.lift_suspension(%s)', (select id from public.suspensions
    where user_id = '00000000-0000-4000-8000-00000000e2e1' and lifted_at is null))), 'ok', 'a moderator can lift it');
select ok((select lifted_by = '00000000-0000-4000-8000-00000000e2e2' from public.suspensions
           where user_id = '00000000-0000-4000-8000-00000000e2e1' and reason = 'Still spamming'), 'the log records who lifted it');
select is(pg_temp.student($q$update public.threads set body = 'edited' where id = 93701$q$), 'ok', 'after lifting they can write again');

select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2', $q$select public.suspend_member('e2e.student', 'One more', 1)$q$),
  'ok', 'suspended again for a day');
update public.suspensions set created_at = now() - interval '2 days', ends_at = now() - interval '1 day'
where user_id = '00000000-0000-4000-8000-00000000e2e1' and reason = 'One more';
select is(pg_temp.student($q$insert into public.replies (thread_id, author_id, body) values (93701, '00000000-0000-4000-8000-00000000e2e1', 'back')$q$),
  'ok', 'a suspension lifts by itself at its end date');

select * from finish();
rollback;
