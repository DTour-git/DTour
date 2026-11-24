-- Campus admin (#61): moderators and admins manage the content behind Today, the exam
-- countdown, Team Up deadlines and the Lounge from the app instead of SQL.
--   campus_events, exam_windows, deadlines: moderators and admins (create, edit, delete)
--   lounge_rooms: admins only (create, edit). Nobody deletes a room from the app, because
--   lounge_messages.room_slug cascades and a delete would wipe that room's chat.
-- Everyone else stays read-only through the existing "public read" policies.
-- authenticated already holds table-level insert/update/delete (…000003); RLS is the gate.

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- New rows are real content: only seed.sql (run as postgres) creates is_demo rows, so
-- dtour_clear_demo() never removes what a moderator added.
create policy "moderators add events" on public.campus_events for insert to authenticated
  with check (public.is_moderator() and not is_demo);
create policy "moderators edit events" on public.campus_events for update to authenticated
  using (public.is_moderator()) with check (public.is_moderator());
create policy "moderators delete events" on public.campus_events for delete to authenticated
  using (public.is_moderator());

create policy "moderators add deadlines" on public.deadlines for insert to authenticated
  with check (public.is_moderator() and not is_demo);
create policy "moderators edit deadlines" on public.deadlines for update to authenticated
  using (public.is_moderator()) with check (public.is_moderator());
create policy "moderators delete deadlines" on public.deadlines for delete to authenticated
  using (public.is_moderator());

create policy "moderators add exam windows" on public.exam_windows for insert to authenticated
  with check (public.is_moderator());
create policy "moderators edit exam windows" on public.exam_windows for update to authenticated
  using (public.is_moderator()) with check (public.is_moderator());
create policy "moderators delete exam windows" on public.exam_windows for delete to authenticated
  using (public.is_moderator());

create policy "admins add lounge rooms" on public.lounge_rooms for insert to authenticated
  with check (public.is_admin());
create policy "admins edit lounge rooms" on public.lounge_rooms for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke delete on public.lounge_rooms from authenticated;
