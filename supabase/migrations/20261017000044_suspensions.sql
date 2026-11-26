-- Moderators can suspend a member from writing (#64), for 1, 7 or 30 days or
-- indefinitely, with a reason. This is the agreed exception to "anything that
-- writes needs a signed-in DTU account": the account must also not be suspended.
--
-- Decisions agreed for #64:
--   * Moderators suspend members; only admins suspend moderators or admins.
--   * A suspended member still reads, and keeps private housekeeping: marking
--     notifications read, saves, drafts, push tokens, the boards "last seen"
--     time, leaving a team or society, deleting their own posts, downloading,
--     exporting their data and deleting their account.
--   * Everything else that writes is refused with the reason and end date:
--     posting, replying, voting, RSVPs, the Lounge, uploads, team requests,
--     wiki edits and talk, places, profile edits and reports.
--   * A suspension lifts by itself at ends_at (no cron); moderators can lift it
--     early. The suspensions table is the log: who, whom, why, when, and who
--     lifted it. Moderators and the suspended member can read it; it's not public.
--
-- Enforcement is a BEFORE INSERT OR UPDATE trigger on every table a member writes,
-- so it also covers security definer RPCs, which skip RLS. It only acts on the
-- statement the member ran (pg_trigger_depth() = 1): counters and cascades that
-- other triggers write still go through. Uploads get a restrictive storage policy.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table public.suspensions (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles on delete cascade,
  reason     text not null check (char_length(reason) between 3 and 500),
  ends_at    timestamptz,                       -- null: until a moderator lifts it
  created_by uuid references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  lifted_at  timestamptz,
  lifted_by  uuid references public.profiles on delete set null
);
create index on public.suspensions (user_id) where lifted_at is null;
create index on public.suspensions (created_at desc);
alter table public.suspensions enable row level security;
create policy "own or moderators read" on public.suspensions for select to authenticated
  using (user_id = auth.uid() or public.is_moderator());
revoke all on public.suspensions from anon;
revoke insert, update, delete on public.suspensions from authenticated;
grant select on public.suspensions to authenticated;

-- ── The active suspension, as the message the member sees ─────────────────
-- "You’re suspended from writing until 2 Dec, 2:30 pm IST. Reason: spam" (same
-- wording as suspensionText() in packages/shared/src/format.ts).
create or replace function public.suspension_message(p_user uuid)
returns text language sql stable security definer set search_path = '' as $$
  select 'You’re suspended from writing'
    || coalesce(' until ' || to_char(s.ends_at at time zone 'Asia/Kolkata', 'FMDD Mon, FMHH12:MI am') || ' IST', '')
    || '. Reason: ' || s.reason
  from public.suspensions s
  where s.user_id = p_user and s.lifted_at is null and (s.ends_at is null or s.ends_at > now())
  order by s.created_at desc limit 1
$$;
revoke execute on function public.suspension_message(uuid) from public, anon, authenticated;

create or replace function public.tg_block_suspended()
returns trigger language plpgsql security definer set search_path = '' as $$
declare msg text;
begin
  if auth.uid() is null or pg_trigger_depth() > 1 then return new; end if;
  -- Housekeeping that goes through a blocked table.
  if tg_op = 'UPDATE' and tg_table_name = 'replies' then
    if old.deleted_at is null and new.deleted_at is not null then return new; end if; -- delete_reply blanks it
  end if;
  if tg_op = 'UPDATE' and tg_table_name = 'profiles' then
    if to_jsonb(new) - 'boards_seen_at' = to_jsonb(old) - 'boards_seen_at' then return new; end if;
  end if;
  msg := public.suspension_message(auth.uid());
  if msg is not null then
    raise exception '%', msg using errcode = 'DT403';
  end if;
  return new;
end $$;
revoke execute on function public.tg_block_suspended() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'threads','replies','poll_options','poll_votes','thread_votes','reply_votes','rsvps','place_hearts',
    'wiki_feedback','wiki_articles','wiki_revisions','wiki_talk','team_requests','team_members','team_roles',
    'teams','places','library_items','lounge_messages','society_posts','society_members','societies',
    'reports','profiles','campus_events','deadlines','exam_windows','lounge_rooms'] loop
    execute format('create trigger block_suspended before insert or update on public.%I
      for each row execute function public.tg_block_suspended()', t);
  end loop;
end $$;

-- Only about yourself: suspension_message(uuid) stays internal, so nobody reads another member's reason.
create or replace function public.am_suspended()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.suspension_message(auth.uid()) is not null
$$;
revoke execute on function public.am_suspended() from public, anon;
grant execute on function public.am_suspended() to authenticated;

create policy "suspended members cannot upload" on storage.objects as restrictive for insert to authenticated
  with check (not public.am_suspended());

-- ── Suspend and lift (moderators; only admins for moderators and admins) ──
create or replace function public.suspend_member(p_handle text, p_reason text, p_days int default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare target record; new_id bigint;
begin
  if not public.is_moderator() then raise exception 'Only moderators can suspend members' using errcode = '42501'; end if;
  if p_days is not null and p_days not in (1, 7, 30) then raise exception 'Suspend for 1, 7 or 30 days, or indefinitely'; end if;
  select id, role into target from public.profiles where handle = lower(trim(leading '@' from trim(p_handle)));
  if not found then raise exception 'No one has the handle @%', lower(trim(leading '@' from trim(p_handle))); end if;
  if target.id = auth.uid() then raise exception 'You can''t suspend yourself'; end if;
  if target.role in ('moderator', 'admin') and not public.is_admin() then
    raise exception 'Only admins can suspend moderators and admins';
  end if;
  -- A new suspension replaces the current one, so the end date is always the latest decision.
  update public.suspensions set lifted_at = now(), lifted_by = auth.uid()
  where user_id = target.id and lifted_at is null and (ends_at is null or ends_at > now());
  insert into public.suspensions (user_id, reason, ends_at, created_by)
  values (target.id, trim(p_reason), case when p_days is null then null else now() + make_interval(days => p_days) end, auth.uid())
  returning id into new_id;
  return new_id;
end $$;

create or replace function public.lift_suspension(p_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare target_role text;
begin
  if not public.is_moderator() then raise exception 'Only moderators can lift suspensions' using errcode = '42501'; end if;
  select p.role into target_role from public.suspensions s join public.profiles p on p.id = s.user_id where s.id = p_id;
  if target_role in ('moderator', 'admin') and not public.is_admin() then
    raise exception 'Only admins can lift a moderator''s or admin''s suspension';
  end if;
  update public.suspensions set lifted_at = now(), lifted_by = auth.uid()
  where id = p_id and lifted_at is null and (ends_at is null or ends_at > now());
  if not found then raise exception 'This suspension has already ended'; end if;
end $$;

revoke execute on function public.suspend_member(text, text, int), public.lift_suspension(bigint) from public, anon;
grant execute on function public.suspend_member(text, text, int), public.lift_suspension(bigint) to authenticated;

commit;
