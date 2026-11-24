-- Owner-only tables (#10): one member can't read or write another member's votes,
-- drafts or notifications, and can't promote themselves or edit their own
-- counters. e2e2 (the moderator account) plays the other member and owns every
-- row; e2e1 is the member poking at them. Saves and push tokens are covered in
-- 01_access and 18_push_token_handover.
begin;
\ir 00_helpers.sql
select plan(16);

insert into public.threads (id, board_id, author_id, title, body)
overriding system value values (91001, '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-00000000e2e2', 'Owner-only test thread', 'body');
insert into public.replies (id, thread_id, author_id, body)
overriding system value values (91011, 91001, '00000000-0000-4000-8000-00000000e2e2', 'owner-only test reply');
insert into public.thread_votes (thread_id, user_id, value) values (91001, '00000000-0000-4000-8000-00000000e2e2', 1);
insert into public.reply_votes (reply_id, user_id, value) values (91011, '00000000-0000-4000-8000-00000000e2e2', 1);
insert into public.drafts (user_id, kind, title) values ('00000000-0000-4000-8000-00000000e2e2', 'thread', 'private draft');
insert into public.notifications (user_id, kind, text, route) values ('00000000-0000-4000-8000-00000000e2e2', 'reply', 'x', '/');

-- Reading: the other member sees none of it, the owner sees their own.
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', 'select count(*) from public.thread_votes where thread_id = 91001'), 0::bigint, 'thread votes are private');
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', 'select count(*) from public.reply_votes where reply_id = 91011'), 0::bigint, 'reply votes are private');
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', $q$select count(*) from public.drafts where title = 'private draft'$q$), 0::bigint, 'drafts are private');
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', $q$select count(*) from public.notifications where text = 'x'$q$), 0::bigint, 'notifications are private');
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e2', $q$select count(*) from public.drafts where title = 'private draft'$q$), 1::bigint, 'the owner sees their draft');

-- Writing: updates and deletes match no rows (RLS filters them out, no error), inserts as someone else fail.
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  'with u as (update public.thread_votes set value = -1 where thread_id = 91001 returning 1) select count(*) from u'), 0::bigint, 'cannot change another member''s thread vote');
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  'with d as (delete from public.reply_votes where reply_id = 91011 returning 1) select count(*) from d'), 0::bigint, 'cannot delete another member''s reply vote');
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$with u as (update public.drafts set title = 'hijacked' returning 1) select count(*) from u$q$), 0::bigint, 'cannot edit another member''s draft');
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$with u as (update public.notifications set read_at = now() where text = 'x' returning 1) select count(*) from u$q$), 0::bigint, 'cannot mark another member''s notification read');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$insert into public.drafts (user_id, title) values ('00000000-0000-4000-8000-00000000e2e2', 'planted')$q$), '42501', 'cannot plant a draft for someone else');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$insert into public.thread_votes (thread_id, user_id, value) values (91001, '00000000-0000-4000-8000-00000000e2e2', -1)$q$), '42501', 'cannot vote as someone else');

-- Profile: role and counters can't be edited from the client; the update itself succeeds but nothing changes.
create temp table before_profile as
  select role, karma, thread_count, reply_count, accepted_count, upload_count, download_count
  from public.profiles where id = '00000000-0000-4000-8000-00000000e2e1';
grant select on before_profile to authenticated;
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$update public.profiles set role = 'admin', karma = 99999, thread_count = 999, reply_count = 999, accepted_count = 999,
       upload_count = 999, download_count = 999, bio = 'edited my own bio' where id = auth.uid()$q$), 'ok', 'a member can update their own profile');
select is((select bio from public.profiles where id = '00000000-0000-4000-8000-00000000e2e1'), 'edited my own bio', 'the allowed field changed');
select is((select role from public.profiles where id = '00000000-0000-4000-8000-00000000e2e1'), 'member', 'the role is still member');
select ok((select p.karma = b.karma and p.thread_count = b.thread_count and p.reply_count = b.reply_count and p.accepted_count = b.accepted_count
    and p.upload_count = b.upload_count and p.download_count = b.download_count
  from public.profiles p, before_profile b where p.id = '00000000-0000-4000-8000-00000000e2e1'), 'karma and every counter are unchanged');
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$with u as (update public.profiles set bio = 'not yours' where id = '00000000-0000-4000-8000-00000000e2e2' returning 1) select count(*) from u$q$), 0::bigint, 'cannot edit another member''s profile');

select * from finish();
rollback;
