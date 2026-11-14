-- Column guards for places, library items, wiki articles and teams (issue #27).
--
-- Their insert policies only check who the author is, so every other column
-- came from the client. A new row could arrive with 999999 hearts or downloads,
-- marked "Top rated", pinned to the Today page, or with a moderator as its
-- "checked by". Threads, replies (#71) and society posts (#80) already have
-- guards. This adds the same guard to the rest.
--
-- On a direct client write (current_user = 'authenticated'):
-- * Counters start at their defaults. Only their triggers move them:
--   hearts (tg_bump), downloads (tg_library_download), useful_count
--   (tg_wiki_feedback), talk_count (tg_bump), editor_count (tg_wiki_revision).
-- * Editorial and seed-only fields start empty: home_sort/home_meta (Today
--   picks), recs, top_rated, views_week, urgent, extra_members, is_demo.
--   Maintainers set them in SQL.
-- * Moderation attribution starts empty: checked_by/checked_at and
--   reviewed_by/reviewed_at/review_note/ai_verdict. review_wiki_article sets
--   them as a SECURITY DEFINER function.
-- * created_at (and a wiki article's updated_at) is server time.
-- * A member's place goes after the curated list (sort 50, which is what
--   recommendPlace already sends) and can't jump ahead of it.
--
-- On UPDATE, the same columns plus the author keep their old values. Only
-- teams have a client update policy today ("edit own team"). The others are
-- guarded too, so a later update policy can't reopen this.
--
-- Who can insert, update or delete is unchanged. The author checks
-- (author_id / uploader_id / started_by / owner_id = auth.uid()) stay in RLS.
-- SECURITY DEFINER triggers and RPCs run as their owner, so they are not
-- affected; neither are seed and maintainer SQL.

create or replace function public.tg_place_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' then
      new.hearts := 0; new.recs := 0; new.home_sort := null; new.home_meta := null;
      new.sort := 50; new.is_demo := false; new.created_at := now();
    else
      new.author_id := old.author_id;
      new.hearts := old.hearts; new.recs := old.recs; new.home_sort := old.home_sort; new.home_meta := old.home_meta;
      new.sort := old.sort; new.is_demo := old.is_demo; new.created_at := old.created_at;
    end if;
  end if;
  return new;
end $$;

create or replace function public.tg_library_item_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' then
      new.downloads := 0; new.downloads_week := 0; new.top_rated := false;
      new.is_demo := false; new.created_at := now();
    else
      new.uploader_id := old.uploader_id;
      new.downloads := old.downloads; new.downloads_week := old.downloads_week; new.top_rated := old.top_rated;
      new.is_demo := old.is_demo; new.created_at := old.created_at;
    end if;
  end if;
  return new;
end $$;

create or replace function public.tg_wiki_article_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' then
      new.checked_by := null; new.checked_at := null;
      new.reviewed_by := null; new.reviewed_at := null; new.review_note := null; new.ai_verdict := null;
      new.editor_count := 1; new.useful_count := 0; new.talk_count := 0; new.views_week := 0;
      new.is_demo := false; new.created_at := now(); new.updated_at := now();
    else
      new.started_by := old.started_by; new.status := old.status;
      new.checked_by := old.checked_by; new.checked_at := old.checked_at;
      new.reviewed_by := old.reviewed_by; new.reviewed_at := old.reviewed_at;
      new.review_note := old.review_note; new.ai_verdict := old.ai_verdict;
      new.editor_count := old.editor_count; new.useful_count := old.useful_count;
      new.talk_count := old.talk_count; new.views_week := old.views_week;
      new.is_demo := old.is_demo; new.created_at := old.created_at;
    end if;
  end if;
  return new;
end $$;

create or replace function public.tg_team_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' then
      new.urgent := false; new.extra_members := 0; new.is_demo := false; new.created_at := now();
    else
      new.owner_id := old.owner_id;
      new.urgent := old.urgent; new.extra_members := old.extra_members;
      new.is_demo := old.is_demo; new.created_at := old.created_at;
    end if;
  end if;
  return new;
end $$;

-- Trigger functions are never called directly; firing a trigger doesn't need EXECUTE.
revoke execute on function public.tg_place_guard(), public.tg_library_item_guard(),
  public.tg_wiki_article_guard(), public.tg_team_guard() from public, anon, authenticated;

drop trigger if exists place_guard on public.places;
create trigger place_guard before insert or update on public.places
  for each row execute function public.tg_place_guard();

drop trigger if exists library_item_guard on public.library_items;
create trigger library_item_guard before insert or update on public.library_items
  for each row execute function public.tg_library_item_guard();

drop trigger if exists wiki_article_guard on public.wiki_articles;
create trigger wiki_article_guard before insert or update on public.wiki_articles
  for each row execute function public.tg_wiki_article_guard();

drop trigger if exists team_guard on public.teams;
create trigger team_guard before insert or update on public.teams
  for each row execute function public.tg_team_guard();
