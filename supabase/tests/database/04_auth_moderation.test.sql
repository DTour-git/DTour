-- DTU-only sign-up, and wiki edits that need a moderator.
begin;
\ir 00_helpers.sql
select plan(6);

select ok(public.hook_before_user_created('{"user":{"email":"someone@gmail.com"}}'::jsonb) ? 'error', 'non-DTU email is rejected at sign-up');
select is(public.hook_before_user_created('{"user":{"email":"name_2k24co001@dtu.ac.in"}}'::jsonb), '{}'::jsonb, 'DTU email is allowed');

select isnt(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$insert into public.wiki_revisions (article_id, editor_id, summary, body, status) values (1, '00000000-0000-4000-8000-00000000e2e1', 'sneaky', 'x', 'published')$q$),
  'ok', 'members cannot publish wiki edits directly');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$insert into public.wiki_revisions (id, article_id, editor_id, summary, body, status) overriding system value values (90201, 1, '00000000-0000-4000-8000-00000000e2e1', 'test edit', 'MODERATED BODY', 'suggested')$q$),
  'ok', 'members can suggest an edit');
select isnt(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', 'select public.review_wiki_revision(90201, true)'),
  'ok', 'members cannot approve edits');

select pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2', 'select public.review_wiki_revision(90201, true)');
select is((select body from public.wiki_articles where id = 1), 'MODERATED BODY', 'moderator approval publishes the edit');

select * from finish();
rollback;
