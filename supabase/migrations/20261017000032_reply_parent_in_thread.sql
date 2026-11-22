-- A reply's parent must be an existing reply in the same thread (#58).
--
-- parent_id was only pinned on UPDATE (reply_guard), never checked on INSERT,
-- so a reply could name itself as parent (ids are predictable) or a reply in
-- another thread. getThread() never reaches such a reply, so it was invisible
-- while still counted in reply_count and the board's post_count, and a
-- cross-thread parent sent its author a "replied to you" notification for a
-- thread they weren't in. A new check refuses both. It runs as security
-- definer so it sees every reply, whatever the caller's RLS view.
create or replace function public.tg_reply_parent_in_thread()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.parent_id is not null and not exists (
    select 1 from public.replies p where p.id = new.parent_id and p.thread_id = new.thread_id
  ) then
    raise exception 'You can only reply to a reply in the same thread.' using errcode = 'foreign_key_violation';
  end if;
  return new;
end $$;
revoke execute on function public.tg_reply_parent_in_thread() from public, anon, authenticated;

create trigger reply_parent_in_thread before insert on public.replies
  for each row execute function public.tg_reply_parent_in_thread();
