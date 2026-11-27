-- Deleting your account removes your unused media uploads (#133, follow-up to #14).
--
-- delete_my_account() deleted auth.users and everything in public that cascades, but
-- not Storage: images a student uploaded to the public `media` bucket (under
-- media/<their uid>/) stayed online. Nobody but the service role could remove them,
-- because the "delete own objects" policy matches the folder against auth.uid().
--
-- Decision for #133: on account deletion, remove only the uploads that nothing left on
-- DTour uses, and keep the ones still in use. Posts, wiki guides, places and society
-- posts stay after deletion (#14), and their images must keep working.
--   * my_unused_media() lists the caller's media files that no remaining content
--     references: thread, reply, Lounge and wiki talk bodies; thread images; wiki
--     guide bodies, deks and covers; suggested wiki edits; place images; society post
--     bodies and posters; society, board and team descriptions (teams the member owns
--     are left out, since they are deleted with the account); pinned Lounge text.
--     Drafts and notifications don't count: drafts are deleted with the account, and
--     a notification is only a copy.
--     If you add a column that can hold a media URL, add it to media_references() below.
--   * The apps delete those files through the Storage API first (deleting rows in
--     storage.objects from SQL is refused, and wouldn't remove the file). Then they call
--     delete_my_account(), which now refuses with SQLSTATE DT409 while any unused upload
--     is left. So the promise holds for any client, not only ours.
--   * `library` files are unchanged: library items stay, with their uploader set to null.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Every remaining text that mentions this member's media folder. Narrowed with one
-- substring scan per column; my_unused_media() then checks each file name against these.
create or replace function public.media_references(p_user uuid)
returns setof text language sql stable security definer set search_path = '' as $$
  with f as (select '/media/' || p_user::text || '/' as folder)
  select t.body from public.threads t, f where strpos(t.body, f.folder) > 0
  union all select t.image_path from public.threads t, f where strpos(t.image_path, f.folder) > 0
  union all select r.body from public.replies r, f where strpos(r.body, f.folder) > 0
  union all select m.body from public.lounge_messages m, f where strpos(m.body, f.folder) > 0
  union all select w.body from public.wiki_talk w, f where strpos(w.body, f.folder) > 0
  union all select a.body from public.wiki_articles a, f where strpos(a.body, f.folder) > 0
  union all select a.dek from public.wiki_articles a, f where strpos(a.dek, f.folder) > 0
  union all select a.cover_path from public.wiki_articles a, f where strpos(a.cover_path, f.folder) > 0
  union all select v.body from public.wiki_revisions v, f where strpos(v.body, f.folder) > 0
  union all select p.image_path from public.places p, f where strpos(p.image_path, f.folder) > 0
  union all select s.body from public.society_posts s, f where strpos(s.body, f.folder) > 0
  union all select s.poster_path from public.society_posts s, f where strpos(s.poster_path, f.folder) > 0
  union all select s.description from public.societies s, f where strpos(s.description, f.folder) > 0
  union all select b.description from public.boards b, f where strpos(b.description, f.folder) > 0
  union all select t.description from public.teams t, f where strpos(t.description, f.folder) > 0 and t.owner_id <> p_user
  union all select l.pinned_text from public.lounge_rooms l, f where strpos(l.pinned_text, f.folder) > 0
$$;
revoke execute on function public.media_references(uuid) from public, anon, authenticated;

create or replace function public.unused_media(p_user uuid)
returns setof text language sql stable security definer set search_path = '' as $$
  select o.name from storage.objects o
  where o.bucket_id = 'media' and (storage.foldername(o.name))[1] = p_user::text
    and not exists (select 1 from public.media_references(p_user) ref where strpos(ref, '/media/' || o.name) > 0)
  order by o.name
$$;
revoke execute on function public.unused_media(uuid) from public, anon, authenticated;

-- The caller's own unused uploads, as paths for storage.from('media').remove().
create or replace function public.my_unused_media()
returns setof text language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  return query select public.unused_media(auth.uid());
end $$;
revoke execute on function public.my_unused_media() from public, anon;
grant execute on function public.my_unused_media() to authenticated;

-- ── Delete my account (as in …041, plus the check) ────────────────────────
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  select count(*) into n from public.unused_media(auth.uid());
  if n > 0 then
    raise exception 'Remove your % unused uploaded image% first, then try again.', n, case when n = 1 then '' else 's' end
      using errcode = 'DT409';
  end if;
  -- Leave teams first: tg_team_member_left reopens the roles they filled, which
  -- the cascade can't, because it clears team_roles.filled_by before it runs.
  delete from public.team_members where user_id = auth.uid();
  delete from auth.users where id = auth.uid();
end $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

commit;
