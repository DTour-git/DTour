-- Suspension tools need an unsuspended caller (#131): a suspended moderator or admin
-- can't suspend or lift, and nobody lifts their own suspension.
-- e2e2 is a moderator, profile 3 an admin, profile 2 a second admin, profile 4 a student.
begin;
\ir 00_helpers.sql
select plan(10);

update public.profiles set role = 'admin' where id in ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003');
update public.profiles set role = 'member' where id = '00000000-0000-4000-8000-000000000004';
delete from public.suspensions;

create function pg_temp.handle(uid uuid) returns text language sql as $$
  select handle from public.profiles where id = uid
$$;
create function pg_temp.latest(uid uuid) returns bigint language sql as $$
  select max(id) from public.suspensions where user_id = uid
$$;
create function pg_temp.mod(q text) returns text language sql as $$
  select pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2', q)
$$;
create function pg_temp.admin2(q text) returns text language sql as $$
  select pg_temp.try_as('authenticated', '00000000-0000-4000-8000-000000000002', q)
$$;

-- A suspended moderator loses the tools.
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-000000000003',
  format('select public.suspend_member(%L, %L, 7)', 'e2e.moderator', 'Misused the queue')), 'ok', 'an admin suspends a moderator');
select is(pg_temp.mod(format('select public.suspend_member(%L, %L, 30)', pg_temp.handle('00000000-0000-4000-8000-000000000004'), 'Reported me')),
  'DT403', 'the suspended moderator cannot suspend a member');
select is((select count(*) from public.suspensions where user_id = '00000000-0000-4000-8000-000000000004'), 0::bigint, 'and no suspension was written');

select set_config('request.jwt.claims', '', true);
insert into public.suspensions (user_id, reason, created_by)
values ('00000000-0000-4000-8000-000000000004', 'Spam in the Lounge', '00000000-0000-4000-8000-000000000003');
select is(pg_temp.mod(format('select public.lift_suspension(%s)', pg_temp.latest('00000000-0000-4000-8000-000000000004'))),
  'DT403', 'the suspended moderator cannot lift a member''s suspension');
select ok((select lifted_at is null from public.suspensions where id = pg_temp.latest('00000000-0000-4000-8000-000000000004')),
  'which stays in force');

-- A suspended admin can't lift their own suspension.
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-000000000003',
  format('select public.suspend_member(%L, %L, null)', pg_temp.handle('00000000-0000-4000-8000-000000000002'), 'Rogue admin')),
  'ok', 'an admin suspends another admin');
select is(pg_temp.admin2(format('select public.lift_suspension(%s)', pg_temp.latest('00000000-0000-4000-8000-000000000002'))),
  'DT403', 'the suspended admin cannot lift their own suspension');
select is(pg_temp.admin2($q$insert into public.threads (board_id, author_id, title, body)
  values ('00000000-0000-4000-8000-000000000201', auth.uid(), 'Still suspended', 'body')$q$),
  'DT403', 'and still cannot write');

-- Unsuspended moderators keep the tools.
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-000000000003',
  format('select public.lift_suspension(%s)', pg_temp.latest('00000000-0000-4000-8000-00000000e2e2'))), 'ok', 'the admin lifts the moderator''s suspension');
select is(pg_temp.mod(format('select public.lift_suspension(%s)', pg_temp.latest('00000000-0000-4000-8000-000000000004'))),
  'ok', 'and the moderator can lift a member''s suspension again');

select * from finish();
rollback;
