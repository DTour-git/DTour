-- A suspended moderator or admin can't suspend or lift suspensions, and nobody
-- lifts their own suspension (#131, follow-up to #64).
--
-- block_suspended (…044) refuses every write a suspended account makes, but the
-- suspensions log is written only by these two security definer RPCs, which
-- didn't look at the caller's own suspension. So a suspended moderator kept the
-- suspend and lift tools, and a suspended admin could lift their own suspension
-- (lift_suspension only checked the target's role).
--
-- Now both refuse a suspended caller with SQLSTATE DT403 and the same message
-- block_suspended gives, and lift_suspension refuses your own suspension, as
-- suspend_member already refuses suspending yourself. Everything else is as in …044.

create or replace function public.suspend_member(p_handle text, p_reason text, p_days int default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare target record; new_id bigint; msg text;
begin
  if not public.is_moderator() then raise exception 'Only moderators can suspend members' using errcode = '42501'; end if;
  msg := public.suspension_message(auth.uid());
  if msg is not null then raise exception '%', msg using errcode = 'DT403'; end if;
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
declare target record; msg text;
begin
  if not public.is_moderator() then raise exception 'Only moderators can lift suspensions' using errcode = '42501'; end if;
  msg := public.suspension_message(auth.uid());
  if msg is not null then raise exception '%', msg using errcode = 'DT403'; end if;
  select s.user_id, p.role into target from public.suspensions s join public.profiles p on p.id = s.user_id where s.id = p_id;
  if target.user_id = auth.uid() then raise exception 'You can''t lift your own suspension'; end if;
  if target.role in ('moderator', 'admin') and not public.is_admin() then
    raise exception 'Only admins can lift a moderator''s or admin''s suspension';
  end if;
  update public.suspensions set lifted_at = now(), lifted_by = auth.uid()
  where id = p_id and lifted_at is null and (ends_at is null or ends_at > now());
  if not found then raise exception 'This suspension has already ended'; end if;
end $$;

-- create or replace keeps the ACL from …044; restated so this file stands on its own.
revoke execute on function public.suspend_member(text, text, int), public.lift_suspension(bigint) from public, anon;
grant execute on function public.suspend_member(text, text, int), public.lift_suspension(bigint) to authenticated;
