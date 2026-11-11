-- Wiki review (#53): approving a guide publishes only that pending guide and
-- its own first revision. Other suggested edits wait for review_wiki_revision.
-- e2e1 is a member and writes the guides, e2e2 is the moderator, profile 2
-- suggests an edit nobody has reviewed.
begin;
\ir 00_helpers.sql
select plan(22);

insert into public.wiki_articles (id, slug, title, body, started_by, status)
overriding system value values
  (90301, 'test-53-pending', 'Pending test guide', 'GUIDE AS SUBMITTED', '00000000-0000-4000-8000-00000000e2e1', 'pending'),
  (90302, 'test-53-live', 'Live test guide', 'LIVE BODY', '00000000-0000-4000-8000-00000000e2e1', 'published'),
  (90303, 'test-53-reject', 'Guide to reject', 'REJECT ME', '00000000-0000-4000-8000-00000000e2e1', 'pending');
insert into public.wiki_revisions (id, article_id, editor_id, summary, body, status)
overriding system value values
  -- the pending guide's own first revision, as createWikiArticle writes it
  (90311, 90301, '00000000-0000-4000-8000-00000000e2e1', 'started the article', 'GUIDE AS SUBMITTED', 'suggested'),
  -- an edit to the live guide, waiting for review
  (90312, 90302, '00000000-0000-4000-8000-00000000e2e1', 'live edit', 'UNREVIEWED LIVE EDIT', 'suggested'),
  -- someone else's edit to the pending guide, never shown to the moderator
  (90313, 90301, '00000000-0000-4000-8000-000000000002', 'sneaky edit', 'UNREVIEWED PENDING EDIT', 'suggested');

-- Members and visitors can't review.
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  'select public.review_wiki_article(90301, true)'), 'P0001', 'a member cannot approve a guide');
select is((select status from public.wiki_articles where id = 90301), 'pending', 'the guide is still pending');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  'select public.review_wiki_revision(90312, true)'), 'P0001', 'a member cannot approve an edit');
select is((select status from public.wiki_revisions where id = 90312), 'suggested', 'the edit is still suggested');
select isnt(pg_temp.try_as('anon', null, 'select public.review_wiki_article(90301, true)'),
  'ok', 'a visitor cannot approve a guide');
select isnt(pg_temp.try_as('anon', null, 'select public.review_wiki_revision(90312, true)'),
  'ok', 'a visitor cannot approve an edit');

-- Approving a pending guide still works, and publishes only what was reviewed.
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  'select public.review_wiki_article(90301, true)'), 'ok', 'a moderator can approve a pending guide');
select is((select status from public.wiki_articles where id = 90301), 'published', 'the guide is live');
select is((select reviewed_by from public.wiki_articles where id = 90301),
  '00000000-0000-4000-8000-00000000e2e2'::uuid, 'the guide records who approved it');
select is((select status from public.wiki_revisions where id = 90311), 'published', 'the guide''s first revision is published with it');
select is((select status from public.wiki_revisions where id = 90313), 'suggested', 'another edit to the guide stays suggested');
select is((select body from public.wiki_articles where id = 90301), 'GUIDE AS SUBMITTED', 'the guide shows the body the moderator read');

-- A second approval (double click, stale tab) is refused and publishes nothing.
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  'select public.review_wiki_article(90301, true)'), 'P0001', 'approving a guide that is already live is refused');
select is((select status from public.wiki_revisions where id = 90313), 'suggested', 'the unreviewed edit is still suggested');

-- Reviewing a guide that was never pending doesn't touch its suggested edits.
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  'select public.review_wiki_article(90302, true)'), 'P0001', 'approving a live guide is refused');
select is((select status from public.wiki_revisions where id = 90312), 'suggested', 'its suggested edit stays suggested');
select is((select body from public.wiki_articles where id = 90302), 'LIVE BODY', 'the live guide keeps its body');

-- Rejecting still works once.
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  'select public.review_wiki_article(90303, false, ''needs sources'')'), 'ok', 'a moderator can reject a pending guide');
select is((select status from public.wiki_articles where id = 90303), 'rejected', 'the guide is rejected');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  'select public.review_wiki_article(90303, true)'), 'P0001', 'a rejected guide cannot then be approved');

-- Each edit still goes live through its own review.
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  'select public.review_wiki_revision(90313, true)'), 'ok', 'a moderator can approve the edit on its own');
select is((select body from public.wiki_articles where id = 90301), 'UNREVIEWED PENDING EDIT', 'the approved edit is applied');

select * from finish();
rollback;
