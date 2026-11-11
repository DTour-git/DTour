begin;
\ir 00_helpers.sql
select plan(14);

insert into public.threads (id, board_id, author_id, kind, title)
overriding system value values
  (90028, '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-00000000e2e2', 'poll', 'First parent test'),
  (90029, '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-00000000e2e2', 'poll', 'Second parent test');
insert into public.poll_options (id, thread_id, label)
overriding system value values (90028, 90028, 'First option'), (90029, 90028, 'Alternative'), (90030, 90029, 'Other poll option');

select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$insert into public.poll_votes values (90029, '00000000-0000-4000-8000-00000000e2e1', 90028)$q$),
  '23503', 'an option cannot receive a vote for another thread');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$insert into public.poll_votes values (90028, '00000000-0000-4000-8000-00000000e2e1', 90028)$q$),
  'ok', 'a matching poll vote is accepted');
select is((select votes from public.poll_options where id = 90028), 1, 'only the matching vote is counted');
select ok(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$insert into public.poll_votes values (90029, '00000000-0000-4000-8000-00000000e2e1', 90028)$q$)
  = any(array['23503', '23505']), 'the same option cannot be voted through another thread');
select is((select count(*) from public.poll_votes where option_id = 90028), 1::bigint, 'only one vote row exists');
select ok(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  'update public.poll_votes set option_id = 90030 where thread_id = 90028') = any(array['23503', '23514']),
  'updates must keep the option in its poll');
select ok(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  'update public.poll_votes set thread_id = 90029 where thread_id = 90028') = any(array['23503', '23514']),
  'updates cannot attach a vote to another poll');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$insert into public.poll_votes values (90028, '00000000-0000-4000-8000-00000000e2e1', 90028)$q$),
  '23505', 'a member still gets one vote per poll');

select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  'delete from public.poll_votes where thread_id = 90028'), 'ok', 'the app can remove the previous vote');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$insert into public.poll_votes values (90028, '00000000-0000-4000-8000-00000000e2e1', 90029)$q$),
  'ok', 'the app can switch to another option in the same poll');
select is((select votes from public.poll_options where id = 90028), 0, 'the previous option loses the vote');
select is((select votes from public.poll_options where id = 90029), 1, 'the new option gains the vote');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$insert into public.poll_votes values (90029, '00000000-0000-4000-8000-00000000e2e1', 90030)$q$),
  'ok', 'the member can also vote in another poll');
delete from public.poll_options where id = 90030;
select is((select count(*) from public.poll_votes where thread_id = 90029), 0::bigint, 'deleting an option still cascades to its votes');

select * from finish();
rollback;
