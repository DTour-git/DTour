-- A suspension survives deleting the account (#132): signing up again with the same
-- email puts it back. Lifted, expired and absent suspensions leave nothing behind.
-- e2e2 is the moderator who suspends.
begin;
\ir 00_helpers.sql
select plan(17);

delete from public.suspensions;
delete from public.suspension_carryovers;

create function pg_temp.signup(uid uuid, email text) returns void language sql as $$
  select set_config('request.jwt.claims', '', true);
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email, '',
          '{"provider":"email","providers":["email"]}', '{}', now(), now());
$$;
create function pg_temp.suspend(uid uuid, days int) returns text language sql as $$
  select pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
    format('select public.suspend_member(%L, %L, %s)', (select handle from public.profiles where id = uid), 'Spam ring in the Lounge',
           coalesce(days::text, 'null')))
$$;
create function pg_temp.post(uid uuid) returns text language sql as $$
  select pg_temp.try_as('authenticated', uid,
    $q$insert into public.lounge_messages (room_slug, author_id, body) select slug, auth.uid(), 'hello again' from public.lounge_rooms order by sort limit 1$q$)
$$;
create function pg_temp.active(uid uuid) returns bigint language sql as $$
  select count(*) from public.suspensions where user_id = uid and lifted_at is null and (ends_at is null or ends_at > now())
$$;

-- ── Suspended, deletes the account, signs up again ──
select pg_temp.signup('00000000-0000-4000-8000-0000000ca001', 'evader_2k24co901@dtu.ac.in');
update public.profiles set handle = 'evader901', onboarded = true where id = '00000000-0000-4000-8000-0000000ca001';
select is(pg_temp.suspend('00000000-0000-4000-8000-0000000ca001', null), 'ok', 'a moderator suspends the member indefinitely');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-0000000ca001', 'select public.delete_my_account()'), 'ok',
  'the suspended member deletes their account');
select is((select count(*) from public.suspension_carryovers), 1::bigint, 'the suspension is kept');
select is((select handle from public.suspension_carryovers), 'evader901', 'with the handle');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', 'select count(*) from public.suspension_carryovers'), '42501',
  'members cannot read the kept suspensions');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2', 'select count(*) from public.suspension_carryovers'), '42501',
  'nor can moderators (it is internal)');
select is(pg_temp.try_as('anon', null, 'select count(*) from public.suspension_carryovers'), '42501', 'nor visitors');

select pg_temp.signup('00000000-0000-4000-8000-0000000ca002', 'Evader_2k24co901@DTU.ac.in');
select is(pg_temp.active('00000000-0000-4000-8000-0000000ca002'), 1::bigint, 'signing up again with the same email (any case) brings the suspension back');
select ok((select reason = 'Spam ring in the Lounge' and ends_at is null and created_by = '00000000-0000-4000-8000-00000000e2e2'
           from public.suspensions where user_id = '00000000-0000-4000-8000-0000000ca002'),
  'with its reason, end date and moderator');
select is(pg_temp.post('00000000-0000-4000-8000-0000000ca002'), 'DT403', 'so the new account cannot write');
select ok((select onboarded and handle = 'evader901' from public.profiles where id = '00000000-0000-4000-8000-0000000ca002'),
  'it is onboarded (a suspended member cannot finish onboarding) and has its old handle back');
select is((select count(*) from public.suspension_carryovers), 0::bigint, 'and the kept record is used up');

-- ── Deleted from the dashboard (not through the RPC): still kept ──
select pg_temp.signup('00000000-0000-4000-8000-0000000ca003', 'other_2k24co902@dtu.ac.in');
select pg_temp.suspend('00000000-0000-4000-8000-0000000ca003', 7);
select set_config('request.jwt.claims', '', true);
delete from auth.users where id = '00000000-0000-4000-8000-0000000ca003';
select is((select count(*) from public.suspension_carryovers), 1::bigint, 'a maintainer deleting the user keeps the suspension too');

-- ── An expired kept suspension is not brought back ──
update public.suspension_carryovers set ends_at = now() - interval '1 minute';
select pg_temp.signup('00000000-0000-4000-8000-0000000ca004', 'other_2k24co902@dtu.ac.in');
select is(pg_temp.active('00000000-0000-4000-8000-0000000ca004'), 0::bigint, 'a suspension that has since ended is not brought back');
select ok((select not onboarded from public.profiles where id = '00000000-0000-4000-8000-0000000ca004'), 'and the student onboards as usual');

-- ── Nothing is kept for a lifted suspension or none at all ──
select pg_temp.signup('00000000-0000-4000-8000-0000000ca005', 'lifted_2k24co903@dtu.ac.in');
select pg_temp.suspend('00000000-0000-4000-8000-0000000ca005', 30);
select pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  format('select public.lift_suspension(%s)', (select max(id) from public.suspensions where user_id = '00000000-0000-4000-8000-0000000ca005')));
delete from public.suspension_carryovers;
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-0000000ca005', 'select public.delete_my_account()'), 'ok', 'a member whose suspension was lifted deletes their account');
select is((select count(*) from public.suspension_carryovers), 0::bigint, 'and leaves nothing behind');

select * from finish();
rollback;
