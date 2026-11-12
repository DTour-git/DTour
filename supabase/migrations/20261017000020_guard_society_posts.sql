-- Society posts get the same column guard as threads and replies (issue #49).
--
-- Before this, "edit society posts" let any poster of a society update any of
-- that society's posts, every column included: author_id, rsvp_count, featured,
-- created_at. One PATCH could pin a post on someone else or fake its RSVPs.
--
-- 1. Posters edit only their own posts, and only while they can still post as
--    that society. Nobody else (site moderators included) had edit rights on
--    society posts before, and nobody gets them now. There is still no delete
--    policy, so no client can delete a society post.
-- 2. Client writes can't set counters, attribution or editorial state:
--    rsvp_count is kept by the rsvps trigger (tg_bump), featured and is_demo are
--    set by maintainers in SQL, created_at is server time. On UPDATE the
--    society and author are frozen too.
--
-- As in tg_thread_guard, current_user is 'authenticated' only for direct client
-- writes. SECURITY DEFINER triggers (tg_bump, handle renames) run as their owner
-- and are not affected.

create or replace function public.tg_society_post_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' then
      new.rsvp_count := 0; new.featured := false; new.is_demo := false;
      new.created_at := now();
    else
      new.society_id := old.society_id; new.author_id := old.author_id;
      new.rsvp_count := old.rsvp_count; new.featured := old.featured; new.is_demo := old.is_demo;
      new.created_at := old.created_at;
    end if;
  end if;
  return new;
end $$;

-- Trigger functions are never called directly; firing a trigger doesn't need EXECUTE.
revoke execute on function public.tg_society_post_guard() from public, anon, authenticated;

drop trigger if exists society_post_guard on public.society_posts;
create trigger society_post_guard before insert or update on public.society_posts
  for each row execute function public.tg_society_post_guard();

drop policy if exists "edit society posts" on public.society_posts;
create policy "edit own society posts" on public.society_posts for update to authenticated
  using (author_id = auth.uid() and public.can_post_as(society_id))
  with check (author_id = auth.uid() and public.can_post_as(society_id));
