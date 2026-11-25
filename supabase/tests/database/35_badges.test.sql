-- Badges (#63): triggers award them for real activity, once per kind, with a
-- notification; demo users get none; clients can only read them.
-- e2e1 is the student who earns badges, e2e2 the moderator (and team owner),
-- profile 1 a demo user.
begin;
\ir 00_helpers.sql
select plan(30);

-- Start both test accounts from zero.
delete from public.badges where user_id in ('00000000-0000-4000-8000-00000000e2e1', '00000000-0000-4000-8000-00000000e2e2');
delete from public.notifications where kind = 'badge';
update public.profiles set accepted_count = 0, upload_count = 0, karma = 0
where id in ('00000000-0000-4000-8000-00000000e2e1', '00000000-0000-4000-8000-00000000e2e2', '00000000-0000-4000-8000-000000000001');

create function pg_temp.has_badge(uid uuid, k text) returns bigint language sql as $$
  select count(*) from public.badges where user_id = uid and kind = k
$$;
create function pg_temp.badge_notes(uid uuid) returns bigint language sql as $$
  select count(*) from public.notifications where user_id = uid and kind = 'badge'
$$;

-- ── Clients can read badges but never write them ──
insert into public.badges (id, user_id, kind, icon, tone, label) overriding system value values
  (93501, '00000000-0000-4000-8000-00000000e2e1', null, 'fire', 'accent2', 'Test badge');
select is(pg_temp.count_as('anon', null, 'select count(*) from public.badges where id = 93501'), 1::bigint,
  'a visitor can see badges');
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e2', 'select count(*) from public.badges where id = 93501'),
  1::bigint, 'a member can see someone else''s badges');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$insert into public.badges (user_id, kind, icon, tone, label) values ('00000000-0000-4000-8000-00000000e2e1', 'karma_1000', 'medal', 'accent2', '1,000 karma')$q$),
  '42501', 'a member cannot give themselves a badge');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$update public.badges set label = 'Renamed' where id = 93501$q$), '42501', 'a member cannot edit their badge');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$delete from public.badges where id = 93501$q$), '42501', 'a member cannot delete their badge');
select isnt(pg_temp.try_as('anon', null, $q$delete from public.badges where id = 93501$q$), 'ok', 'a visitor cannot delete badges');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$select public.award_badge('00000000-0000-4000-8000-00000000e2e1', 'karma_1000')$q$),
  '42501', 'a member cannot call award_badge');
select is((select label from public.badges where id = 93501), 'Test badge', 'the badge is unchanged');
select is(pg_temp.has_badge('00000000-0000-4000-8000-00000000e2e1', 'karma_1000'), 0::bigint, 'and no badge was added');

-- ── First accepted answer ──
update public.profiles set accepted_count = 1 where id = '00000000-0000-4000-8000-00000000e2e1';
select is(pg_temp.has_badge('00000000-0000-4000-8000-00000000e2e1', 'first_accepted'), 1::bigint,
  'a first accepted answer earns the badge');
select is(pg_temp.badge_notes('00000000-0000-4000-8000-00000000e2e1'), 1::bigint, 'and a notification');
select is((select text from public.notifications where user_id = '00000000-0000-4000-8000-00000000e2e1' and kind = 'badge'),
  'You earned the “First accepted answer” badge', 'the notification names the badge');
select is((select route from public.notifications where user_id = '00000000-0000-4000-8000-00000000e2e1' and kind = 'badge'),
  '/u/e2e.student', 'it links to the student''s profile');
select ok((select actor_id is null from public.notifications where user_id = '00000000-0000-4000-8000-00000000e2e1' and kind = 'badge'),
  'it has no actor');

-- Losing the answer and earning it again doesn't award a second badge.
update public.profiles set accepted_count = 0 where id = '00000000-0000-4000-8000-00000000e2e1';
select is(pg_temp.has_badge('00000000-0000-4000-8000-00000000e2e1', 'first_accepted'), 1::bigint, 'the badge stays once earned');
update public.profiles set accepted_count = 1 where id = '00000000-0000-4000-8000-00000000e2e1';
select is(pg_temp.has_badge('00000000-0000-4000-8000-00000000e2e1', 'first_accepted'), 1::bigint, 'it is awarded only once');
select is(pg_temp.badge_notes('00000000-0000-4000-8000-00000000e2e1'), 1::bigint, 'with only one notification');

-- ── Librarian and 1,000 karma ──
update public.profiles set upload_count = 9, karma = 999 where id = '00000000-0000-4000-8000-00000000e2e1';
select is(pg_temp.has_badge('00000000-0000-4000-8000-00000000e2e1', 'librarian'), 0::bigint, '9 uploads is not enough');
select is(pg_temp.has_badge('00000000-0000-4000-8000-00000000e2e1', 'karma_1000'), 0::bigint, '999 karma is not enough');
update public.profiles set upload_count = 10 where id = '00000000-0000-4000-8000-00000000e2e1';
select is(pg_temp.has_badge('00000000-0000-4000-8000-00000000e2e1', 'librarian'), 1::bigint, '10 uploads earns Librarian');
insert into public.karma_events (user_id, bucket, amount, reason) values ('00000000-0000-4000-8000-00000000e2e1', 'Test', 1, 'test');
select is(pg_temp.has_badge('00000000-0000-4000-8000-00000000e2e1', 'karma_1000'), 1::bigint, 'reaching 1,000 karma earns the badge');

-- ── Wiki author: a moderator approves the student's guide ──
insert into public.wiki_articles (id, slug, title, body, started_by, status) overriding system value values
  (93511, 'test-63-guide', 'Badge test guide', 'GUIDE', '00000000-0000-4000-8000-00000000e2e1', 'pending');
select is(pg_temp.has_badge('00000000-0000-4000-8000-00000000e2e1', 'wiki_author'), 0::bigint, 'a pending guide earns nothing');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2', 'select public.review_wiki_article(93511, true)'),
  'ok', 'the moderator approves the guide');
select is(pg_temp.has_badge('00000000-0000-4000-8000-00000000e2e1', 'wiki_author'), 1::bigint, 'an approved guide earns Wiki author');

-- ── Team player: joining someone else's team, not your own ──
insert into public.teams (id, owner_id, category, event_name, title) overriding system value values
  (93521, '00000000-0000-4000-8000-00000000e2e2', 'hackathon', 'Test hackathon', 'Badge test team');
insert into public.team_members (team_id, user_id) values (93521, '00000000-0000-4000-8000-00000000e2e2');
select is(pg_temp.has_badge('00000000-0000-4000-8000-00000000e2e2', 'team_player'), 0::bigint, 'joining your own team earns nothing');
insert into public.team_members (team_id, user_id) values (93521, '00000000-0000-4000-8000-00000000e2e1');
select is(pg_temp.has_badge('00000000-0000-4000-8000-00000000e2e1', 'team_player'), 1::bigint, 'joining another team earns Team player');
select is(pg_temp.badge_notes('00000000-0000-4000-8000-00000000e2e1'), 5::bigint, 'one notification per badge earned');

-- ── Demo users are skipped ──
update public.profiles set accepted_count = 1, upload_count = 10, karma = 1000 where id = '00000000-0000-4000-8000-000000000001';
select is((select count(*) from public.badges where user_id = '00000000-0000-4000-8000-000000000001' and kind is not null),
  0::bigint, 'a demo user earns no badges');
select is(pg_temp.badge_notes('00000000-0000-4000-8000-000000000001'), 0::bigint, 'and gets no notification');

select throws_ok($q$select public.award_badge('00000000-0000-4000-8000-00000000e2e1', 'made_up')$q$,
  'P0001', 'Unknown badge made_up', 'an unknown badge kind is refused');

select * from finish();
rollback;
