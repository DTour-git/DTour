begin;
\ir 00_helpers.sql
select plan(24);

insert into public.thread_votes(thread_id, user_id, value)
values (3, '00000000-0000-4000-8000-00000000e2e1', 1);

select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  $q$select public.set_member_suspension('00000000-0000-4000-8000-00000000e2e1', 'Internal reason', null, false, true)$q$), 'ok', 'moderator suspends member');
select ok(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', 'select count(*) from public.threads') > 0, 'suspended member can read');
select ok(pg_temp.count_as('anon', null, 'select count(*) from public.threads') > 0, 'visitor can read');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$insert into public.threads(board_id,author_id,title) values ('00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-00000000e2e1','blocked')$q$), '42501', 'cannot post');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$insert into public.replies(thread_id,author_id,body) values (3,'00000000-0000-4000-8000-00000000e2e1','blocked')$q$), '42501', 'cannot reply');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$insert into public.thread_votes(thread_id,user_id,value) values (3,'00000000-0000-4000-8000-00000000e2e1',1)$q$), '42501', 'cannot vote');
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$with changed as (update public.thread_votes set value = -1 where thread_id = 3 returning 1) select count(*) from changed$q$), 0::bigint, 'cannot change an existing vote');
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$with removed as (delete from public.thread_votes where thread_id = 3 returning 1) select count(*) from removed$q$), 0::bigint, 'cannot remove an existing vote');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$insert into public.rsvps(post_id,user_id) values (1,'00000000-0000-4000-8000-00000000e2e1')$q$), '42501', 'cannot RSVP');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$insert into public.lounge_messages(room_slug,author_id,body) values ('global','00000000-0000-4000-8000-00000000e2e1','blocked')$q$), '42501', 'cannot send Lounge message');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$insert into public.team_requests(team_id,user_id) values (1,'00000000-0000-4000-8000-00000000e2e1')$q$), '42501', 'cannot request to join team');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$insert into storage.objects(bucket_id,name) values ('media','00000000-0000-4000-8000-00000000e2e1/blocked.png')$q$), '42501', 'cannot upload');
select isnt(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', 'select public.accept_reply(3, null)'), 'ok', 'security definer RPC is blocked');
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', 'select count(*) from public.my_suspension() where reason is null'), 1::bigint, 'private reason is hidden');
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', 'select count(*) from public.member_suspensions'), 0::bigint, 'suspension details are private');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  $q$select public.set_member_suspension('00000000-0000-4000-8000-00000000e2e2', 'reason', null, false, true)$q$) <> 'ok', true, 'moderator cannot suspend moderator');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  $q$select public.set_member_suspension('00000000-0000-4000-8000-00000000e2e1', 'Lifted', null, false, false)$q$), 'ok', 'moderator lifts suspension');
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e2', 'select count(*) from public.suspension_events'), 2::bigint, 'both actions are logged');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$insert into public.replies(thread_id,author_id,body) values (3,'00000000-0000-4000-8000-00000000e2e1','allowed')$q$), 'ok', 'member can write after suspension is lifted');
insert into public.member_suspensions(user_id, reason, share_reason, ends_at, suspended_by)
values ('00000000-0000-4000-8000-00000000e2e1', 'Past suspension', true, now() - interval '1 second', '00000000-0000-4000-8000-00000000e2e2');
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', 'select count(*) from public.my_suspension()'), 0::bigint, 'expired suspension is no longer visible');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$insert into public.replies(thread_id,author_id,body) values (3,'00000000-0000-4000-8000-00000000e2e1','allowed after expiry')$q$), 'ok', 'member can write after expiry');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$select public.set_member_suspension('00000000-0000-4000-8000-00000000e2e2', 'reason', null, false, true)$q$) <> 'ok', true, 'member cannot suspend a moderator');
update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-00000000e2e1';
select isnt(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  $q$select public.set_member_suspension('00000000-0000-4000-8000-00000000e2e1', 'reason', null, false, true)$q$), 'ok', 'moderator cannot suspend an admin');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$select public.set_member_suspension('00000000-0000-4000-8000-00000000e2e2', 'reason', null, false, true)$q$), 'ok', 'admin can suspend a moderator');
select * from finish();
rollback;
