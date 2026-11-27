-- A suspended member can't delete other people's rows (#128, follow-up to #64).
--
-- block_suspended (…044) covers inserts and updates only. Deletes were left open
-- so a suspended member can always delete their own posts and leave a team or
-- society. That also let a suspended society lead or team owner remove other
-- members, and a suspended moderator remove other people's content, by calling
-- the API directly.
--
-- Agreed rule: while suspended you may still delete your own rows (posts,
-- uploads, places, wiki talk, your team, your membership, your account), but
-- not rows that belong to someone else:
--   * removing a member from a society or a team
--   * deleting a role from your team (adding and editing roles is already refused)
--   * as a moderator: removing reported content (resolve_report), other people's
--     places and wiki talk, and campus events, deadlines and exam windows
--
-- Same pattern as block_suspended: a trigger, so it also covers security definer
-- RPCs such as resolve_report, and only on the statement the member ran
-- (pg_trigger_depth() = 1), so cascades still go through: deleting your own team
-- removes its members and roles, leaving a team frees your role, deleting your
-- account removes everything it owns.
--
-- The trigger's argument names the column that says whose row it is. With no
-- argument the row is never the member's own (roles, campus admin tables).

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create or replace function public.tg_block_suspended_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
declare msg text;
begin
  if auth.uid() is null or pg_trigger_depth() > 1 then return old; end if;
  if tg_nargs > 0 and (to_jsonb(old) ->> tg_argv[0]) = auth.uid()::text then return old; end if;
  msg := public.suspension_message(auth.uid());
  if msg is not null then
    raise exception '%', msg using errcode = 'DT403';
  end if;
  return old;
end $$;
revoke execute on function public.tg_block_suspended_delete() from public, anon, authenticated;

do $$
declare t text[];
begin
  foreach t slice 1 in array array[
    array['society_members', 'user_id'], array['team_members', 'user_id'],
    array['teams', 'owner_id'], array['library_items', 'uploader_id'],
    array['threads', 'author_id'], array['replies', 'author_id'], array['lounge_messages', 'author_id'],
    array['places', 'author_id'], array['wiki_talk', 'author_id']] loop
    execute format('create trigger block_suspended_delete before delete on public.%I
      for each row execute function public.tg_block_suspended_delete(%L)', t[1], t[2]);
  end loop;
end $$;

do $$
declare t text;
begin
  foreach t in array array['team_roles', 'campus_events', 'deadlines', 'exam_windows'] loop
    execute format('create trigger block_suspended_delete before delete on public.%I
      for each row execute function public.tg_block_suspended_delete()', t);
  end loop;
end $$;

commit;
