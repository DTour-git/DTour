-- Team Up: requests start pending, keep their student and team, and only the
-- student's own accepted request makes them a member. Members can leave.
-- e2e2 owns the teams, e2e1 asks to join, profile 2 is a student who never asked.
begin;
\ir 00_helpers.sql
select plan(26);

insert into public.teams (id, owner_id, category, event_name, title)
overriding system value values
  (90031, '00000000-0000-4000-8000-00000000e2e2', 'hackathon', 'Test hackathon', 'Membership test team'),
  (90032, '00000000-0000-4000-8000-00000000e2e2', 'project', 'Test project', 'Second membership test team');
insert into public.team_roles (id, team_id, name)
overriding system value values (90031, 90031, 'Backend');

-- #51: a new request is always pending.
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$insert into public.team_requests (team_id, user_id, status) values (90031, '00000000-0000-4000-8000-00000000e2e1', 'accepted')$q$),
  '42501', 'a student cannot create an accepted request');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$insert into public.team_requests (team_id, user_id, status) values (90031, '00000000-0000-4000-8000-00000000e2e1', 'declined')$q$),
  '42501', 'a student cannot create a declined request');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  'select public.toggle_team_request(90031)'), 'ok', 'asking to join still works');
select is((select status from public.team_requests where team_id = 90031 and user_id = '00000000-0000-4000-8000-00000000e2e1'),
  'pending', 'the request waits for the owner');

-- #50: the owner can't move a request to another student or team.
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  $q$update public.team_requests set user_id = '00000000-0000-4000-8000-000000000002'
     where team_id = 90031 and user_id = '00000000-0000-4000-8000-00000000e2e1'$q$),
  '23514', 'the owner cannot hand a request to another student');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  $q$update public.team_requests set team_id = 90032
     where team_id = 90031 and user_id = '00000000-0000-4000-8000-00000000e2e1'$q$),
  '23514', 'the owner cannot move a request to another team');
select is((select count(*) from public.team_requests where user_id = '00000000-0000-4000-8000-000000000002'),
  0::bigint, 'the other student still has no request');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  'select public.review_team_request(90031, ''00000000-0000-4000-8000-000000000002'', true)'),
  'P0001', 'the owner cannot accept a student who never asked');

-- #54: the owner can't add other students directly.
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  $q$insert into public.team_members (team_id, user_id) values (90031, '00000000-0000-4000-8000-000000000002')$q$),
  '42501', 'the owner cannot add a student who never asked');
select is((select count(*) from public.activities
           where user_id = '00000000-0000-4000-8000-000000000002' and kind = 'team' and title = 'Membership test team'),
  0::bigint, 'nothing is written on that student''s profile');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  $q$insert into public.team_members (team_id, user_id) values (90031, '00000000-0000-4000-8000-00000000e2e1')$q$),
  '42501', 'the owner cannot skip the review step for a pending request');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  $q$insert into public.team_members (team_id, user_id) values (90031, '00000000-0000-4000-8000-00000000e2e2')$q$),
  'ok', 'the owner still joins their own team');

-- Accepting the student's own request still adds them and fills the role.
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  'select public.review_team_request(90031, ''00000000-0000-4000-8000-00000000e2e1'', true, 90031)'),
  'ok', 'the owner can accept the request');
select is((select count(*) from public.team_members where team_id = 90031 and user_id = '00000000-0000-4000-8000-00000000e2e1'),
  1::bigint, 'the accepted student is a member');
select is((select filled_by from public.team_roles where id = 90031),
  '00000000-0000-4000-8000-00000000e2e1'::uuid, 'the accepted student fills the role');

-- Members can leave; nobody else can remove them except the owner.
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-000000000002',
  $q$delete from public.team_members where team_id = 90031 and user_id = '00000000-0000-4000-8000-00000000e2e1'$q$),
  'ok', 'another student''s delete runs');
select is((select count(*) from public.team_members where team_id = 90031 and user_id = '00000000-0000-4000-8000-00000000e2e1'),
  1::bigint, 'but it removes nobody');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$delete from public.team_members where team_id = 90031 and user_id = '00000000-0000-4000-8000-00000000e2e1'$q$),
  'ok', 'a member can leave');
select is((select count(*) from public.team_members where team_id = 90031 and user_id = '00000000-0000-4000-8000-00000000e2e1'),
  0::bigint, 'leaving removes the membership');
select is((select count(*) from public.team_requests where team_id = 90031 and user_id = '00000000-0000-4000-8000-00000000e2e1'),
  0::bigint, 'leaving clears the accepted request');
select ok((select not filled and filled_by is null from public.team_roles where id = 90031), 'leaving frees the role');

-- After leaving, the student can ask again and the owner can remove them.
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  'select public.toggle_team_request(90031)'), 'ok', 'a former member can ask again');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  'select public.review_team_request(90031, ''00000000-0000-4000-8000-00000000e2e1'', true)'),
  'ok', 'the owner can accept them again');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  $q$delete from public.team_members where team_id = 90031 and user_id = '00000000-0000-4000-8000-00000000e2e1'$q$),
  'ok', 'the owner can remove a member');
select is((select count(*) from public.team_members where team_id = 90031 and user_id = '00000000-0000-4000-8000-00000000e2e1'),
  0::bigint, 'removing takes the student off the team');

-- The owner may still answer a request by changing its status.
insert into public.team_requests (team_id, user_id) values (90032, '00000000-0000-4000-8000-000000000002');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  $q$update public.team_requests set status = 'declined' where team_id = 90032$q$),
  'ok', 'the owner can still change a request''s status');

select * from finish();
rollback;
