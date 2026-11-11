-- Team Up membership needs the student's own request (#50, #51, #54).
-- 1. Requests start pending and can't be moved to another student or team.
-- 2. The owner can only add themselves directly; everyone else joins through
--    review_team_request, which needs that student's own pending request.
-- 3. Members can leave and owners can remove members.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

lock table public.team_requests, public.team_members in share row exclusive mode;

-- ── 1. Requests ───────────────────────────────────────────────────────────
-- A new request is always pending, so the owner sees it in their queue.
drop policy if exists "own rows insert" on public.team_requests;
create policy "own rows insert" on public.team_requests for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');

-- The owner's update policy checked only the old row, so the row could be
-- rewritten to any team or student. The guard below pins those columns.
drop policy if exists "owner reviews requests" on public.team_requests;
create policy "owner reviews requests" on public.team_requests for update to authenticated
  using (exists (select 1 from public.teams t where t.id = team_id and t.owner_id = auth.uid()))
  with check (exists (select 1 from public.teams t where t.id = team_id and t.owner_id = auth.uid()));

-- Reviewing a request changes only its status.
create or replace function public.tg_team_request_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (to_jsonb(new) - 'status') is distinct from (to_jsonb(old) - 'status') then
    raise exception 'A team request can only change its status'
      using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function public.tg_team_request_guard() from public, anon, authenticated;

drop trigger if exists team_request_guard on public.team_requests;
create trigger team_request_guard before update on public.team_requests
  for each row execute function public.tg_team_request_guard();

-- ── 2. Joining ────────────────────────────────────────────────────────────
-- Remove memberships an owner added without the student's accepted request,
-- along with the "Joined team" activity they put on that student's profile.
-- Demo teams are seeded without requests, so they are left alone.
create temporary table forged_members on commit drop as
  select m.team_id, m.user_id, t.title
  from public.team_members m
  join public.teams t on t.id = m.team_id
  where not t.is_demo
    and m.user_id <> t.owner_id
    and not exists (select 1 from public.team_requests r
                    where r.team_id = m.team_id and r.user_id = m.user_id and r.status = 'accepted');

delete from public.team_members m
using forged_members f
where m.team_id = f.team_id and m.user_id = f.user_id;

delete from public.activities a
using forged_members f
where a.user_id = f.user_id and a.kind = 'team' and a.kicker = 'Joined team · Team Up' and a.title = f.title
  and not exists (select 1 from public.team_members m join public.teams t on t.id = m.team_id
                  where m.user_id = f.user_id and t.title = f.title);

-- Owners still add themselves when they post a team (createTeam).
-- Other students join only through review_team_request (security definer).
drop policy if exists "team members by owner" on public.team_members;
create policy "owner joins own team" on public.team_members for insert to authenticated
  with check (user_id = auth.uid()
              and exists (select 1 from public.teams t where t.id = team_id and t.owner_id = auth.uid()));

-- ── 3. Leaving ────────────────────────────────────────────────────────────
create policy "members leave or are removed" on public.team_members for delete to authenticated
  using (user_id = auth.uid()
         or exists (select 1 from public.teams t where t.id = team_id and t.owner_id = auth.uid()));

-- After leaving, the old accepted request would still say "You're in" and the
-- student's role would still look filled. Clear both so the team page is right
-- and the student can ask again (the owner has to accept them again).
create or replace function public.tg_team_member_left()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.team_requests
  where team_id = old.team_id and user_id = old.user_id and status = 'accepted';
  update public.team_roles set filled = false, filled_by = null
  where team_id = old.team_id and filled_by = old.user_id;
  return null;
end $$;
revoke all on function public.tg_team_member_left() from public, anon, authenticated;

drop trigger if exists team_member_left on public.team_members;
create trigger team_member_left after delete on public.team_members
  for each row execute function public.tg_team_member_left();

commit;
