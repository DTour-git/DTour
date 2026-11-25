-- Account deletion (#14): personal data goes, posts stay with no author.
-- A leaves; B replies under A's thread and has a thread A replied to; the
-- student e2e1 votes on A's anonymised reply afterwards.
begin;
\ir 00_helpers.sql
select plan(15);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-0000000d014a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'leaver_2k24co141@dtu.ac.in', '', '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-4000-8000-0000000d014b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stayer_2k24co142@dtu.ac.in', '', '{"provider":"email","providers":["email"]}', '{}', now(), now());
update public.profiles set handle = 'leaver14', onboarded = true where id = '00000000-0000-4000-8000-0000000d014a';
update public.profiles set handle = 'stayer14', onboarded = true where id = '00000000-0000-4000-8000-0000000d014b';

insert into public.threads (id, board_id, author_id, title, body) overriding system value values
  (91401, '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-0000000d014a', 'Leaver thread', 'body'),
  (91402, '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-0000000d014b', 'Stayer thread', 'body');
insert into public.replies (id, thread_id, author_id, body) overriding system value values
  (91411, 91401, '00000000-0000-4000-8000-0000000d014b', 'Stayer replies under the leaver thread'),
  (91412, 91402, '00000000-0000-4000-8000-0000000d014a', 'Leaver replies under the stayer thread');
insert into public.wiki_revisions (id, article_id, editor_id, summary, body, status) overriding system value
  select 91421, id, '00000000-0000-4000-8000-0000000d014a', 'leaver edit', 'Edited by someone who left.', 'suggested'
  from public.wiki_articles where status = 'published' limit 1;
insert into public.teams (id, owner_id, category, event_name, title) overriding system value
  values (91431, '00000000-0000-4000-8000-0000000d014b', 'project', 'Test', 'Leaver team');
insert into public.team_roles (team_id, name, filled_by, filled) values (91431, 'Design', '00000000-0000-4000-8000-0000000d014a', true);
insert into public.team_members (team_id, user_id) values (91431, '00000000-0000-4000-8000-0000000d014a');
insert into public.thread_votes (thread_id, user_id, value) values (91402, '00000000-0000-4000-8000-0000000d014a', 1);
insert into public.reply_votes (reply_id, user_id, value) values (91412, '00000000-0000-4000-8000-0000000d014b', 1);
insert into public.saves (user_id, thread_id) values ('00000000-0000-4000-8000-0000000d014a', 91402);
insert into public.device_push_tokens (token, user_id, platform) values ('ExponentPushToken[leaver14]', '00000000-0000-4000-8000-0000000d014a', 'android');

select is(pg_temp.try_as('anon', null, 'select public.delete_my_account()'), '42501', 'a visitor cannot delete an account');
select is(pg_temp.try_as('anon', null, 'select public.export_my_data()'), '42501', 'a visitor cannot export data');

select set_config('request.jwt.claims', pg_temp.claims('00000000-0000-4000-8000-0000000d014a'), true);
set local role authenticated;
select is(public.export_my_data()->'profile'->>'handle', 'leaver14', 'the export holds their profile');
select is(jsonb_array_length(public.export_my_data()->'threads'), 1, 'and their threads');
reset role;

select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-0000000d014a', 'select public.delete_my_account()'), 'ok', 'a student can delete their account');
select set_config('request.jwt.claims', '', true);

select is((select count(*) from auth.users where id = '00000000-0000-4000-8000-0000000d014a')
        + (select count(*) from public.profiles where id = '00000000-0000-4000-8000-0000000d014a'), 0::bigint, 'the account and profile are gone');
select is((select count(*) from public.threads where id = 91401 and author_id is null), 1::bigint, 'their thread stays, with no author');
select is((select count(*) from public.replies where id in (91411, 91412)), 2::bigint, 'replies under it and their own reply both stay');
select is((select count(*) from public.thread_votes where user_id = '00000000-0000-4000-8000-0000000d014a')
        + (select count(*) from public.saves where user_id = '00000000-0000-4000-8000-0000000d014a')
        + (select count(*) from public.device_push_tokens where user_id = '00000000-0000-4000-8000-0000000d014a'), 0::bigint, 'votes, saves and push tokens are gone');
select is((select score from public.threads where id = 91402), 0, 'a vote they cast no longer counts');
select is((select handle_status('leaver14')), 'available', 'the handle is released');

-- Anyone can still vote on their anonymised reply: score moves, no karma is written for nobody.
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $$insert into public.reply_votes (reply_id, user_id, value) values (91412, '00000000-0000-4000-8000-00000000e2e1', 1)$$), 'ok', 'a vote on their reply still works');
select is((select score from public.replies where id = 91412), 2, 'its score is the sum of the votes');

select is((select filled from public.team_roles where team_id = 91431), false, 'a team role they filled opens up again');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2', 'select public.review_wiki_revision(91421, true)'), 'ok', 'a moderator can approve their suggested wiki edit');

select * from finish();
rollback;
