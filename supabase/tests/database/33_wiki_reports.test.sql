-- Wiki visibility and reports (#10). e2e1 is a member, e2e2 the moderator,
-- profiles 2 and 3 are other students. Wiki: a pending guide or suggested edit
-- is hidden from other students until a moderator approves it. Reports: students
-- see only their own, moderators see all and are the only ones who can resolve.
begin;
\ir 00_helpers.sql
select plan(18);

insert into public.wiki_articles (id, slug, title, body, started_by, status)
overriding system value values (91301, 'test-10-pending', 'Pending guide', 'PENDING BODY', '00000000-0000-4000-8000-00000000e2e1', 'pending');
insert into public.wiki_revisions (id, article_id, editor_id, summary, body, status)
overriding system value values (91311, 1, '00000000-0000-4000-8000-00000000e2e1', 'test edit', 'SUGGESTED BODY', 'suggested');

select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-000000000002', 'select count(*) from public.wiki_articles where id = 91301'), 0::bigint, 'another student cannot see a pending guide');
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-000000000002', 'select count(*) from public.wiki_revisions where id = 91311'), 0::bigint, 'another student cannot see a suggested edit');
select is(pg_temp.count_as('anon', null, 'select count(*) from public.wiki_articles where id = 91301'), 0::bigint, 'a visitor cannot see a pending guide');
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', 'select count(*) from public.wiki_articles where id = 91301'), 1::bigint, 'the author sees their pending guide');
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', 'select count(*) from public.wiki_revisions where id = 91311'), 1::bigint, 'the editor sees their suggested edit');
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e2', 'select count(*) from public.wiki_articles where id = 91301'), 1::bigint, 'a moderator sees the pending guide');
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e2', 'select count(*) from public.wiki_revisions where id = 91311'), 1::bigint, 'a moderator sees the suggested edit');

select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2', 'select public.review_wiki_article(91301, true)'), 'ok', 'a moderator approves the guide');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2', 'select public.review_wiki_revision(91311, true)'), 'ok', 'a moderator approves the edit');
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-000000000002', 'select count(*) from public.wiki_articles where id = 91301 and status = ''published'''), 1::bigint, 'the approved guide is public');
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-000000000002', 'select count(*) from public.wiki_revisions where id = 91311 and status = ''published'''), 1::bigint, 'the approved edit is public');

-- Reports: profile 2 wrote a reply on thread 3; e2e1 reports it, profile 3 reports the thread.
insert into public.replies (id, thread_id, author_id, body)
overriding system value values (91411, 3, '00000000-0000-4000-8000-000000000002', 'reply to be reported');
insert into public.reports (id, reporter_id, reply_id, reason)
overriding system value values (91421, '00000000-0000-4000-8000-00000000e2e1', 91411, 'spam');
insert into public.reports (id, reporter_id, thread_id, reason)
overriding system value values (91422, '00000000-0000-4000-8000-000000000003', 3, 'spam');

select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-000000000003', 'select count(*) from public.reports where id in (91421, 91422)'), 1::bigint, 'a student sees only their own reports');
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e2', 'select count(*) from public.reports where id in (91421, 91422)'), 2::bigint, 'a moderator sees every report');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', 'select public.resolve_report(91421, true)'), 'P0001', 'a student cannot resolve a report');
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e2', 'select count(*) from public.reports where id = 91421 and status = ''open'''), 1::bigint, 'the report is still open');
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e2', 'select count(*) from public.replies where id = 91411'), 1::bigint, 'the reply is still there');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2', 'select public.resolve_report(91421, true)'), 'ok', 'a moderator removes the reported reply');
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e2', 'select count(*) from public.replies where id = 91411'), 0::bigint, 'the reply is gone');

select * from finish();
rollback;
