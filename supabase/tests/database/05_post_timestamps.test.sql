-- Direct member inserts cannot put posts in the future.
begin;
\ir 00_helpers.sql
select plan(10);

select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', $q$
  insert into public.threads (id, board_id, author_id, kind, title, created_at, updated_at, poll_closes_at)
  overriding system value values (
    90005, '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-00000000e2e1',
    'poll', 'Timestamp test poll', '2099-01-01', '2099-01-01', '2099-01-01'
  )
$q$), 'ok', 'a member can create a poll');
select is((select created_at from public.threads where id = 90005), now(), 'the server sets thread creation time');
select is((select updated_at from public.threads where id = 90005), now(), 'the server sets thread update time');
select is((select poll_closes_at from public.threads where id = 90005), now() + interval '168 hours',
  'a poll cannot close more than one week after creation');

select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', $q$
  update public.threads set body = 'edited', poll_closes_at = '2099-01-01' where id = 90005
$q$), 'ok', 'a member can still edit the poll body');
select is((select poll_closes_at from public.threads where id = 90005), now() + interval '168 hours',
  'editing a poll cannot extend its deadline');

select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', $q$
  insert into public.replies (id, thread_id, author_id, body, created_at)
  overriding system value values (90005, 90005, '00000000-0000-4000-8000-00000000e2e1', 'answer', '2099-01-01')
$q$), 'ok', 'a member can reply');
select is((select created_at from public.replies where id = 90005), now(), 'the server sets reply creation time');

select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', $q$
  insert into public.threads (id, board_id, author_id, kind, title, poll_closes_at)
  overriding system value values (
    90006, '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-00000000e2e1',
    'poll', 'One-day test poll', now() + interval '24 hours'
  )
$q$), 'ok', 'a member can create a one-day poll');
select is((select poll_closes_at from public.threads where id = 90006), now() + interval '24 hours',
  'the requested poll deadline is preserved inside the limit');

select * from finish();
rollback;
