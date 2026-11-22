-- Notification flooding (#52): re-upvoting or re-requesting doesn't notify again.
-- e2e2 writes the thread and owns the team; e2e1 and profile 3 upvote; e2e1 asks to join.
begin;
\ir 00_helpers.sql
select plan(10);

insert into public.threads (id, board_id, author_id, title, body)
overriding system value values (90501, '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-00000000e2e2', 'Flood test thread', 'body');

create function pg_temp.upvote_note() returns public.notifications language sql as $$
  select * from public.notifications
  where user_id = '00000000-0000-4000-8000-00000000e2e2' and kind = 'upvote' and thread_id = 90501 and reply_id is null
$$;

-- Upvote, take it back and upvote again, five times over.
select pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', 'select public.set_thread_vote(90501, 1::smallint)');
select pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  'select public.set_thread_vote(90501, 0::smallint), public.set_thread_vote(90501, 1::smallint)')
from generate_series(1, 5);
select is((select count(*) from public.notifications where user_id = '00000000-0000-4000-8000-00000000e2e2'
  and kind = 'upvote' and thread_id = 90501), 1::bigint, 'one notification for the thread''s upvotes');
select is((pg_temp.upvote_note()).count, 1, 're-upvoting does not inflate the count');
select is((pg_temp.upvote_note()).text, 'upvoted your thread “Flood test thread”', 'the headline still names one upvoter');

-- A second person still counts.
select pg_temp.try_as('authenticated', '00000000-0000-4000-8000-000000000003', 'select public.set_thread_vote(90501, 1::smallint)');
select is((pg_temp.upvote_note()).count, 2, 'a second person upvoting is counted');
select is((pg_temp.upvote_note()).text, 'and 1 other upvoted your thread “Flood test thread”', 'and the headline says so');
select pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  'select public.set_thread_vote(90501, 0::smallint), public.set_thread_vote(90501, 1::smallint)');
select is((pg_temp.upvote_note()).count, 2, 'the first person re-upvoting still counts once');

-- The list of upvoters stays private.
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  'select count(*) from public.notification_upvoters'), '42501', 'nobody can read who was counted');

-- Asking to join, withdrawing and asking again notifies the owner once.
insert into public.teams (id, owner_id, category, event_name, title)
overriding system value values (90502, '00000000-0000-4000-8000-00000000e2e2', 'hackathon', 'Flood hackathon', 'Flood test team');
select pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', 'select public.toggle_team_request(90502)')
from generate_series(1, 7);
select is((select status from public.team_requests where team_id = 90502 and user_id = '00000000-0000-4000-8000-00000000e2e1'),
  'pending', 'the request is still pending after the churn');
select is((select count(*) from public.notifications where user_id = '00000000-0000-4000-8000-00000000e2e2'
  and kind = 'team_request' and team_id = 90502), 1::bigint, 're-sending a request does not notify the owner again');

-- Once the owner has read it and a day has passed, a new request notifies again.
update public.notifications set read_at = now(), created_at = now() - interval '2 days'
where user_id = '00000000-0000-4000-8000-00000000e2e2' and kind = 'team_request' and team_id = 90502;
select pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', 'select public.toggle_team_request(90502)')
from generate_series(1, 2);
select is((select count(*) from public.notifications where user_id = '00000000-0000-4000-8000-00000000e2e2'
  and kind = 'team_request' and team_id = 90502 and read_at is null), 1::bigint, 'a later request notifies again');

select * from finish();
rollback;
