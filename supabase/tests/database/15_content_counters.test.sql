-- Places, library items, wiki articles and teams can't arrive with preset counters,
-- editorial flags or someone else's moderation attribution (issue #27).
begin;
\ir 00_helpers.sql
select plan(42);

-- e2e1 is a member, e2e2 a moderator. A test subject for library uploads.
insert into public.branches (code, name, full_name) values ('GT27', 'Guard Test', 'Guard Test Branch');
insert into public.subjects (code, name, branch_code, semester) values ('GT2701', 'Guard Test Subject', 'GT27', 1);

-- ── Places ───────────────────────────────────────────────────────────────
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', $q$
  insert into public.places (id, author_id, category, name, where_label, price_label,
                             hearts, recs, home_sort, home_meta, sort, is_demo, created_at)
  overriding system value values
    (92701, '00000000-0000-4000-8000-00000000e2e1', 'nearby', 'Guard Test Dhaba', 'Gate 3', '₹',
     999999, 999999, 1, 'pinned', 0, true, '2099-01-01')
$q$), 'ok', 'a member can recommend a place');
select is((select hearts from public.places where id = 92701), 0, 'a new place starts with no hearts');
select is((select recs from public.places where id = 92701), 0, 'a new place starts with no recommendations');
select ok((select home_sort is null and home_meta is null from public.places where id = 92701),
  'a member cannot pin their place to the Today page');
select is((select sort from public.places where id = 92701), 50::smallint, 'a member''s place goes after the curated list');
select is((select is_demo from public.places where id = 92701), false, 'a member cannot mark a place as demo content');
select is((select created_at from public.places where id = 92701), now(), 'the server sets a place''s creation time');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', $q$
  insert into public.places (author_id, category, name) values ('00000000-0000-4000-8000-00000000e2e2', 'nearby', 'Not mine')
$q$), '42501', 'a member cannot recommend a place in someone else''s name');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', $q$
  select public.toggle_heart(92701)
$q$), 'ok', 'a member can heart a place');
select is((select hearts from public.places where id = 92701), 1, 'a heart still bumps the place''s count');

-- ── Library items ────────────────────────────────────────────────────────
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', $q$
  insert into public.library_items (id, subject_code, kind, title, uploader_id,
                                    downloads, downloads_week, top_rated, is_demo, created_at)
  overriding system value values
    (92701, 'GT2701', 'notes', 'Guard test notes', '00000000-0000-4000-8000-00000000e2e1',
     999999, 999999, true, true, '2099-01-01')
$q$), 'ok', 'a member can upload a library item');
select is((select downloads from public.library_items where id = 92701), 0, 'a new upload starts with no downloads');
select is((select downloads_week from public.library_items where id = 92701), 0, 'a new upload starts with no downloads this week');
select is((select top_rated from public.library_items where id = 92701), false, 'a member cannot mark their upload top rated');
select is((select is_demo from public.library_items where id = 92701), false, 'a member cannot mark an upload as demo content');
select is((select created_at from public.library_items where id = 92701), now(), 'the server sets an upload''s creation time');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', $q$
  select public.record_download(92701)
$q$), 'ok', 'a member can download a library item');
select is((select downloads from public.library_items where id = 92701), 1, 'a download still bumps the item''s count');

-- ── Wiki articles ────────────────────────────────────────────────────────
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', $q$
  insert into public.wiki_articles (id, slug, title, body, started_by, status,
                                    checked_by, checked_at, reviewed_by, reviewed_at, review_note, ai_verdict,
                                    editor_count, useful_count, talk_count, views_week, is_demo, created_at, updated_at)
  overriding system value values
    (92701, 'guard-test-27', 'Guard test guide', 'Body', '00000000-0000-4000-8000-00000000e2e1', 'pending',
     '00000000-0000-4000-8000-00000000e2e2', '2026-01-01', '00000000-0000-4000-8000-00000000e2e2', '2026-01-01',
     'Looks great', '{"ok":true}', 999, 999, 999, 999999, true, '2099-01-01', '2099-01-01')
$q$), 'ok', 'a member can submit a guide');
select ok((select checked_by is null and checked_at is null from public.wiki_articles where id = 92701),
  'a member cannot mark their guide as checked by a moderator');
select ok((select reviewed_by is null and reviewed_at is null and review_note is null and ai_verdict is null
           from public.wiki_articles where id = 92701),
  'a member cannot fill in their guide''s review');
select is((select editor_count from public.wiki_articles where id = 92701), 1, 'a new guide starts with one editor');
select is((select useful_count from public.wiki_articles where id = 92701), 0, 'a new guide starts with no "useful" votes');
select is((select talk_count from public.wiki_articles where id = 92701), 0, 'a new guide starts with no talk posts');
select is((select views_week from public.wiki_articles where id = 92701), 0, 'a new guide starts with no views');
select is((select is_demo from public.wiki_articles where id = 92701), false, 'a member cannot mark a guide as demo content');
select ok((select created_at = now() and updated_at = now() from public.wiki_articles where id = 92701),
  'the server sets a guide''s timestamps');
select is((select status from public.wiki_articles where id = 92701), 'pending', 'a member''s guide still waits for review');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2', $q$
  select public.review_wiki_article(92701, true, 'Approved')
$q$), 'ok', 'a moderator can approve the guide');
select ok((select status = 'published' and reviewed_by = '00000000-0000-4000-8000-00000000e2e2'::uuid and review_note = 'Approved'
           from public.wiki_articles where id = 92701),
  'approval still records the moderator''s review');

-- ── Teams ────────────────────────────────────────────────────────────────
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', $q$
  insert into public.teams (id, owner_id, category, event_name, title, urgent, extra_members, is_demo, created_at)
  overriding system value values
    (92701, '00000000-0000-4000-8000-00000000e2e1', 'hackathon', 'Guard Hack', 'Guard test team', true, 9, true, '2099-01-01')
$q$), 'ok', 'a member can post a team');
select is((select urgent from public.teams where id = 92701), false, 'a member cannot flag a new team as urgent');
select is((select extra_members from public.teams where id = 92701), 0, 'a new team starts with no extra members');
select is((select is_demo from public.teams where id = 92701), false, 'a member cannot mark a team as demo content');
select is((select created_at from public.teams where id = 92701), now(), 'the server sets a team''s creation time');

select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', $q$
  update public.teams set urgent = true, extra_members = 99, is_demo = true, created_at = '2000-01-01' where id = 92701
$q$), 'ok', 'an owner''s update of protected team columns does not error');
select is((select urgent from public.teams where id = 92701), false, 'an owner cannot flag their team as urgent');
select is((select extra_members from public.teams where id = 92701), 0, 'an owner cannot inflate their team''s member count');
select ok((select not is_demo and created_at = now() from public.teams where id = 92701),
  'an owner cannot mark their team as demo content or backdate it');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', $q$
  update public.teams set title = 'Guard test team, renamed', description = 'Looking for a designer' where id = 92701
$q$), 'ok', 'an owner can edit their team');
select is((select title from public.teams where id = 92701), 'Guard test team, renamed', 'an owner''s edit is saved');

-- ── Maintainer SQL is not affected ───────────────────────────────────────
update public.places set home_sort = 4, hearts = 7 where id = 92701;
select ok((select home_sort = 4 and hearts = 7 from public.places where id = 92701),
  'maintainers can still curate places in SQL');

select * from finish();
rollback;
