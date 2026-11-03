-- Suspension details are private; members only receive the reason if the
-- moderator explicitly chooses to share it.
create table public.member_suspensions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  reason text not null check (length(btrim(reason)) between 1 and 1000),
  share_reason boolean not null default false,
  ends_at timestamptz,
  suspended_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create table public.suspension_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id),
  actor_id uuid not null references public.profiles(id),
  action text not null check (action in ('suspend', 'unsuspend')),
  reason text not null check (length(btrim(reason)) between 1 and 1000),
  share_reason boolean not null default false,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.member_suspensions enable row level security;
alter table public.suspension_events enable row level security;
revoke all on public.member_suspensions, public.suspension_events from public, anon, authenticated;
grant select on public.member_suspensions, public.suspension_events to authenticated;
create policy "moderators read suspensions" on public.member_suspensions for select to authenticated using (public.is_moderator());
create policy "moderators read suspension history" on public.suspension_events for select to authenticated using (public.is_moderator());

create function public.can_write() returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and not exists (
    select 1 from public.member_suspensions s
    where s.user_id = auth.uid() and (s.ends_at is null or s.ends_at > now())
  )
$$;
revoke all on function public.can_write() from public, anon;
grant execute on function public.can_write() to authenticated;

create function public.my_suspension() returns table (ends_at timestamptz, reason text)
language sql stable security definer set search_path = '' as $$
  select s.ends_at, case when s.share_reason then s.reason else null end
  from public.member_suspensions s where s.user_id = auth.uid()
    and (s.ends_at is null or s.ends_at > now())
$$;
revoke all on function public.my_suspension() from public, anon;
grant execute on function public.my_suspension() to authenticated;

create function public.set_member_suspension(p_user uuid, p_reason text, p_ends_at timestamptz, p_share_reason boolean, p_suspend boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare actor_role text; target_role text;
begin
  select role into actor_role from public.profiles where id = auth.uid();
  select role into target_role from public.profiles where id = p_user for update;
  if actor_role not in ('moderator', 'admin') or actor_role is null or not public.can_write() then raise exception 'Moderators only'; end if;
  if target_role is null then raise exception 'Member not found'; end if;
  if p_user = auth.uid() then raise exception 'You cannot suspend yourself'; end if;
  if target_role in ('moderator', 'admin') and actor_role <> 'admin' then raise exception 'Only admins can suspend moderators or admins'; end if;
  if p_reason is null or length(btrim(p_reason)) not between 1 and 1000 then raise exception 'A reason is required (up to 1000 characters)'; end if;
  if p_suspend then
    if p_ends_at is not null and p_ends_at <= now() then raise exception 'End date must be in the future'; end if;
    insert into public.member_suspensions (user_id, reason, share_reason, ends_at, suspended_by)
    values (p_user, btrim(p_reason), coalesce(p_share_reason, false), p_ends_at, auth.uid())
    on conflict (user_id) do update set reason = excluded.reason, share_reason = excluded.share_reason,
      ends_at = excluded.ends_at, suspended_by = excluded.suspended_by, created_at = now();
  else
    delete from public.member_suspensions where user_id = p_user and (ends_at is null or ends_at > now());
    if not found then raise exception 'This member is not suspended'; end if;
  end if;
  insert into public.suspension_events (user_id, actor_id, action, reason, share_reason, ends_at)
  values (p_user, auth.uid(), case when p_suspend then 'suspend' else 'unsuspend' end,
    btrim(p_reason), coalesce(p_share_reason, false), case when p_suspend then p_ends_at else null end);
end $$;
revoke all on function public.set_member_suspension(uuid, text, timestamptz, boolean, boolean) from public, anon;
grant execute on function public.set_member_suspension(uuid, text, timestamptz, boolean, boolean) to authenticated;

create function public.suspension_history()
returns table (id bigint, user_id uuid, handle text, actor_handle text, action text, reason text, share_reason boolean, ends_at timestamptz, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select e.id, e.user_id, p.handle, a.handle, e.action, e.reason, e.share_reason, e.ends_at, e.created_at
  from public.suspension_events e join public.profiles p on p.id = e.user_id
    join public.profiles a on a.id = e.actor_id
  where public.is_moderator() order by e.created_at desc limit 200
$$;
revoke all on function public.suspension_history() from public, anon;
grant execute on function public.suspension_history() to authenticated;

-- Restrictive policies combine with every existing permissive write policy.
-- Keep passive notification and device-token housekeeping working.
do $$
declare t record; op text;
begin
  for t in select distinct tablename from pg_policies where schemaname = 'public'
    and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
    and tablename not in ('notifications', 'device_push_tokens') loop
    foreach op in array array['INSERT', 'UPDATE', 'DELETE'] loop
      if op = 'INSERT' then
        execute format('create policy suspension_insert on public.%I as restrictive for insert to authenticated with check (public.can_write())', t.tablename);
      elsif op = 'UPDATE' then
        execute format('create policy suspension_update on public.%I as restrictive for update to authenticated using (public.can_write()) with check (public.can_write())', t.tablename);
      else
        execute format('create policy suspension_delete on public.%I as restrictive for delete to authenticated using (public.can_write())', t.tablename);
      end if;
    end loop;
  end loop;
end $$;
create policy suspension_insert on storage.objects as restrictive for insert to authenticated with check (public.can_write());
create policy suspension_update on storage.objects as restrictive for update to authenticated using (public.can_write()) with check (public.can_write());
create policy suspension_delete on storage.objects as restrictive for delete to authenticated using (public.can_write());

-- Security-definer RPCs bypass RLS and must check the caller explicitly.
create or replace function public.accept_reply(p_thread bigint, p_reply bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_write() then raise exception 'Your account is suspended from writing'; end if;
  if not exists (select 1 from public.threads where id = p_thread and author_id = auth.uid()) then
    raise exception 'Only the original poster can accept an answer';
  end if;
  if p_reply is not null and not exists (select 1 from public.replies where id = p_reply and thread_id = p_thread) then
    raise exception 'Reply does not belong to this thread';
  end if;
  update public.threads set accepted_reply_id = p_reply where id = p_thread;
end $$;

create or replace function public.review_wiki_revision(p_revision bigint, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_write() then raise exception 'Your account is suspended from writing'; end if;
  if not public.is_moderator() then raise exception 'Only moderators can review edits'; end if;
  update public.wiki_revisions set status = case when p_approve then 'published' else 'rejected' end,
    reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_note
  where id = p_revision and status = 'suggested';
end $$;

create or replace function public.review_wiki_article(p_article bigint, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_write() then raise exception 'Your account is suspended from writing'; end if;
  if not public.is_moderator() then raise exception 'Only moderators can review articles'; end if;
  update public.wiki_articles set status = case when p_approve then 'published' else 'rejected' end,
    reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_note
  where id = p_article and status = 'pending';
  if p_approve then
    update public.wiki_revisions set status = 'published', reviewed_by = auth.uid(), reviewed_at = now()
    where article_id = p_article and status = 'suggested';
  end if;
end $$;

create or replace function public.review_team_request(p_team bigint, p_user uuid, p_accept boolean, p_role bigint default null)
returns void language plpgsql security definer set search_path = '' as $$
declare t record;
begin
  if not public.can_write() then raise exception 'Your account is suspended from writing'; end if;
  select id, owner_id, title into t from public.teams where id = p_team;
  if t is null then raise exception 'Team not found'; end if;
  if t.owner_id is distinct from auth.uid() then raise exception 'Only the team owner can review requests'; end if;
  update public.team_requests set status = case when p_accept then 'accepted' else 'declined' end
  where team_id = p_team and user_id = p_user and status = 'pending';
  if not found then raise exception 'No pending request from this student'; end if;
  if p_accept then
    insert into public.team_members (team_id, user_id) values (p_team, p_user) on conflict do nothing;
    if p_role is not null then
      update public.team_roles set filled = true, filled_by = p_user
      where id = p_role and team_id = p_team and not filled;
    end if;
  end if;
  perform public.notify(p_user, 'team_request', auth.uid(),
    case when p_accept then 'accepted you into “' || t.title || '”' else 'didn’t accept your request to join “' || t.title || '”' end,
    '/teams', null, null, null, null, p_team);
end $$;

create or replace function public.resolve_report(p_report bigint, p_remove boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  if not public.can_write() then raise exception 'Your account is suspended from writing'; end if;
  if not public.is_moderator() then raise exception 'Moderators only'; end if;
  select * into r from public.reports where id = p_report;
  if r is null then raise exception 'Report not found'; end if;
  if not p_remove then
    update public.reports set status = 'dismissed', reviewed_by = auth.uid(), reviewed_at = now()
    where status = 'open' and thread_id is not distinct from r.thread_id
      and reply_id is not distinct from r.reply_id and lounge_message_id is not distinct from r.lounge_message_id;
    return;
  end if;
  if r.thread_id is not null then
    delete from public.threads where id = r.thread_id;
  elsif r.reply_id is not null then
    if exists (select 1 from public.replies where parent_id = r.reply_id) then
      update public.replies set body = '[removed by a moderator]', deleted_at = now() where id = r.reply_id;
      update public.reports set status = 'removed', reviewed_by = auth.uid(), reviewed_at = now()
      where reply_id = r.reply_id and status = 'open';
    else
      delete from public.replies where id = r.reply_id;
    end if;
  else
    delete from public.lounge_messages where id = r.lounge_message_id;
  end if;
end $$;

create or replace function public.promote_lounge_message(p_message bigint, p_board uuid, p_title text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare msg record; b record; tid bigint; t text := btrim(p_title);
begin
  if not public.can_write() then raise exception 'Your account is suspended from writing'; end if;
  select * into msg from public.lounge_messages where id = p_message;
  if msg is null then raise exception 'Message not found'; end if;
  if msg.author_id is distinct from auth.uid() then raise exception 'Only the author can turn a message into a thread'; end if;
  if msg.promoted_thread_id is not null then raise exception 'This message is already a thread'; end if;
  if char_length(t) not between 3 and 140 then raise exception 'Titles are 3–140 characters'; end if;
  select id, verified_only, link_screen into b from public.boards where id = p_board;
  if b is null or b.link_screen is not null then raise exception 'Pick a board to post in'; end if;
  if b.verified_only and not public.is_society_poster() then raise exception 'Only verified accounts can post in that board'; end if;
  insert into public.threads (board_id, author_id, title, body, from_lounge_message_id)
  values (p_board, msg.author_id, t, msg.body, msg.id) returning id into tid;
  update public.lounge_messages set promoted_thread_id = tid where id = p_message;
  return tid;
end $$;
