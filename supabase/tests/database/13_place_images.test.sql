-- A place's photo must be an upload in DTour's own media bucket, never a third-party URL (issue #43).
begin;
\ir 00_helpers.sql
select plan(12);

-- ── Members recommending a place ─────────────────────────────────────────
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', $q$
  insert into public.places (id, category, name, author_id, image_path) overriding system value values
    (94301, 'nearby', 'Tracker cafe', '00000000-0000-4000-8000-00000000e2e1',
     'https://tracker.example/pixel.png?user=00000000-0000-4000-8000-00000000e2e1')
$q$), '23514', 'a member cannot give a place a third-party image');

select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', $q$
  insert into public.places (id, category, name, author_id, image_path) overriding system value values
    (94302, 'nearby', 'Look-alike cafe', '00000000-0000-4000-8000-00000000e2e1',
     'https://megohwzcghnbfdzsaypz.supabase.co.evil.example/storage/v1/object/public/media/00000000-0000-4000-8000-00000000e2e1/a.png')
$q$), '23514', 'a host that only starts like a Supabase project is refused');

select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', $q$
  insert into public.places (id, category, name, author_id, image_path) overriding system value values
    (94303, 'nearby', 'Other bucket cafe', '00000000-0000-4000-8000-00000000e2e1',
     'https://megohwzcghnbfdzsaypz.supabase.co/storage/v1/object/public/library/00000000-0000-4000-8000-00000000e2e1/a.png')
$q$), '23514', 'an image outside the media bucket is refused');

select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', $q$
  insert into public.places (id, category, name, author_id, image_path) overriding system value values
    (94304, 'nearby', 'Traversal cafe', '00000000-0000-4000-8000-00000000e2e1',
     'https://megohwzcghnbfdzsaypz.supabase.co/storage/v1/object/public/media/00000000-0000-4000-8000-00000000e2e1/..%2f..%2fx')
$q$), '23514', 'a path that climbs out of the uploader folder is refused');

select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', $q$
  insert into public.places (id, category, name, author_id, image_path) overriding system value values
    (94305, 'nearby', 'Query cafe', '00000000-0000-4000-8000-00000000e2e1',
     'https://megohwzcghnbfdzsaypz.supabase.co/storage/v1/object/public/media/00000000-0000-4000-8000-00000000e2e1/a.png?u=1')
$q$), '23514', 'a media URL with a query string is refused');

select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', $q$
  insert into public.places (id, category, name, author_id, image_path) overriding system value values
    (94306, 'nearby', 'Uploaded cafe', '00000000-0000-4000-8000-00000000e2e1',
     'https://megohwzcghnbfdzsaypz.supabase.co/storage/v1/object/public/media/00000000-0000-4000-8000-00000000e2e1/1731400000000-k3j9x2.jpg')
$q$), 'ok', 'a member can give a place a photo uploaded to the media bucket');

select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', $q$
  insert into public.places (id, category, name, author_id, image_path) overriding system value values
    (94307, 'nearby', 'Local cafe', '00000000-0000-4000-8000-00000000e2e1',
     'http://127.0.0.1:54321/storage/v1/object/public/media/00000000-0000-4000-8000-00000000e2e1/a.png')
$q$), 'ok', 'uploads on a local Supabase stack are accepted');

select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', $q$
  insert into public.places (id, category, name, author_id) overriding system value values
    (94308, 'nearby', 'No photo cafe', '00000000-0000-4000-8000-00000000e2e1')
$q$), 'ok', 'a place can have no photo');

-- ── Later edits (members have no update policy; maintainers and SQL do) ──
select throws_ok($q$
  update public.places set image_path = 'https://tracker.example/pixel.png' where id = 94306
$q$, '23514', null, 'an update cannot switch a photo to a third-party image');

select throws_ok($q$
  update public.places set image_path = 'data:image/png;base64,iVBORw0KGgo=' where id = 94306
$q$, '23514', null, 'an update cannot switch a photo to a data URI');

select lives_ok($q$
  update public.places
  set image_path = 'https://cqdqfmejbwvumbbclkfk.supabase.co/storage/v1/object/public/media/00000000-0000-4000-8000-00000000e2e2/b.webp'
  where id = 94306
$q$, 'an update to another media upload is accepted');

select is((select count(*) from public.places
           where image_path is not null and not public.is_media_image_url(image_path)), 0::bigint,
  'no stored place points outside the media bucket');

select * from finish();
rollback;
