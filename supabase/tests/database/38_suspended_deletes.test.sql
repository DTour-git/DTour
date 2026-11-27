-- Suspended deletes (#128): a suspended member can still delete their own rows
-- (posts, places, wiki talk, their team, their membership) but not other people's:
-- no removing society or team members, no deleting team roles, and a suspended
-- moderator can't remove other people's content. Cascades still go through.
-- e2e1 is the suspended student, e2e2 a moderator (suspended later), profile 2 an
-- active moderator, profile 3 an active society lead, profile 4 another student.
begin;
\ir 00_helpers.sql
select plan(30);

update public.profiles set role = 'moderator' where id = '00000000-0000-4000-8000-000000000002';
delete from public.suspensions;
delete from public.society_members where user_id = '00000000-0000-4000-8000-00000000e2e1';

-- Society X: the student leads it, profile 4 is a member.
-- Society Y: profile 3 leads it, the student and profile 4 are members.
insert into public.societies (id, slug, name) values
  ('00000000-0000-4000-8000-0000000938a1', 'susp-del-x', 'Suspended delete X'),
  ('00000000-0000-4000-8000-0000000938b1', 'susp-del-y', 'Suspended delete Y');
insert into public.society_members (society_id, user_id, role, is_lead) values
  ('00000000-0000-4000-8000-0000000938a1', '00000000-0000-4000-8000-00000000e2e1', 'President', true),
  ('00000000-0000-4000-8000-0000000938a1', '00000000-0000-4000-8000-000000000004', 'Member', false),
  ('00000000-0000-4000-8000-0000000938b1', '00000000-0000-4000-8000-000000000003', 'President', true),
  ('00000000-0000-4000-8000-0000000938b1', '00000000-0000-4000-8000-00000000e2e1', 'Member', false),
  ('00000000-0000-4000-8000-0000000938b1', '00000000-0000-4000-8000-000000000004', 'Member', false);

-- Team 93801 and 93803: the student owns them, profile 4 is in both with a role.
-- Team 93802: the moderator owns it, the student and profile 4 are in it.
insert into public.teams (id, owner_id, category, event_name, title) overriding system value values
  (93801, '00000000-0000-4000-8000-00000000e2e1', 'project', 'Test', 'Team the student owns'),
  (93802, '00000000-0000-4000-8000-00000000e2e2', 'project', 'Test', 'Team the student is in'),
  (93803, '00000000-0000-4000-8000-00000000e2e1', 'project', 'Test', 'Team the student deletes');
insert into public.team_members (team_id, user_id) values
  (93801, '00000000-0000-4000-8000-000000000004'),
  (93802, '00000000-0000-4000-8000-00000000e2e1'),
  (93802, '00000000-0000-4000-8000-000000000004'),
  (93803, '00000000-0000-4000-8000-000000000004');
insert into public.team_roles (id, team_id, name, filled_by, filled) overriding system value values
  (93811, 93801, 'Designer', '00000000-0000-4000-8000-000000000004', true),
  (93812, 93803, 'Designer', '00000000-0000-4000-8000-000000000004', true);

-- Posts the student owns, and things other people own.
insert into public.threads (id, board_id, author_id, title, body) overriding system value values
  (93821, '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-00000000e2e1', 'Thread the student deletes', 'body'),
  (93822, '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000004', 'Reported thread', 'body');
insert into public.reports (id, reporter_id, thread_id, reason) overriding system value values
  (93831, '00000000-0000-4000-8000-00000000e2e1', 93822, 'spam');
insert into public.places (id, category, name, author_id) overriding system value values
  (93841, 'canteen', 'Student''s place', '00000000-0000-4000-8000-00000000e2e1'),
  (93842, 'canteen', 'Someone else''s place', '00000000-0000-4000-8000-000000000004');
insert into public.wiki_articles (id, slug, title, body, started_by) overriding system value values
  (93851, 'suspended-deletes-guide', 'Guide', 'body', '00000000-0000-4000-8000-000000000004');
insert into public.wiki_talk (id, article_id, author_id, body) overriding system value values
  (93861, 93851, '00000000-0000-4000-8000-00000000e2e1', 'Student''s talk'),
  (93862, 93851, '00000000-0000-4000-8000-000000000004', 'Someone else''s talk');
insert into public.campus_events (id, starts_at, title) overriding system value values
  (93871, now() + interval '1 day', 'Event a suspended moderator tries to delete'),
  (93872, now() + interval '1 day', 'Event an active moderator deletes');
insert into public.deadlines (id, on_date, title) overriding system value values (93881, current_date + 1, 'Deadline');
insert into public.exam_windows (id, starts_on) overriding system value values (93891, current_date + 30);

insert into public.suspensions (user_id, reason) values ('00000000-0000-4000-8000-00000000e2e1', 'Spam in the Lounge');

create function pg_temp.student(q text) returns text language sql as $$
  select pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', q)
$$;
create function pg_temp.mod(q text) returns text language sql as $$
  select pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2', q)
$$;
create function pg_temp.in_society(s text, u text) returns boolean language sql as $$
  select exists (select 1 from public.society_members
                 where society_id = ('00000000-0000-4000-8000-0000000938' || s)::uuid and user_id = u::uuid)
$$;
create function pg_temp.in_team(t bigint, u text) returns boolean language sql as $$
  select exists (select 1 from public.team_members where team_id = t and user_id = u::uuid)
$$;

-- ── A suspended lead or owner can't remove other people ──
select is(pg_temp.student($q$delete from public.society_members where society_id = '00000000-0000-4000-8000-0000000938a1'
  and user_id = '00000000-0000-4000-8000-000000000004'$q$), 'DT403', 'a suspended lead cannot remove a society member');
select ok(pg_temp.in_society('a1', '00000000-0000-4000-8000-000000000004'), 'the member is still in the society');
select is(pg_temp.student($q$delete from public.team_members where team_id = 93801 and user_id = '00000000-0000-4000-8000-000000000004'$q$),
  'DT403', 'a suspended owner cannot remove a team member');
select ok(pg_temp.in_team(93801, '00000000-0000-4000-8000-000000000004'), 'the member is still in the team');
select is(pg_temp.student('delete from public.team_roles where id = 93811'), 'DT403', 'a suspended owner cannot delete a team role');
select is((select count(*) from public.team_roles where id = 93811), 1::bigint, 'the role is still there');
select is(pg_temp.student($q$select public.suspension_message('00000000-0000-4000-8000-00000000e2e1')$q$), '42501',
  'the message helper stays internal');

-- ── A suspended member can still delete their own rows ──
select is(pg_temp.student($q$delete from public.society_members where society_id = '00000000-0000-4000-8000-0000000938b1'
  and user_id = '00000000-0000-4000-8000-00000000e2e1'$q$), 'ok', 'they can leave a society');
select ok(not pg_temp.in_society('b1', '00000000-0000-4000-8000-00000000e2e1'), 'and are out of it');
select is(pg_temp.student($q$delete from public.team_members where team_id = 93802 and user_id = '00000000-0000-4000-8000-00000000e2e1'$q$),
  'ok', 'they can leave a team');
select ok(not pg_temp.in_team(93802, '00000000-0000-4000-8000-00000000e2e1'), 'and are out of it');
select is(pg_temp.student('delete from public.threads where id = 93821'), 'ok', 'they can delete their thread');
select is((select count(*) from public.threads where id = 93821), 0::bigint, 'the thread is gone');
select is(pg_temp.student('delete from public.places where id = 93841'), 'ok', 'they can delete their place');
select is(pg_temp.student('delete from public.wiki_talk where id = 93861'), 'ok', 'they can delete their wiki talk');
select is(pg_temp.student('delete from public.teams where id = 93803'), 'ok', 'they can delete a team they own');
select ok(not pg_temp.in_team(93803, '00000000-0000-4000-8000-000000000004')
          and not exists (select 1 from public.team_roles where id = 93812), 'its members and roles cascade away');

-- ── Active leads and owners still remove members ──
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-000000000003',
  $q$delete from public.society_members where society_id = '00000000-0000-4000-8000-0000000938b1'
     and user_id = '00000000-0000-4000-8000-000000000004'$q$), 'ok', 'an active lead can remove a member');
select ok(not pg_temp.in_society('b1', '00000000-0000-4000-8000-000000000004'), 'the member is out');
select is(pg_temp.mod($q$delete from public.team_members where team_id = 93802 and user_id = '00000000-0000-4000-8000-000000000004'$q$),
  'ok', 'an active owner can remove a team member');
select ok(not pg_temp.in_team(93802, '00000000-0000-4000-8000-000000000004'), 'the member is out');

-- ── A suspended moderator can't remove other people's content ──
insert into public.suspensions (user_id, reason) values ('00000000-0000-4000-8000-00000000e2e2', 'Moderator on a break');
select is(pg_temp.mod('select public.resolve_report(93831, true)'), 'DT403', 'a suspended moderator cannot remove reported content');
select is((select count(*) from public.threads where id = 93822), 1::bigint, 'the reported thread is still there');
select is(pg_temp.mod('delete from public.places where id = 93842'), 'DT403', 'nor someone else''s place');
select is(pg_temp.mod('delete from public.wiki_talk where id = 93862'), 'DT403', 'nor someone else''s wiki talk');
select is(pg_temp.mod('delete from public.campus_events where id = 93871'), 'DT403', 'nor a campus event');
select is(pg_temp.mod('delete from public.deadlines where id = 93881'), 'DT403', 'nor a deadline');
select is(pg_temp.mod('delete from public.exam_windows where id = 93891'), 'DT403', 'nor an exam window');

-- ── Active moderators still do ──
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-000000000002', 'delete from public.campus_events where id = 93872'),
  'ok', 'an active moderator can delete a campus event');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-000000000002', 'select public.resolve_report(93831, true)'),
  'ok', 'and remove reported content');

select * from finish();
rollback;
