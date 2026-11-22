-- Who's online is private to signed-in students (#41).
--
-- Every web tab and app joined the public Realtime channel presence:dtour and
-- tracked {id, handle, board}, so anyone with the publishable key could see
-- who was online and which board each person was reading, and publish fake
-- entries. The apps now track names on a *private* presence:dtour channel,
-- which Realtime only lets a client join when these policies allow it: signed-in
-- students can read and track presence there; visitors can't join at all.
--
-- Visitors still see a count: each student also leaves an anonymous entry
-- (just the board slug, no id or handle) on the public presence:dtour:count
-- channel. That channel stays public on purpose and needs no policy.
--
-- Realtime can't check what a client puts in its presence payload, so a
-- signed-in student could still claim another student's handle there. That's
-- limited to signed-in DTU accounts now, not anyone on the internet.
drop policy if exists "students see who's online" on realtime.messages;
create policy "students see who's online" on realtime.messages for select to authenticated
  using (realtime.topic() = 'presence:dtour' and extension = 'presence');

drop policy if exists "students say they're online" on realtime.messages;
create policy "students say they're online" on realtime.messages for insert to authenticated
  with check (realtime.topic() = 'presence:dtour' and extension = 'presence');
