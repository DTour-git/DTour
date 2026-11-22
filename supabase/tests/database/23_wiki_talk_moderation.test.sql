-- Wiki talk (#55): limited in length, deletable by its author or a moderator,
-- and reportable through the moderation queue. Article 1 is a published guide.
-- e2e1 is a member, e2e2 the moderator, profile 2 another member.
begin;
\ir 00_helpers.sql
select plan(14);

-- Length.
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $$insert into public.wiki_talk (article_id, author_id, body) values (1, '00000000-0000-4000-8000-00000000e2e1', repeat('x', 2001))$$),
  '23514', 'a talk post over 2000 characters is refused');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $$insert into public.wiki_talk (article_id, author_id, body) values (1, '00000000-0000-4000-8000-00000000e2e1', '   ')$$),
  '23514', 'an empty talk post is refused');

insert into public.wiki_talk (id, article_id, author_id, body) overriding system value values
  (90801, 1, '00000000-0000-4000-8000-00000000e2e1', 'my own talk post'),
  (90802, 1, '00000000-0000-4000-8000-000000000002', 'someone else''s talk post'),
  (90803, 1, '00000000-0000-4000-8000-000000000002', 'a talk post to report and remove'),
  (90804, 1, '00000000-0000-4000-8000-000000000002', 'a talk post to report and keep');
select is((select count(*) from public.wiki_talk where id between 90801 and 90804), 4::bigint, 'normal talk posts still work');

-- Deleting.
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  'with d as (delete from public.wiki_talk where id = 90802 returning 1) select count(*) from d'), 0::bigint,
  'a member cannot delete someone else''s talk post');
select is(pg_temp.try_as('anon', null, 'delete from public.wiki_talk where id = 90801'), '42501',
  'a visitor cannot delete a talk post');
select is((select talk_count from public.wiki_articles where id = 1) is not null, true, 'the guide has a talk count');
create temp table before_count as select talk_count from public.wiki_articles where id = 1;
grant select on before_count to authenticated;
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  'with d as (delete from public.wiki_talk where id = 90801 returning 1) select count(*) from d'), 1::bigint,
  'the author can delete their own talk post');
select is((select talk_count from public.wiki_articles where id = 1), (select talk_count - 1 from before_count),
  'and the guide''s talk count goes down');
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  'with d as (delete from public.wiki_talk where id = 90802 returning 1) select count(*) from d'), 1::bigint,
  'a moderator can delete any talk post');

-- Reporting.
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $$insert into public.reports (reporter_id, wiki_talk_id, reason) values ('00000000-0000-4000-8000-00000000e2e1', 90803, 'spam'),
    ('00000000-0000-4000-8000-00000000e2e1', 90804, 'other')$$), 'ok', 'a member can report a talk post');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $$insert into public.reports (reporter_id, wiki_talk_id, reason) values ('00000000-0000-4000-8000-00000000e2e1', 90803, 'spam')$$),
  '23505', 'but only once');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $$insert into public.reports (reporter_id, wiki_talk_id, thread_id, reason) values ('00000000-0000-4000-8000-00000000e2e1', 90804, 1, 'spam')$$),
  '23514', 'a report still has exactly one target');

select pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  format('select public.resolve_report(%s, true)', (select id from public.reports where wiki_talk_id = 90803)));
select is((select count(*) from public.wiki_talk where id = 90803), 0::bigint, 'a moderator removing a reported talk post deletes it');
select pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  format('select public.resolve_report(%s, false)', (select id from public.reports where wiki_talk_id = 90804)));
select is((select status from public.reports where wiki_talk_id = 90804), 'dismissed', 'dismissing keeps the post and closes the report');

select * from finish();
rollback;
