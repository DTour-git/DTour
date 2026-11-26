-- Society management (#62). Until now society_members had no write policies, so
-- membership and posting rights only changed through SQL.
--
-- Decisions agreed for #62:
--   * A society has leads (society_members.is_lead). A lead adds members by handle,
--     edits their role text, toggles can_post, makes other members leads or steps
--     down, and removes members, all for their own society only.
--   * A society always keeps at least one lead: the last lead can't leave or step
--     down. Moderators and admins can always change leads, and the rule doesn't
--     block a society or account being deleted.
--   * Any member can leave a society themselves.
--   * Moderators and admins create societies, assign the first lead, and set or
--     clear verified. New societies start unverified (existing ones keep their value).
--   * Only posters of a verified society pass is_society_poster(), which gates
--     verified-only boards and news. Posting society posts as an unverified
--     society still works (can_post_as is unchanged).
--   * No "request a new society" flow yet.
-- A lead can add any student, as with @mentions; the student can leave at once.
-- authenticated already holds table-level insert/update/delete (…000003); RLS is the gate.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.society_members add column is_lead boolean not null default false;
alter table public.society_members
  add constraint society_members_role_length check (char_length(role) between 1 and 40) not valid;
alter table public.societies alter column verified set default false;

-- ── Helpers ───────────────────────────────────────────────────────────────
create or replace function public.is_society_lead(p_society uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.society_members
                 where society_id = p_society and user_id = auth.uid() and is_lead)
$$;
revoke execute on function public.is_society_lead(uuid) from public, anon;
grant execute on function public.is_society_lead(uuid) to authenticated;

create or replace function public.is_society_poster()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.society_members m join public.societies s on s.id = m.society_id
                 where m.user_id = auth.uid() and m.can_post and s.verified)
$$;

-- ── Societies: moderators create and edit; nobody deletes from the app ────
create policy "moderators add societies" on public.societies for insert to authenticated
  with check (public.is_moderator() and not is_demo);
create policy "moderators edit societies" on public.societies for update to authenticated
  using (public.is_moderator()) with check (public.is_moderator());

-- ── Members ───────────────────────────────────────────────────────────────
create policy "leads add members" on public.society_members for insert to authenticated
  with check (public.is_society_lead(society_id) or public.is_moderator());
create policy "leads edit members" on public.society_members for update to authenticated
  using (public.is_society_lead(society_id) or public.is_moderator())
  with check (public.is_society_lead(society_id) or public.is_moderator());
create policy "leave or remove members" on public.society_members for delete to authenticated
  using (user_id = auth.uid() or public.is_society_lead(society_id) or public.is_moderator());

-- A membership row stays with its society and student.
create or replace function public.tg_society_member_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' then
    new.society_id := old.society_id; new.user_id := old.user_id;
  end if;
  return new;
end $$;
create trigger society_member_guard before update on public.society_members
  for each row execute function public.tg_society_member_guard();

-- The last lead can't leave or step down (moderators can, to hand a society over).
-- Runs as the caller (current_user is 'authenticated' for app writes); everything it reads is public.
create or replace function public.tg_society_keeps_lead()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user <> 'authenticated' or public.is_moderator() or not old.is_lead then return null; end if;
  if tg_op = 'UPDATE' and new.is_lead then return null; end if;
  -- A cascade from deleting the society or the student's account.
  if not exists (select 1 from public.societies where id = old.society_id)
     or not exists (select 1 from public.profiles where id = old.user_id) then return null; end if;
  if not exists (select 1 from public.society_members where society_id = old.society_id and is_lead) then
    raise exception 'A society needs at least one lead. Make someone else a lead first.';
  end if;
  return null;
end $$;
create trigger society_keeps_lead after update of is_lead or delete on public.society_members
  for each row execute function public.tg_society_keeps_lead();

revoke execute on function public.tg_society_member_guard(), public.tg_society_keeps_lead() from public, anon, authenticated;

commit;
