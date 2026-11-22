-- One account can no longer flood another's notifications (#52).
--
-- 1. Grouped upvotes counted upvote events, not people: removing an upvote and
--    adding it again (set_thread_vote 1 -> 0 -> 1) bumped "and N others
--    upvoted" each time. Each grouped notification now remembers who it has
--    counted, and an upvote from someone already counted changes nothing.
--    The list lives in a private table, not on the notification, so authors
--    still see only the latest upvoter, as before, not everyone who voted.
-- 2. Withdrawing and re-sending a team request (toggle_team_request) notified
--    the owner on every insert. A request now notifies the owner only if that
--    student has no unread request notification for the team and none from
--    the last 24 hours. The request itself still shows in the owner's list.

create table public.notification_upvoters (
  notification_id bigint not null references public.notifications on delete cascade,
  actor_id uuid not null references public.profiles on delete cascade,
  primary key (notification_id, actor_id)
);
alter table public.notification_upvoters enable row level security; -- no policies: only notify_upvote() uses it
revoke all on public.notification_upvoters from public, anon, authenticated;

create or replace function public.notify_upvote(p_owner uuid, p_actor uuid, p_thread bigint, p_reply bigint, p_title text)
returns void language plpgsql security definer set search_path = '' as $$
declare existing record;
begin
  if p_owner is null or p_owner = p_actor then return; end if;
  select id, actor_id into existing from public.notifications
  where user_id = p_owner and kind = 'upvote' and read_at is null
    and thread_id is not distinct from p_thread and reply_id is not distinct from p_reply;
  if existing.id is not null then
    -- Notifications grouped before this migration only know their latest upvoter.
    if existing.actor_id is not null then
      insert into public.notification_upvoters values (existing.id, existing.actor_id) on conflict do nothing;
    end if;
    insert into public.notification_upvoters values (existing.id, p_actor) on conflict do nothing;
    if not found then return; end if; -- already counted
    update public.notifications set count = count + 1, actor_id = p_actor, created_at = now(),
      text = 'and ' || count || ' other' || case when count = 1 then '' else 's' end || ' upvoted ' || p_title
    where id = existing.id;
  else
    perform public.notify(p_owner, 'upvote', p_actor, 'upvoted ' || p_title, '/t/' || p_thread, null, p_thread, p_reply);
  end if;
end $$;
revoke execute on function public.notify_upvote(uuid, uuid, bigint, bigint, text) from anon, authenticated, public;

create or replace function public.tg_notify_team_request()
returns trigger language plpgsql security definer set search_path = '' as $$
declare t record;
begin
  select id, owner_id, title into t from public.teams where id = new.team_id;
  if exists (
    select 1 from public.notifications
    where user_id = t.owner_id and kind = 'team_request' and team_id = t.id and actor_id = new.user_id
      and (read_at is null or created_at > now() - interval '24 hours')
  ) then
    return null;
  end if;
  perform public.notify(t.owner_id, 'team_request', new.user_id, 'asked to join “' || t.title || '”', '/teams', null, null, null, null, t.id);
  return null;
end $$;
revoke execute on function public.tg_notify_team_request() from anon, authenticated, public;
