-- Campus admin (#61): moderators manage events, exam windows and deadlines; only admins
-- manage Lounge rooms; members and visitors stay read-only.
-- e2e1 is a member, e2e2 a moderator, and 000002 is promoted to admin inside this transaction.
begin;
\ir 00_helpers.sql
select plan(22);

update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-000000000002';

insert into public.campus_events (id, starts_at, title) overriding system value values (90601, now(), 'Test event');
insert into public.exam_windows (id, starts_on) overriding system value values (90601, current_date + 30);
insert into public.deadlines (id, on_date, title) overriding system value values (90601, current_date + 3, 'Test deadline');
insert into public.lounge_rooms (slug, label) values ('test-room', '#test-room');

-- Visitors and members: read-only.
select is(pg_temp.try_as('anon', null, $q$insert into public.campus_events (starts_at, title) values (now(), 'x')$q$), '42501', 'visitor cannot add an event');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', $q$insert into public.campus_events (starts_at, title) values (now(), 'x')$q$), '42501', 'member cannot add an event');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', $q$insert into public.exam_windows (starts_on) values (current_date)$q$), '42501', 'member cannot add an exam window');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', $q$insert into public.deadlines (on_date, title) values (current_date, 'x')$q$), '42501', 'member cannot add a deadline');
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$with u as (update public.campus_events set title = 'hacked' where id = 90601 returning 1) select count(*) from u$q$), 0::bigint, 'member cannot edit an event');
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$with d as (delete from public.exam_windows where id = 90601 returning 1) select count(*) from d$q$), 0::bigint, 'member cannot delete an exam window');
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$with d as (delete from public.deadlines where id = 90601 returning 1) select count(*) from d$q$), 0::bigint, 'member cannot delete a deadline');
select is(pg_temp.try_as('anon', null, $q$update public.lounge_rooms set label = 'x' where slug = 'test-room'$q$), '42501', 'visitor cannot rename a room');
select is((select title from public.campus_events where id = 90601), 'Test event', 'and nothing changed');

-- Moderator (e2e2): the three content tables.
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2', $q$insert into public.campus_events (starts_at, title) values (now(), 'Mod event')$q$), 'ok', 'moderator can add an event');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2', $q$insert into public.exam_windows (starts_on) values (current_date + 40)$q$), 'ok', 'moderator can add an exam window');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2', $q$insert into public.deadlines (on_date, title) values (current_date + 4, 'Mod deadline')$q$), 'ok', 'moderator can add a deadline');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2', $q$insert into public.campus_events (starts_at, title, is_demo) values (now(), 'x', true)$q$), '42501', 'but cannot add a demo row, so clearing the demo keeps their content');
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  $q$with u as (update public.campus_events set title = 'Edited' where id = 90601 returning 1) select count(*) from u$q$), 1::bigint, 'moderator can edit an event');
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  $q$with u as (update public.exam_windows set label = 'Mid-sems' where id = 90601 returning 1) select count(*) from u$q$), 1::bigint, 'moderator can edit an exam window');
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  $q$with d as (delete from public.deadlines where id = 90601 returning 1) select count(*) from d$q$), 1::bigint, 'moderator can delete a deadline');
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  $q$with d as (delete from public.campus_events where id = 90601 returning 1) select count(*) from d$q$), 1::bigint, 'moderator can delete an event');

-- Lounge rooms: admin only, and never deleted from the app.
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2', $q$insert into public.lounge_rooms (slug, label) values ('mod-room', '#mod')$q$), '42501', 'moderator cannot add a room');
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  $q$with u as (update public.lounge_rooms set label = '#hijack' where slug = 'test-room' returning 1) select count(*) from u$q$), 0::bigint, 'moderator cannot rename a room');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-000000000002', $q$insert into public.lounge_rooms (slug, label) values ('admin-room', '#admin')$q$), 'ok', 'admin can add a room');
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-000000000002',
  $q$with u as (update public.lounge_rooms set label = '#renamed', pinned_text = 'Welcome' where slug = 'test-room' returning 1) select count(*) from u$q$), 1::bigint, 'admin can rename a room and pin text');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-000000000002', $q$delete from public.lounge_rooms where slug = 'test-room'$q$), '42501', 'nobody can delete a room, not even an admin');

select * from finish();
rollback;
