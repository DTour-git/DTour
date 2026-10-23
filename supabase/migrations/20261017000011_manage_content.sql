-- Managing content after it is posted:
-- 1. Team owners accept or decline join requests.
-- 2. Authors edit and delete their own threads, replies and Lounge messages.
-- 3. Anyone signed in can report content; moderators review reports.
-- Also fixes the column guards so counter triggers can update scores and karma.

-- ── Guards ────────────────────────────────────────────────────────────────
-- The guards used to check current_setting('role'). That setting stays
-- 'authenticated' inside SECURITY DEFINER triggers too, so the guards undid the
-- triggers' own updates to reply counts, scores and karma. current_user is the
-- definer inside those functions, so only direct client writes are guarded now.

alter table public.threads add column edited_at timestamptz;
alter table public.replies add column edited_at timestamptz, add column deleted_at timestamptz;
alter table public.lounge_messages add column edited_at timestamptz;

create or replace function public.tg_profile_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' then
    new.karma := old.karma; new.thread_count := old.thread_count; new.reply_count := old.reply_count;
    new.accepted_count := old.accepted_count; new.upload_count := old.upload_count;
    new.download_count := old.download_count; new.is_demo := old.is_demo; new.created_at := old.created_at;
    new.role := old.role;
  end if;
  return new;
end $$;

create or replace function public.tg_thread_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' then
      new.score := 0; new.reply_count := 0; new.accepted_reply_id := null; new.is_demo := false; new.edited_at := null;
    else
      new.score := old.score; new.reply_count := old.reply_count; new.is_demo := old.is_demo;
      new.accepted_reply_id := old.accepted_reply_id;  -- use accept_reply()
      new.board_id := old.board_id; new.kind := old.kind; new.society_id := old.society_id;
      new.created_at := old.created_at;
      new.updated_at := now();
      new.edited_at := case when new.title is distinct from old.title or new.body is distinct from old.body
                            then now() else old.edited_at end;
    end if;
  end if;
  return new;
end $$;

create or replace function public.tg_reply_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' then
      new.score := 0; new.is_demo := false; new.edited_at := null; new.deleted_at := null;
    else
      if old.deleted_at is not null then raise exception 'This reply was deleted'; end if;
      new.score := old.score; new.is_demo := old.is_demo; new.created_at := old.created_at;
      new.thread_id := old.thread_id; new.parent_id := old.parent_id; new.society_id := old.society_id;
      if new.deleted_at is not null then
        new.deleted_at := now(); new.body := '[deleted]'; new.edited_at := old.edited_at;
      else
        new.edited_at := case when new.body is distinct from old.body then now() else old.edited_at end;
      end if;
    end if;
  end if;
  return new;
end $$;

-- Deleting a thread cascades to its votes. The vote trigger then found no
-- thread and tried to log karma for a null author, which blocked the delete.
-- Karma already earned stays when a post is deleted.
create or replace function public.tg_thread_vote()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  oldv int := case when tg_op in ('UPDATE','DELETE') then old.value else 0 end;
  newv int := case when tg_op in ('INSERT','UPDATE') then new.value else 0 end;
  tid bigint := coalesce(new.thread_id, old.thread_id);
  t record; up_delta int;
begin
  update public.threads set score = score + (newv - oldv) where id = tid returning author_id, board_id into t;
  if t.author_id is null then return null; end if;
  up_delta := (case when newv = 1 then 1 else 0 end) - (case when oldv = 1 then 1 else 0 end);
  if up_delta <> 0 and t.author_id is distinct from coalesce(new.user_id, old.user_id) then
    insert into public.karma_events (user_id, bucket, amount, reason)
    values (t.author_id, public.root_board_name(t.board_id), 10 * up_delta, 'upvote');
  end if;
  return null;
end $$;

-- ── 1. Team requests ──────────────────────────────────────────────────────
-- Accepting adds the student to the team and, if a role is given, fills it.
create or replace function public.review_team_request(p_team bigint, p_user uuid, p_accept boolean, p_role bigint default null)
returns void language plpgsql security definer set search_path = '' as $$
declare t record;
begin
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
grant execute on function public.review_team_request(bigint, uuid, boolean, bigint) to authenticated;

-- A declined or accepted request can't be withdrawn and re-sent to spam the owner.
create or replace function public.toggle_team_request(p_team bigint)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare s text;
begin
  select status into s from public.team_requests where team_id = p_team and user_id = auth.uid();
  if s = 'pending' then
    delete from public.team_requests where team_id = p_team and user_id = auth.uid();
    return false;
  elsif s is not null then
    raise exception 'The team owner already answered this request';
  end if;
  insert into public.team_requests (team_id, user_id) values (p_team, auth.uid());
  return true;
end $$;

-- Requesters may only withdraw pending requests, never mark them accepted themselves.
drop policy if exists "own rows update" on public.team_requests;
drop policy if exists "own rows delete" on public.team_requests;
create policy "own rows delete" on public.team_requests for delete to authenticated
  using (user_id = auth.uid() and status = 'pending');

-- ── 2. Edit and delete ────────────────────────────────────────────────────
-- Replies with answers under them are blanked instead of removed, so the
-- conversation below them survives.
create or replace function public.delete_reply(p_reply bigint)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if exists (select 1 from public.replies where parent_id = p_reply) then
    update public.replies set deleted_at = now() where id = p_reply and author_id = auth.uid() and deleted_at is null;
  else
    delete from public.replies where id = p_reply and author_id = auth.uid();
  end if;
  if not found then raise exception 'You can only delete your own replies'; end if;
end $$;
grant execute on function public.delete_reply(bigint) to authenticated;

create policy "edit own messages" on public.lounge_messages for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());

create or replace function public.tg_lounge_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' and tg_op = 'UPDATE' then
    new.room_slug := old.room_slug; new.society_id := old.society_id; new.created_at := old.created_at;
    new.promoted_thread_id := old.promoted_thread_id; new.is_demo := old.is_demo;
    new.edited_at := case when new.body is distinct from old.body then now() else old.edited_at end;
  elsif current_user = 'authenticated' then
    new.edited_at := null;
  end if;
  return new;
end $$;
create trigger lounge_guard before insert or update on public.lounge_messages
  for each row execute function public.tg_lounge_guard();

-- Realtime sends the whole old row on delete so clients can drop it by id.
alter table public.lounge_messages replica identity full;

-- ── 3. Reports ────────────────────────────────────────────────────────────
create table public.reports (
  id                bigint generated always as identity primary key,
  reporter_id       uuid not null references public.profiles on delete cascade,
  thread_id         bigint references public.threads on delete cascade,
  reply_id          bigint references public.replies on delete cascade,
  lounge_message_id bigint references public.lounge_messages on delete cascade,
  reason            text not null check (reason in ('spam','harassment','misinformation','inappropriate','other')),
  details           text check (char_length(details) <= 500),
  status            text not null default 'open' check (status in ('open','dismissed','removed')),
  reviewed_by       uuid references public.profiles on delete set null,
  reviewed_at       timestamptz,
  created_at        timestamptz not null default now(),
  check (num_nonnulls(thread_id, reply_id, lounge_message_id) = 1)
);
create unique index reports_once_thread on public.reports (reporter_id, thread_id) where thread_id is not null;
create unique index reports_once_reply on public.reports (reporter_id, reply_id) where reply_id is not null;
create unique index reports_once_msg on public.reports (reporter_id, lounge_message_id) where lounge_message_id is not null;
create index on public.reports (status, created_at);

alter table public.reports enable row level security;
grant select, insert on public.reports to authenticated;
create policy "report content" on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and status = 'open' and reviewed_by is null);
create policy "own or mod reads reports" on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_moderator());

-- Moderators dismiss a report, or remove the content (which closes every open
-- report on it, since the rows cascade away with the content).
create or replace function public.resolve_report(p_report bigint, p_remove boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare r record;
begin
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
grant execute on function public.resolve_report(bigint, boolean) to authenticated;
