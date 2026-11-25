-- Handle changes and Lounge promotion (#10). e2e1 is the student, e2e2 the
-- moderator account acting as a second member.
begin;
\ir 00_helpers.sql
select plan(11);

-- A rename rewrites @mentions of the old handle in threads, but not longer handles that share its prefix.
update public.profiles set handle_changed_at = null where id in ('00000000-0000-4000-8000-00000000e2e1', '00000000-0000-4000-8000-00000000e2e2');
delete from public.handle_history where user_id in ('00000000-0000-4000-8000-00000000e2e1', '00000000-0000-4000-8000-00000000e2e2');
insert into public.threads (id, board_id, author_id, title, body)
overriding system value values (91501, '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-00000000e2e2', 'Mention rewrite test', 'ping @e2e.student, not @e2e.student_x');

select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$update public.profiles set handle = 'e2e.renamed' where id = auth.uid()$q$), 'ok', 'a member can rename themselves');
select is((select body from public.threads where id = 91501), 'ping @e2e.renamed, not @e2e.student_x', 'the old @mention now points at the new handle');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  $q$update public.profiles set handle = 'admin' where id = auth.uid()$q$), '23514', 'a reserved handle is rejected');

-- Only the author of a Lounge message can turn it into a thread.
insert into public.lounge_messages (id, room_slug, author_id, body)
overriding system value values (91601, 'global', '00000000-0000-4000-8000-00000000e2e1', 'a message worth a thread');

select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  $q$select public.promote_lounge_message(91601, '00000000-0000-4000-8000-000000000201', 'Stolen')$q$), 'P0001', 'another member cannot promote the message');
select is((select promoted_thread_id from public.lounge_messages where id = 91601), null::bigint, 'the message is still not a thread');
select is(pg_temp.try_as('anon', null,
  $q$select public.promote_lounge_message(91601, '00000000-0000-4000-8000-000000000201', 'Anon')$q$), '42501', 'a visitor cannot promote the message');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$select public.promote_lounge_message(91601, '00000000-0000-4000-8000-000000000201', 'Promoted test')$q$), 'ok', 'the author can promote their message');
select is((select author_id from public.threads where from_lounge_message_id = 91601), '00000000-0000-4000-8000-00000000e2e1'::uuid, 'the new thread belongs to the author');
select is((select title from public.threads where from_lounge_message_id = 91601), 'Promoted test', 'the new thread has the chosen title');
select ok((select promoted_thread_id is not null from public.lounge_messages where id = 91601), 'the message links to its thread');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$select public.promote_lounge_message(91601, '00000000-0000-4000-8000-000000000201', 'Promoted twice')$q$), 'P0001', 'a message can only be promoted once');

select * from finish();
rollback;
