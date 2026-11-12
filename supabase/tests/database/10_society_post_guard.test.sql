-- Society posters edit only their own posts, and never counters, attribution or state (issue #49).
begin;
\ir 00_helpers.sql
select plan(19);

-- Two test societies. The student (e2e1) can post as both; the moderator account (e2e2)
-- is a second poster of the first society.
insert into public.societies (id, slug, name) values
  ('00000000-0000-4000-8000-0000000c4901', 'guard-test-one', 'Guard Test One'),
  ('00000000-0000-4000-8000-0000000c4902', 'guard-test-two', 'Guard Test Two');
insert into public.society_members (society_id, user_id, can_post) values
  ('00000000-0000-4000-8000-0000000c4901', '00000000-0000-4000-8000-00000000e2e1', true),
  ('00000000-0000-4000-8000-0000000c4902', '00000000-0000-4000-8000-00000000e2e1', true),
  ('00000000-0000-4000-8000-0000000c4901', '00000000-0000-4000-8000-00000000e2e2', true);

-- A post by the other poster, created by a maintainer.
insert into public.society_posts (id, society_id, author_id, kind, title, when_label, rsvp_count, created_at)
overriding system value values
  (94901, '00000000-0000-4000-8000-0000000c4901', '00000000-0000-4000-8000-00000000e2e2',
   'event', 'Their post', 'Fri 6 pm', 0, '2026-01-01');

-- ── Inserts ──────────────────────────────────────────────────────────────
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', $q$
  insert into public.society_posts (id, society_id, author_id, kind, title, when_label,
                                    rsvp_count, featured, is_demo, created_at)
  overriding system value values
    (94902, '00000000-0000-4000-8000-0000000c4901', '00000000-0000-4000-8000-00000000e2e1',
     'workshop', 'My post', 'Mon 5 pm', 500, true, true, '2099-01-01')
$q$), 'ok', 'a poster can create a society post');
select is((select rsvp_count from public.society_posts where id = 94902), 0, 'a new post starts with no RSVPs');
select is((select featured from public.society_posts where id = 94902), false, 'a poster cannot feature their own new post');
select is((select is_demo from public.society_posts where id = 94902), false, 'a poster cannot mark a new post as demo content');
select is((select created_at from public.society_posts where id = 94902), now(), 'the server sets the post creation time');

-- ── Someone else's post ──────────────────────────────────────────────────
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', $q$
  update public.society_posts
  set title = 'Hijacked', author_id = '00000000-0000-4000-8000-00000000e2e1', rsvp_count = 9999, featured = true
  where id = 94901
$q$), 'ok', 'updating another poster''s post is filtered, not an error');
select is((select title from public.society_posts where id = 94901), 'Their post', 'a poster cannot edit another poster''s post');
select is((select author_id from public.society_posts where id = 94901), '00000000-0000-4000-8000-00000000e2e2'::uuid,
  'a poster cannot take over another poster''s post');
select is((select rsvp_count from public.society_posts where id = 94901), 0, 'a poster cannot change another post''s RSVPs');

-- ── Own post: protected columns ──────────────────────────────────────────
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', $q$
  update public.society_posts
  set author_id = '00000000-0000-4000-8000-00000000e2e2', society_id = '00000000-0000-4000-8000-0000000c4902',
      rsvp_count = 9999, featured = true, is_demo = true, created_at = '2000-01-01'
  where id = 94902
$q$), 'ok', 'a poster''s update of protected columns on their own post does not error');
select is((select author_id from public.society_posts where id = 94902), '00000000-0000-4000-8000-00000000e2e1'::uuid,
  'a poster cannot pin their post on someone else');
select is((select society_id from public.society_posts where id = 94902), '00000000-0000-4000-8000-0000000c4901'::uuid,
  'a poster cannot move their post to another society');
select is((select rsvp_count from public.society_posts where id = 94902), 0, 'a poster cannot set their own RSVP count');
select is((select featured from public.society_posts where id = 94902), false, 'a poster cannot feature their own post');
select is((select created_at from public.society_posts where id = 94902), now(), 'a poster cannot backdate their own post');

-- ── Own post: normal edits still work ────────────────────────────────────
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', $q$
  update public.society_posts set title = 'My post, now in SPS-13', where_label = 'SPS-13' where id = 94902
$q$), 'ok', 'a poster can edit their own post');
select is((select title || ' @ ' || where_label from public.society_posts where id = 94902), 'My post, now in SPS-13 @ SPS-13',
  'a poster''s edit of their own post is saved');

-- ── Counters still move through their trigger ────────────────────────────
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', $q$
  select public.toggle_rsvp(94901)
$q$), 'ok', 'a member can RSVP');
select is((select rsvp_count from public.society_posts where id = 94901), 1, 'an RSVP still bumps the post''s RSVP count');

select * from finish();
rollback;
