-- A suspension survives deleting the account (#132): the active one stays in the
-- moderators' log and applies again when the same email signs up. Only a hash of the
-- email is kept, privately; past, lifted and ended suspensions don't outlive the account.
-- e2e2 is the moderator who suspends.
begin;
\ir 00_helpers.sql
select plan(26);

delete from public.suspensions;

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
create function pg_temp.mod(q text) returns text language sql as $$
  select pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2', q)
$$;
create function pg_temp.active(uid uuid) returns bigint language sql as $$
  select count(*) from public.suspensions where user_id = uid and lifted_at is null and (ends_at is null or ends_at > now())
$$;
create function pg_temp.kept(h text) returns bigint language sql as $$
  select count(*) from public.suspensions where user_id is null and former_handle = h
$$;

-- ── Suspended, deletes the account ──
select pg_temp.signup('00000000-0000-4000-8000-0000000ca001', 'evader_2k24co901@dtu.ac.in');
update public.profiles set handle = 'evader901', onboarded = true where id = '00000000-0000-4000-8000-0000000ca001';
insert into public.suspensions (user_id, reason, ends_at, created_at, lifted_at)
values ('00000000-0000-4000-8000-0000000ca001', 'An older, lifted one', null, now() - interval '60 days', now() - interval '59 days');
select is(pg_temp.suspend('00000000-0000-4000-8000-0000000ca001', null), 'ok', 'a moderator suspends the member indefinitely');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-0000000ca001', 'select public.delete_my_account()'), 'ok',
  'the suspended member can still delete their account');
select is(pg_temp.kept('evader901'), 1::bigint, 'the active suspension stays, under the handle it had');
select is((select count(*) from public.suspensions where reason = 'An older, lifted one'), 0::bigint, 'past suspensions go with the account');
select is((select count(*) from public.suspension_carryovers), 1::bigint, 'one email hash is kept for it');
select ok((select email_sha256 = extensions.digest('evader_2k24co901@dtu.ac.in', 'sha256') from public.suspension_carryovers),
  'the hash of the normalised email, not the email');

select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  $q$select count(*) from public.suspensions where user_id is null and former_handle = 'evader901' and reason = 'Spam ring in the Lounge'$q$),
  1::bigint, 'moderators still see it in the log');
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', 'select count(*) from public.suspensions where user_id is null'),
  0::bigint, 'members do not');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', 'select count(*) from public.suspension_carryovers'), '42501',
  'members cannot read the kept hashes');
select is(pg_temp.mod('select count(*) from public.suspension_carryovers'), '42501', 'nor can moderators');
select is(pg_temp.try_as('anon', null, 'select count(*) from public.suspension_carryovers'), '42501', 'nor visitors');
select is(pg_temp.mod($q$select public.email_sha256('x@dtu.ac.in')$q$), '42501', 'the hashing helper is internal');

-- ── Signs up again with the same email ──
select pg_temp.signup('00000000-0000-4000-8000-0000000ca002', '  Evader_2k24co901@DTU.ac.in');
select is(pg_temp.active('00000000-0000-4000-8000-0000000ca002'), 1::bigint, 'the suspension applies again (email trimmed and case-folded)');
select ok((select reason = 'Spam ring in the Lounge' and ends_at is null and created_by = '00000000-0000-4000-8000-00000000e2e2'
                  and former_handle is null
           from public.suspensions where user_id = '00000000-0000-4000-8000-0000000ca002'),
  'the same log entry, now pointing at the new account');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-0000000ca002',
  $q$insert into public.lounge_messages (room_slug, author_id, body) select slug, auth.uid(), 'back again' from public.lounge_rooms order by sort limit 1$q$),
  'DT403', 'so the new account cannot write');
select ok((select onboarded and handle = 'evader901' from public.profiles where id = '00000000-0000-4000-8000-0000000ca002'),
  'it is onboarded (a suspended member cannot finish onboarding) and has its old handle back');
select is((select count(*) from public.suspension_carryovers), 0::bigint, 'the hash is gone');
select set_config('request.jwt.claims', pg_temp.claims('00000000-0000-4000-8000-0000000ca002'), true);
set local role authenticated;
select is(jsonb_array_length(public.export_my_data()->'suspensions'), 1, 'their data export includes the suspension');
reset role;

-- ── Deleted from the dashboard, then lifted by a moderator ──
select pg_temp.signup('00000000-0000-4000-8000-0000000ca003', 'other_2k24co902@dtu.ac.in');
select pg_temp.suspend('00000000-0000-4000-8000-0000000ca003', 7);
select set_config('request.jwt.claims', '', true);
delete from auth.users where id = '00000000-0000-4000-8000-0000000ca003';
select is((select count(*) from public.suspension_carryovers), 1::bigint, 'a maintainer deleting the user keeps the suspension too');
select is(pg_temp.mod(format('select public.lift_suspension(%s)',
  (select id from public.suspensions where user_id is null and lifted_at is null))), 'ok', 'a moderator can lift a kept suspension');
select is((select count(*) from public.suspensions where user_id is null) + (select count(*) from public.suspension_carryovers), 0::bigint,
  'then nothing about it is kept');
select pg_temp.signup('00000000-0000-4000-8000-0000000ca004', 'other_2k24co902@dtu.ac.in');
select is(pg_temp.active('00000000-0000-4000-8000-0000000ca004'), 0::bigint, 'and signing up again is not suspended');

-- ── A kept suspension that has ended is not brought back ──
select pg_temp.signup('00000000-0000-4000-8000-0000000ca005', 'brief_2k24co903@dtu.ac.in');
select pg_temp.suspend('00000000-0000-4000-8000-0000000ca005', 1);
select pg_temp.try_as('authenticated', '00000000-0000-4000-8000-0000000ca005', 'select public.delete_my_account()');
select set_config('request.jwt.claims', '', true);
update public.suspensions set ends_at = now() - interval '1 minute', created_at = now() - interval '1 day' where user_id is null;
select pg_temp.signup('00000000-0000-4000-8000-0000000ca006', 'brief_2k24co903@dtu.ac.in');
select is(pg_temp.active('00000000-0000-4000-8000-0000000ca006'), 0::bigint, 'a suspension that has since ended is not brought back');
select ok((select not onboarded from public.profiles where id = '00000000-0000-4000-8000-0000000ca006'), 'and the student onboards as usual');
select is((select count(*) from public.suspensions where user_id is null) + (select count(*) from public.suspension_carryovers), 0::bigint,
  'and the ended one is pruned');

-- ── A member who was never suspended leaves nothing behind ──
select pg_temp.signup('00000000-0000-4000-8000-0000000ca007', 'clean_2k24co904@dtu.ac.in');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-0000000ca007', 'select public.delete_my_account()') ||
          (select count(*) from public.suspension_carryovers)::text, 'ok0', 'deleting an unsuspended account keeps nothing');

select * from finish();
rollback;
