-- A reply's parent must be a reply in the same thread (#58).
-- e2e2 writes both threads and the parent reply; e2e1 replies.
begin;
\ir 00_helpers.sql
select plan(6);

insert into public.threads (id, board_id, author_id, title, body)
overriding system value values
  (90701, '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-00000000e2e2', 'Parent test thread', 'body'),
  (90702, '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-00000000e2e2', 'Other thread', 'body');
insert into public.replies (id, thread_id, author_id, body)
overriding system value values (90711, 90701, '00000000-0000-4000-8000-00000000e2e2', 'the parent');

-- Nested replies in the same thread still work.
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $$insert into public.replies (thread_id, parent_id, author_id, body) values (90701, 90711, '00000000-0000-4000-8000-00000000e2e1', 'a nested reply')$$),
  'ok', 'a reply to a reply in the same thread works');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $$insert into public.replies (thread_id, author_id, body) values (90701, '00000000-0000-4000-8000-00000000e2e1', 'a top-level reply')$$),
  'ok', 'a top-level reply works');

-- A parent in another thread, the reply itself, or a reply that doesn't exist are refused.
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $$insert into public.replies (thread_id, parent_id, author_id, body) values (90702, 90711, '00000000-0000-4000-8000-00000000e2e1', 'cross-thread')$$),
  '23503', 'a parent in another thread is refused');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $$insert into public.replies (id, thread_id, parent_id, author_id, body) overriding system value values (90712, 90701, 90712, '00000000-0000-4000-8000-00000000e2e1', 'my own parent')$$),
  '23503', 'a reply cannot be its own parent');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $$insert into public.replies (thread_id, parent_id, author_id, body) values (90701, 99999999, '00000000-0000-4000-8000-00000000e2e1', 'ghost parent')$$),
  '23503', 'a parent that does not exist is refused');

-- The other thread's author got no notification out of it.
select is((select count(*) from public.notifications where thread_id = 90702), 0::bigint,
  'no notification is sent for the refused cross-thread reply');

select * from finish();
rollback;
