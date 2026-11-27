-- Deleting your account removes your unused media uploads (#133): my_unused_media()
-- lists the caller's media files that nothing left on DTour references, and
-- delete_my_account() refuses while any are left. Images kept content still shows stay.
begin;
\ir 00_helpers.sql
select plan(12);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-4000-8000-0000000ed001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'uploader_2k24co911@dtu.ac.in', '', '{"provider":"email","providers":["email"]}', '{}', now(), now());

create function pg_temp.url(file text) returns text language sql as $$
  select 'http://127.0.0.1:54321/storage/v1/object/public/media/00000000-0000-4000-8000-0000000ed001/' || file
$$;
create function pg_temp.me(q text) returns text language sql as $$
  select pg_temp.try_as('authenticated', '00000000-0000-4000-8000-0000000ed001', q)
$$;
create function pg_temp.unused() returns text language plpgsql as $$
declare r text;
begin
  perform set_config('request.jwt.claims', pg_temp.claims('00000000-0000-4000-8000-0000000ed001'), true);
  set local role authenticated;
  select string_agg(n, ',' order by n) into r from public.my_unused_media() n;
  reset role;
  return r;
end $$;

insert into storage.objects (bucket_id, name, owner_id) values
  ('media', '00000000-0000-4000-8000-0000000ed001/in-thread.jpg', '00000000-0000-4000-8000-0000000ed001'),
  ('media', '00000000-0000-4000-8000-0000000ed001/in-place.jpg', '00000000-0000-4000-8000-0000000ed001'),
  ('media', '00000000-0000-4000-8000-0000000ed001/in-cover.jpg', '00000000-0000-4000-8000-0000000ed001'),
  ('media', '00000000-0000-4000-8000-0000000ed001/quoted.jpg', '00000000-0000-4000-8000-0000000ed001'),
  ('media', '00000000-0000-4000-8000-0000000ed001/in-own-team.jpg', '00000000-0000-4000-8000-0000000ed001'),
  ('media', '00000000-0000-4000-8000-0000000ed001/in-draft.jpg', '00000000-0000-4000-8000-0000000ed001'),
  ('media', '00000000-0000-4000-8000-0000000ed001/never-used.jpg', '00000000-0000-4000-8000-0000000ed001'),
  ('media', '00000000-0000-4000-8000-00000000e2e1/someone-elses.jpg', '00000000-0000-4000-8000-00000000e2e1'),
  ('library', '00000000-0000-4000-8000-0000000ed001/notes.pdf', '00000000-0000-4000-8000-0000000ed001');

-- Their own thread, place and guide; someone else's reply quoting an image; their own team (deleted with them); a draft.
insert into public.threads (id, board_id, author_id, title, body) overriding system value values
  (94101, '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-0000000ed001', 'Photo thread',
   'Look ![x](' || pg_temp.url('in-thread.jpg') || ')');
insert into public.replies (thread_id, author_id, body) values
  (94101, '00000000-0000-4000-8000-00000000e2e1', 'Quoting ![y](' || pg_temp.url('quoted.jpg') || ')');
insert into public.places (author_id, category, name, where_label, sort, image_path) values
  ('00000000-0000-4000-8000-0000000ed001', 'nearby', 'Photo stall', 'Gate 2', 50, pg_temp.url('in-place.jpg'));
insert into public.wiki_articles (slug, title, started_by, status, body, cover_path) values
  ('photo-guide-94101', 'Photo guide', '00000000-0000-4000-8000-0000000ed001', 'pending', 'body', pg_temp.url('in-cover.jpg'));
insert into public.teams (owner_id, category, event_name, title, description) values
  ('00000000-0000-4000-8000-0000000ed001', 'project', 'Test', 'Photo team', '![t](' || pg_temp.url('in-own-team.jpg') || ')');
insert into public.drafts (user_id, kind, body) values
  ('00000000-0000-4000-8000-0000000ed001', 'thread', '![d](' || pg_temp.url('in-draft.jpg') || ')');

select is(pg_temp.unused(),
  '00000000-0000-4000-8000-0000000ed001/in-draft.jpg,00000000-0000-4000-8000-0000000ed001/in-own-team.jpg,00000000-0000-4000-8000-0000000ed001/never-used.jpg',
  'unused: never referenced, only in a draft, or only in a team deleted with the account');
select is(pg_temp.try_as('anon', null, 'select public.my_unused_media()'), '42501', 'a visitor cannot list unused media');
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$select count(*) from public.my_unused_media() n where n not like '00000000-0000-4000-8000-00000000e2e1/%'$q$), 0::bigint,
  'another member only ever gets their own files');
select is(pg_temp.me($q$select public.unused_media('00000000-0000-4000-8000-00000000e2e1')$q$), '42501', 'the per-user helper is internal');
select is(pg_temp.me($q$select public.media_references('00000000-0000-4000-8000-00000000e2e1')$q$), '42501', 'and so is the reference scan');

select is(pg_temp.me('select public.delete_my_account()'), 'DT409', 'the account cannot be deleted while unused uploads are left');
select is((select count(*) from public.profiles where id = '00000000-0000-4000-8000-0000000ed001'), 1::bigint, 'it is still there');

-- What the app does through the Storage API: remove the unused files (the owner may).
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-0000000ed001',
  $q$select count(*) from storage.objects where bucket_id = 'media' and name in (select public.my_unused_media())$q$),
  3::bigint, 'the owner can see the files to remove');
set local storage.allow_delete_query = 'true';
delete from storage.objects where name in (
  '00000000-0000-4000-8000-0000000ed001/in-draft.jpg', '00000000-0000-4000-8000-0000000ed001/in-own-team.jpg',
  '00000000-0000-4000-8000-0000000ed001/never-used.jpg');

select is(pg_temp.me('select public.delete_my_account()'), 'ok', 'with them gone the account can be deleted');
select is((select count(*) from storage.objects where bucket_id = 'media' and name like '00000000-0000-4000-8000-0000000ed001/%'), 4::bigint,
  'images still shown by a kept thread, reply, place or guide stay');
select is((select count(*) from storage.objects where bucket_id = 'library' and name like '00000000-0000-4000-8000-0000000ed001/%'), 1::bigint,
  'library files are untouched');
select is((select count(*) from storage.objects where name = '00000000-0000-4000-8000-00000000e2e1/someone-elses.jpg'), 1::bigint,
  'other students'' files are untouched');

select * from finish();
rollback;
