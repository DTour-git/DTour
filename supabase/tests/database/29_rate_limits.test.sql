-- Rate limits (#13): per-user caps on posting, enforced by before-insert triggers.
-- e2e1 is a member, e2e2 the moderator. Wiki article 1 is a published guide by someone else.
begin;
\ir 00_helpers.sql
select plan(21);

-- Start from empty budgets: earlier browser tests may have left ledger rows for these accounts (rolled back with this file).
delete from public.rate_limit_hits where user_id in ('00000000-0000-4000-8000-00000000e2e1', '00000000-0000-4000-8000-00000000e2e2');

-- How many of n runs of sql succeed for that user, and the first error message when one does not.
create function pg_temp.ok_count(uid uuid, q text, n int) returns bigint language sql as $$
  select count(*) filter (where pg_temp.try_as('authenticated', uid, q) = 'ok') from generate_series(1, n)
$$;
create function pg_temp.err_as(uid uuid, q text) returns text language plpgsql as $$
declare m text;
begin
  perform set_config('request.jwt.claims', pg_temp.claims(uid), true);
  set local role authenticated;
  begin execute q; exception when others then m := sqlerrm; end;
  reset role;
  return m;
end $$;


-- Lounge: 10 a minute.
select is(pg_temp.ok_count('00000000-0000-4000-8000-00000000e2e1', $$insert into public.lounge_messages (room_slug, author_id, body) values ((select slug from public.lounge_rooms limit 1), '00000000-0000-4000-8000-00000000e2e1', 'hi')$$, 10), 10::bigint, 'ten Lounge messages in a minute go through');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', $$insert into public.lounge_messages (room_slug, author_id, body) values ((select slug from public.lounge_rooms limit 1), '00000000-0000-4000-8000-00000000e2e1', 'hi')$$), 'DT429', 'the eleventh is refused with SQLSTATE DT429');
select matches(pg_temp.err_as('00000000-0000-4000-8000-00000000e2e1', $$insert into public.lounge_messages (room_slug, author_id, body) values ((select slug from public.lounge_rooms limit 1), '00000000-0000-4000-8000-00000000e2e1', 'hi')$$), '^Slow down a little — try again in (a minute|\d+ minutes)\.$', 'with a friendly message');

-- Deleting your messages doesn't hand the budget back, and nor does backdating.
select pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', $$delete from public.lounge_messages where author_id = '00000000-0000-4000-8000-00000000e2e1'$$);
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', $$insert into public.lounge_messages (room_slug, author_id, body) values ((select slug from public.lounge_rooms limit 1), '00000000-0000-4000-8000-00000000e2e1', 'hi')$$), 'DT429', 'deleting your own messages does not reset the limit');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $$insert into public.lounge_messages (room_slug, author_id, body, created_at) values ((select slug from public.lounge_rooms limit 1), '00000000-0000-4000-8000-00000000e2e1', 'old', now() - interval '1 day')$$),
  'DT429', 'a backdated created_at does not get around it');

-- After the window it works again.
update public.rate_limit_hits set at = at - interval '2 minutes' where user_id = '00000000-0000-4000-8000-00000000e2e1'::uuid and action = 'lounge_messages';
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', $$insert into public.lounge_messages (room_slug, author_id, body) values ((select slug from public.lounge_rooms limit 1), '00000000-0000-4000-8000-00000000e2e1', 'hi')$$), 'ok', 'inserts after the window succeed');

-- Moderators are exempt.
select is(pg_temp.ok_count('00000000-0000-4000-8000-00000000e2e2', $$insert into public.lounge_messages (room_slug, author_id, body) values ((select slug from public.lounge_rooms limit 1), '00000000-0000-4000-8000-00000000e2e2', 'hi')$$, 15), 15::bigint,
  'a moderator is not limited');
-- So are server-side writes, even with a member's claims still set on the connection.
select set_config('request.jwt.claims', pg_temp.claims('00000000-0000-4000-8000-00000000e2e1'), true);
insert into public.lounge_messages (room_slug, author_id, body)
select (select slug from public.lounge_rooms limit 1), '00000000-0000-4000-8000-00000000e2e1'::uuid, 'server side' from generate_series(1, 12);
select is((select count(*) from public.lounge_messages where body = 'server side'), 12::bigint, 'writes as postgres are not limited');

-- The ledger is private.
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', 'select count(*) from public.rate_limit_hits'), '42501', 'members cannot read the ledger');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', 'delete from public.rate_limit_hits'), '42501', 'or clear it');

-- Replies: 30 per 10 minutes.
insert into public.threads (id, board_id, author_id, title, body) overriding system value
values (92901, '00000000-0000-4000-8000-000000000201'::uuid, '00000000-0000-4000-8000-00000000e2e2'::uuid, 'Rate limit thread', 'body');
select is(pg_temp.ok_count('00000000-0000-4000-8000-00000000e2e1', $$insert into public.replies (thread_id, author_id, body) values (92901, '00000000-0000-4000-8000-00000000e2e1', 'reply')$$, 30), 30::bigint, 'thirty replies in ten minutes go through');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', $$insert into public.replies (thread_id, author_id, body) values (92901, '00000000-0000-4000-8000-00000000e2e1', 'reply')$$), 'DT429', 'the thirty-first is refused');

-- Threads: 10 an hour, including ones made with "turn into a thread".
select is(pg_temp.ok_count('00000000-0000-4000-8000-00000000e2e1', $$insert into public.threads (board_id, author_id, title, body) values ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-00000000e2e1', 'Spam thread', 'body')$$, 10), 10::bigint, 'ten threads an hour go through');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', $$insert into public.threads (board_id, author_id, title, body) values ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-00000000e2e1', 'Spam thread', 'body')$$), 'DT429', 'the eleventh is refused');
insert into public.lounge_messages (id, room_slug, author_id, body) overriding system value
values (92902, (select slug from public.lounge_rooms limit 1), '00000000-0000-4000-8000-00000000e2e1'::uuid, 'promote me');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', $$select public.promote_lounge_message(92902, '00000000-0000-4000-8000-000000000201', 'Promoted thread')$$),
  'DT429', 'turning a message into a thread counts too');

-- Reports: 10 an hour.
insert into public.threads (id, board_id, author_id, title, body) overriding system value
select 93000 + i, '00000000-0000-4000-8000-000000000201'::uuid, '00000000-0000-4000-8000-00000000e2e2'::uuid, 'To report', 'body' from generate_series(1, 11) i;
select is(pg_temp.ok_count('00000000-0000-4000-8000-00000000e2e1', 'insert into public.reports (reporter_id, thread_id, reason) values (''00000000-0000-4000-8000-00000000e2e1'', 93000 + (select count(*) from public.reports where reporter_id = ''00000000-0000-4000-8000-00000000e2e1'') + 1, ''spam'')', 11),
  10::bigint, 'ten reports an hour go through, the eleventh does not');

-- Team requests: 10 an hour.
insert into public.teams (id, owner_id, category, event_name, title) overriding system value
select 94000 + i, '00000000-0000-4000-8000-00000000e2e2'::uuid, 'hackathon', 'Event', 'Team' from generate_series(1, 11) i;
select is((select count(*) filter (where r = 'ok') from (
  select pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', 'select public.toggle_team_request(' || (94000 + i) || ')') r from generate_series(1, 11) i) x),
  10::bigint, 'ten team requests an hour go through, the eleventh does not');

-- Places: 10 an hour.
select is(pg_temp.ok_count('00000000-0000-4000-8000-00000000e2e1', $$insert into public.places (author_id, category, name) values ('00000000-0000-4000-8000-00000000e2e1', 'canteen', 'A place')$$, 11),
  10::bigint, 'ten place recommendations an hour go through, the eleventh does not');

-- Wiki: starting a guide (article + its first revision) counts once; later suggestions count on their own.
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', $$with a as (
    insert into public.wiki_articles (slug, title, started_by, status) values ('rate-limit-guide', 'Guide', '00000000-0000-4000-8000-00000000e2e1', 'pending') returning id)
  insert into public.wiki_revisions (article_id, editor_id, summary, body, status) select id, '00000000-0000-4000-8000-00000000e2e1', 'started the article', 'text', 'suggested' from a$$),
  'ok', 'a new guide and its first revision are one action');
select is(pg_temp.ok_count('00000000-0000-4000-8000-00000000e2e1', $$insert into public.wiki_revisions (article_id, editor_id, summary, body, status) values (1, '00000000-0000-4000-8000-00000000e2e1', 'tweak', 'text', 'suggested')$$, 11),
  10::bigint, 'ten wiki suggestions an hour go through, the eleventh does not');
select is((select count(*) from public.rate_limit_hits where action = 'wiki_articles' and user_id = '00000000-0000-4000-8000-00000000e2e1'::uuid), 1::bigint, 'the article counted once');

select * from finish();
rollback;
