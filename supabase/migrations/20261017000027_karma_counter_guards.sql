-- Karma and counter fixes from the 31 Oct audit (issues #36, #37, #38, #39).
--
-- #36 poll_options.votes came from the client, so a poll's author could
--     insert options with their result already set. Client writes now start
--     at 0 and keep the option's thread; only tg_bump moves votes.
-- #37 accept_reply let the thread's author accept their own reply for +25
--     karma per thread. It now refuses a reply by the thread's author.
--     Unaccepting (p_reply null) still works, so old self-accepts can be undone.
-- #38 Deleting a thread or reply cascaded to its votes after the row was gone,
--     so tg_thread_vote / tg_reply_vote found no author and the karma stayed:
--     upvote from an alt, delete, repeat. Karma a post earned now goes when the
--     post is deleted: -10 per upvote from someone else, and -25 (plus
--     accepted_count) for the accepted answer. This replaces "karma already
--     earned stays" from 20261017000011. Authors whose profile is being deleted
--     are skipped, since their karma rows go with them.
-- #39 record_download added a row (and bumped three counters) on every call.
--     A download now counts once per member per item. Existing duplicate rows
--     are removed; the counters they already inflated are left as they are,
--     because demo items carry seeded counts with no download rows behind them.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- ── #36 Poll options ──────────────────────────────────────────────────────
create or replace function public.tg_poll_option_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' then
      new.votes := 0;
    else
      new.votes := old.votes; new.thread_id := old.thread_id;
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.tg_poll_option_guard() from public, anon, authenticated;
create trigger poll_option_guard before insert or update on public.poll_options
  for each row execute function public.tg_poll_option_guard();

-- ── #37 No self-accepted answers ──────────────────────────────────────────
create or replace function public.accept_reply(p_thread bigint, p_reply bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.threads where id = p_thread and author_id = auth.uid()) then
    raise exception 'Only the original poster can accept an answer';
  end if;
  if p_reply is not null and not exists (select 1 from public.replies where id = p_reply and thread_id = p_thread) then
    raise exception 'Reply does not belong to this thread';
  end if;
  if p_reply is not null and exists (select 1 from public.replies where id = p_reply and author_id = auth.uid()) then
    raise exception 'You can''t accept your own answer';
  end if;
  update public.threads set accepted_reply_id = p_reply where id = p_thread;
end $$;

-- ── #38 Deleting a post takes back the karma it earned ────────────────────
-- Thread: its own upvotes, plus everything its replies earned (the replies go
-- with it, after the thread row is gone, so the reply trigger can't see it).
create or replace function public.tg_thread_delete_karma()
returns trigger language plpgsql security definer set search_path = '' as $$
declare bucket text := public.root_board_name(old.board_id); a uuid;
begin
  insert into public.karma_events (user_id, bucket, amount, reason)
  select old.author_id, bucket, -10 * count(*), 'upvote removed'
  from public.thread_votes v
  where v.thread_id = old.id and v.value = 1 and v.user_id is distinct from old.author_id
    and exists (select 1 from public.profiles where id = old.author_id)
  having count(*) > 0;

  insert into public.karma_events (user_id, bucket, amount, reason)
  select r.author_id, bucket, -10 * count(*), 'upvote removed'
  from public.replies r join public.reply_votes v on v.reply_id = r.id
  where r.thread_id = old.id and v.value = 1 and v.user_id is distinct from r.author_id
    and exists (select 1 from public.profiles where id = r.author_id)
  group by r.author_id;

  if old.accepted_reply_id is not null then
    select r.author_id into a from public.replies r
    join public.profiles p on p.id = r.author_id
    where r.id = old.accepted_reply_id;
    if a is not null then
      insert into public.karma_events (user_id, bucket, amount, reason) values (a, bucket, -25, 'accepted answer removed');
      update public.profiles set accepted_count = greatest(0, accepted_count - 1) where id = a;
    end if;
  end if;
  return old;
end $$;
revoke execute on function public.tg_thread_delete_karma() from public, anon, authenticated;
create trigger thread_delete_karma before delete on public.threads
  for each row execute function public.tg_thread_delete_karma();

-- Reply deleted on its own (delete_reply removes it when nothing hangs off it).
-- When the whole thread is going, the thread row is already gone here and
-- tg_thread_delete_karma has done the work, so this skips.
create or replace function public.tg_reply_delete_karma()
returns trigger language plpgsql security definer set search_path = '' as $$
declare t record;
begin
  select board_id, accepted_reply_id into t from public.threads where id = old.thread_id;
  if not found or not exists (select 1 from public.profiles where id = old.author_id) then
    return old;
  end if;

  insert into public.karma_events (user_id, bucket, amount, reason)
  select old.author_id, public.root_board_name(t.board_id), -10 * count(*), 'upvote removed'
  from public.reply_votes v
  where v.reply_id = old.id and v.value = 1 and v.user_id is distinct from old.author_id
  having count(*) > 0;

  -- The FK then sets accepted_reply_id to null, but tg_thread_accepted can no
  -- longer find this reply's author, so the -25 happens here.
  if t.accepted_reply_id = old.id then
    insert into public.karma_events (user_id, bucket, amount, reason)
    values (old.author_id, public.root_board_name(t.board_id), -25, 'accepted answer removed');
    update public.profiles set accepted_count = greatest(0, accepted_count - 1) where id = old.author_id;
  end if;
  return old;
end $$;
revoke execute on function public.tg_reply_delete_karma() from public, anon, authenticated;
create trigger reply_delete_karma before delete on public.replies
  for each row execute function public.tg_reply_delete_karma();

-- ── #39 One counted download per member per item ──────────────────────────
lock table public.library_downloads in share row exclusive mode;
delete from public.library_downloads d
using public.library_downloads keep
where keep.item_id = d.item_id and keep.user_id = d.user_id and keep.id < d.id;
alter table public.library_downloads
  add constraint library_downloads_once unique (item_id, user_id);

create or replace function public.record_download(p_item bigint)
returns text language plpgsql security definer set search_path = '' as $$
declare path text;
begin
  if auth.uid() is null then raise exception 'Sign in to download'; end if;
  insert into public.library_downloads (item_id, user_id) values (p_item, auth.uid())
    on conflict (item_id, user_id) do nothing;
  select storage_path into path from public.library_items where id = p_item;
  return path;
end $$;

commit;
