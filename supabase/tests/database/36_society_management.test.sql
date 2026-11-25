-- Society management (#62): leads manage only their own society, members can't
-- promote themselves but can leave, a society keeps a lead, moderators create
-- societies and set verified, and only verified societies' posters pass
-- is_society_poster(). Visitors are read-only.
-- e2e1 is the student (lead of A), e2e2 the moderator, profiles 2 and 3 other students.
-- A = ...936a1 (verified), B = ...936b1 (unverified), C = ...936c1 (e2e1 is not a lead there).
begin;
\ir 00_helpers.sql
select plan(38);

delete from public.society_members where user_id = '00000000-0000-4000-8000-00000000e2e1';
insert into public.societies (id, slug, name, verified) values
  ('00000000-0000-4000-8000-0000000936a1', 'mgmt-test-a', 'Mgmt Test A', true),
  ('00000000-0000-4000-8000-0000000936b1', 'mgmt-test-b', 'Mgmt Test B', false),
  ('00000000-0000-4000-8000-0000000936c1', 'mgmt-test-c', 'Mgmt Test C', true);
insert into public.society_members (society_id, user_id, role, is_lead) values
  ('00000000-0000-4000-8000-0000000936a1', '00000000-0000-4000-8000-00000000e2e1', 'President', true),
  ('00000000-0000-4000-8000-0000000936c1', '00000000-0000-4000-8000-000000000003', 'President', true);

create function pg_temp.member(s text, u text) returns public.society_members language sql as $$
  select * from public.society_members where society_id = ('00000000-0000-4000-8000-0000000936' || s)::uuid
    and user_id = u::uuid
$$;
create function pg_temp.lead_sql(q text) returns text language sql as $$
  select pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', q)
$$;

-- ── Visitors read, never write ──
select is(pg_temp.count_as('anon', null, $q$select count(*) from public.society_members where society_id = '00000000-0000-4000-8000-0000000936a1'$q$),
  1::bigint, 'a visitor can see who is in a society');
select isnt(pg_temp.try_as('anon', null,
  $q$insert into public.society_members (society_id, user_id) values ('00000000-0000-4000-8000-0000000936a1', '00000000-0000-4000-8000-000000000002')$q$),
  'ok', 'a visitor cannot add members');
select isnt(pg_temp.try_as('anon', null, $q$insert into public.societies (slug, name) values ('anon-soc', 'Anon')$q$),
  'ok', 'a visitor cannot create a society');

-- ── Moderators create societies and set verified ──
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$insert into public.societies (slug, name) values ('member-soc', 'Member soc')$q$), '42501', 'a member cannot create a society');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  $q$insert into public.societies (id, slug, name) values ('00000000-0000-4000-8000-0000000936d1', 'mgmt-test-d', 'Mgmt Test D')$q$),
  'ok', 'a moderator can create a society');
select is((select verified from public.societies where slug = 'mgmt-test-d'), false, 'a new society starts unverified');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  $q$insert into public.society_members (society_id, user_id, is_lead) values ('00000000-0000-4000-8000-0000000936d1', '00000000-0000-4000-8000-000000000002', true)$q$),
  'ok', 'a moderator can assign the first lead');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  $q$update public.societies set verified = true where slug = 'mgmt-test-d'$q$), 'ok', 'a moderator can verify a society');
select is((select verified from public.societies where slug = 'mgmt-test-d'), true, 'it is verified');
select pg_temp.lead_sql($q$update public.societies set verified = false where slug = 'mgmt-test-a'$q$);
select is((select verified from public.societies where slug = 'mgmt-test-a'), true, 'a lead cannot change verified');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  $q$delete from public.societies where slug = 'mgmt-test-d'$q$), 'ok', 'a delete runs');
select is((select count(*) from public.societies where slug = 'mgmt-test-d'), 1::bigint, 'but nobody deletes a society from the app');

-- ── A lead manages their own society ──
select is(pg_temp.lead_sql($q$insert into public.society_members (society_id, user_id, role) values ('00000000-0000-4000-8000-0000000936a1', '00000000-0000-4000-8000-000000000002', 'Designer')$q$),
  'ok', 'a lead can add a member');
select is(pg_temp.lead_sql($q$update public.society_members set can_post = true, role = 'Design lead'
  where society_id = '00000000-0000-4000-8000-0000000936a1' and user_id = '00000000-0000-4000-8000-000000000002'$q$),
  'ok', 'a lead can edit a member');
select is((pg_temp.member('a1', '00000000-0000-4000-8000-000000000002')).can_post, true, 'the member can now post as the society');
select is((pg_temp.member('a1', '00000000-0000-4000-8000-000000000002')).role, 'Design lead', 'with the new role');
select is(pg_temp.lead_sql($q$update public.society_members set role = repeat('x', 41)
  where society_id = '00000000-0000-4000-8000-0000000936a1' and user_id = '00000000-0000-4000-8000-000000000002'$q$),
  '23514', 'a role is at most 40 characters');
select pg_temp.lead_sql($q$update public.society_members set society_id = '00000000-0000-4000-8000-0000000936c1', user_id = '00000000-0000-4000-8000-000000000003'
  where society_id = '00000000-0000-4000-8000-0000000936a1' and user_id = '00000000-0000-4000-8000-000000000002'$q$);
select ok((pg_temp.member('a1', '00000000-0000-4000-8000-000000000002')).user_id is not null,
  'a membership cannot be moved to another society or student');

-- ...and only their own.
select is(pg_temp.lead_sql($q$insert into public.society_members (society_id, user_id) values ('00000000-0000-4000-8000-0000000936c1', '00000000-0000-4000-8000-000000000002')$q$),
  '42501', 'a lead cannot add members to another society');
select pg_temp.lead_sql($q$update public.society_members set can_post = true where society_id = '00000000-0000-4000-8000-0000000936c1'$q$);
select is((pg_temp.member('c1', '00000000-0000-4000-8000-000000000003')).can_post, false, 'or edit its members');
select pg_temp.lead_sql($q$delete from public.society_members where society_id = '00000000-0000-4000-8000-0000000936c1'$q$);
select is((select count(*) from public.society_members where society_id = '00000000-0000-4000-8000-0000000936c1'), 1::bigint,
  'or remove its members');

-- ── A member can't promote themselves, but can leave ──
select pg_temp.try_as('authenticated', '00000000-0000-4000-8000-000000000002',
  $q$update public.society_members set is_lead = true where society_id = '00000000-0000-4000-8000-0000000936a1' and user_id = '00000000-0000-4000-8000-000000000002'$q$);
select is((pg_temp.member('a1', '00000000-0000-4000-8000-000000000002')).is_lead, false, 'a member cannot make themselves a lead');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-000000000002',
  $q$insert into public.society_members (society_id, user_id) values ('00000000-0000-4000-8000-0000000936a1', '00000000-0000-4000-8000-000000000003')$q$),
  '42501', 'a member cannot add others');
select pg_temp.try_as('authenticated', '00000000-0000-4000-8000-000000000002',
  $q$delete from public.society_members where society_id = '00000000-0000-4000-8000-0000000936a1' and user_id = '00000000-0000-4000-8000-00000000e2e1'$q$);
select ok((pg_temp.member('a1', '00000000-0000-4000-8000-00000000e2e1')).is_lead, 'a member cannot remove the lead');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-000000000002',
  $q$delete from public.society_members where society_id = '00000000-0000-4000-8000-0000000936a1' and user_id = '00000000-0000-4000-8000-000000000002'$q$),
  'ok', 'a member can leave');
select ok((pg_temp.member('a1', '00000000-0000-4000-8000-000000000002')).user_id is null, 'and is gone');

-- ── A society keeps at least one lead ──
select is(pg_temp.lead_sql($q$update public.society_members set is_lead = false where society_id = '00000000-0000-4000-8000-0000000936a1' and user_id = '00000000-0000-4000-8000-00000000e2e1'$q$),
  'P0001', 'the last lead cannot step down');
select is(pg_temp.lead_sql($q$delete from public.society_members where society_id = '00000000-0000-4000-8000-0000000936a1' and user_id = '00000000-0000-4000-8000-00000000e2e1'$q$),
  'P0001', 'the last lead cannot leave');
select is(pg_temp.lead_sql($q$insert into public.society_members (society_id, user_id, is_lead) values ('00000000-0000-4000-8000-0000000936a1', '00000000-0000-4000-8000-000000000002', true)$q$),
  'ok', 'a lead can make another lead');
select is(pg_temp.lead_sql($q$update public.society_members set is_lead = false where society_id = '00000000-0000-4000-8000-0000000936a1' and user_id = '00000000-0000-4000-8000-00000000e2e1'$q$),
  'ok', 'then step down');
select is(pg_temp.lead_sql($q$update public.society_members set is_lead = true where society_id = '00000000-0000-4000-8000-0000000936a1' and user_id = '00000000-0000-4000-8000-00000000e2e1'$q$),
  'ok', 'a lead runs the update');
select is((pg_temp.member('a1', '00000000-0000-4000-8000-00000000e2e1')).is_lead, false, 'but a former lead has no say any more');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  $q$delete from public.society_members where society_id = '00000000-0000-4000-8000-0000000936c1'$q$),
  'ok', 'a moderator can remove a society''s last lead');
select is((select count(*) from public.society_members where society_id = '00000000-0000-4000-8000-0000000936c1'), 0::bigint,
  'so a moderator can hand a society over');

-- ── Only verified societies' posters pass is_society_poster() ──
insert into public.society_members (society_id, user_id, can_post) values
  ('00000000-0000-4000-8000-0000000936b1', '00000000-0000-4000-8000-00000000e2e1', true);
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', 'select count(*) from (select 1 where public.is_society_poster()) x'),
  0::bigint, 'posting for an unverified society does not count as a verified poster');
update public.society_members set can_post = true
where society_id = '00000000-0000-4000-8000-0000000936a1' and user_id = '00000000-0000-4000-8000-00000000e2e1';
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', 'select count(*) from (select 1 where public.is_society_poster()) x'),
  1::bigint, 'posting for a verified society does');

-- ── Deleting the account of a society's last lead still works ──
update public.society_members set is_lead = true
where society_id = '00000000-0000-4000-8000-0000000936b1' and user_id = '00000000-0000-4000-8000-00000000e2e1';
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', 'select public.delete_my_account()'),
  'ok', 'the last lead can still delete their account');
select is((select count(*) from public.society_members where user_id = '00000000-0000-4000-8000-00000000e2e1'), 0::bigint,
  'and their memberships go with it');

select * from finish();
rollback;
