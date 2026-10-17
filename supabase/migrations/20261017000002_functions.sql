-- Triggers, counters, auth hooks and RPCs.

-- ── Auth: DTU-only sign-up ────────────────────────────────────────────────
-- Called by Supabase Auth before any user row is created (Google or email OTP).
create or replace function public.hook_before_user_created(event jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  email  text := lower(coalesce(event->'user'->>'email', ''));
  domain text := split_part(email, '@', 2);
begin
  if domain <> '' and exists (select 1 from public.allowed_email_domains d where d.domain = domain) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'DTour is only for DTU students — sign in with your @dtu.ac.in email.'));
end $$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_before_user_created(jsonb) from authenticated, anon, public;
grant select on public.allowed_email_domains to supabase_auth_admin;

-- Defence in depth: the same rule as a trigger, so users created any other way
-- (admin API, dashboard) are checked too. Seed rows carry app metadata
-- {"dtour_seed": true}, which only the service role can set.
create or replace function public.enforce_email_domain()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(new.raw_app_meta_data ? 'dtour_seed', false) then return new; end if;
  if new.email is null or not exists (
    select 1 from public.allowed_email_domains d where d.domain = lower(split_part(new.email, '@', 2))
  ) then
    raise exception 'DTour is only for DTU students — sign in with your @dtu.ac.in email.'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger enforce_email_domain before insert or update of email on auth.users
  for each row execute function public.enforce_email_domain();

-- Bootstrap a profile. DTU addresses usually look like name_2k23co123@dtu.ac.in,
-- so we pre-fill branch, batch and semester; onboarding lets the student fix them.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  local_part text := lower(split_part(new.email, '@', 1));
  base   text;
  candidate text;
  n      int := 0;
  m      text[];
  entry  int;
  br     text;
  sem    int;
  now_ist timestamp := (now() at time zone 'Asia/Kolkata');
begin
  if coalesce(new.raw_app_meta_data ? 'dtour_seed', false) then return new; end if;

  base := regexp_replace(split_part(local_part, '_2k', 1), '[^a-z0-9._]', '', 'g');
  base := regexp_replace(base, '^[^a-z0-9]+', '');
  if char_length(base) < 3 then base := base || 'dtu'; end if;
  base := left(base, 20);
  candidate := base;
  while exists (select 1 from public.profiles p where p.handle = candidate) loop
    n := n + 1;
    candidate := left(base, 20) || n::text;
  end loop;

  m := regexp_match(local_part, '2k(\d{2})([a-z]{2,3})\d+');
  if m is not null then
    entry := 2000 + m[1]::int;
    select b.code into br from public.branches b where b.roll_code = m[2];
    sem := (extract(year from now_ist)::int - entry) * 2
           + case when extract(month from now_ist) >= 7 then 1 else 0 end;
    sem := greatest(1, least(8, sem));
  end if;

  insert into public.profiles (id, handle, display_name, branch_code, grad_year, semester, tint)
  values (
    new.id, candidate,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    br, case when entry is not null then entry + 4 end, sem,
    (array['accent','accent2','neutral','accent-light'])[1 + abs(hashtext(new.id::text)) % 4]
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Helpers ───────────────────────────────────────────────────────────────
-- Top-level board name for a board (karma buckets: "Academics", "Placements"…)
create or replace function public.root_board_name(p_board uuid)
returns text language sql stable set search_path = '' as $$
  with recursive up as (
    select id, parent_id, name from public.boards where id = p_board
    union all
    select b.id, b.parent_id, b.name from public.boards b join up on b.id = up.parent_id
  ) select name from up where parent_id is null limit 1
$$;

create or replace function public.board_path(p_board uuid)
returns text language sql stable set search_path = '' as $$
  with recursive up as (
    select id, parent_id, slug, 0 as depth from public.boards where id = p_board
    union all
    select b.id, b.parent_id, b.slug, up.depth + 1 from public.boards b join up on b.id = up.parent_id
  ) select slug from up order by depth limit 1
$$;

-- ── Counter triggers ──────────────────────────────────────────────────────
create or replace function public.tg_thread_counts()
returns trigger language plpgsql security definer set search_path = '' as $$
declare d int := case when tg_op = 'INSERT' then 1 else -1 end; r record;
begin
  if tg_op = 'INSERT' then r := new; else r := old; end if;
  update public.boards set thread_count = thread_count + d, post_count = post_count + d where id = r.board_id;
  update public.profiles set thread_count = greatest(0, thread_count + d) where id = r.author_id;
  if tg_op = 'INSERT' and not new.is_demo then
    insert into public.activities (user_id, kind, kicker, title, meta, route)
    values (new.author_id, 'thread', 'Thread · ' || public.root_board_name(new.board_id), new.title,
            null, '/t/' || new.id);
  end if;
  return null;
end $$;
create trigger thread_counts after insert or delete on public.threads
  for each row execute function public.tg_thread_counts();

create or replace function public.tg_reply_counts()
returns trigger language plpgsql security definer set search_path = '' as $$
declare d int := case when tg_op = 'INSERT' then 1 else -1 end; r record; b uuid;
begin
  if tg_op = 'INSERT' then r := new; else r := old; end if;
  update public.threads set reply_count = greatest(0, reply_count + d) where id = r.thread_id returning board_id into b;
  update public.boards set post_count = post_count + d where id = b;
  update public.profiles set reply_count = greatest(0, reply_count + d) where id = r.author_id;
  return null;
end $$;
create trigger reply_counts after insert or delete on public.replies
  for each row execute function public.tg_reply_counts();

-- Votes: score moves by the vote delta; authors earn +10 karma per upvote.
create or replace function public.tg_thread_vote()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  oldv int := case when tg_op in ('UPDATE','DELETE') then old.value else 0 end;
  newv int := case when tg_op in ('INSERT','UPDATE') then new.value else 0 end;
  tid bigint := coalesce(new.thread_id, old.thread_id);
  t record; up_delta int;
begin
  update public.threads set score = score + (newv - oldv) where id = tid returning author_id, board_id into t;
  up_delta := (case when newv = 1 then 1 else 0 end) - (case when oldv = 1 then 1 else 0 end);
  if up_delta <> 0 and t.author_id is distinct from coalesce(new.user_id, old.user_id) then
    insert into public.karma_events (user_id, bucket, amount, reason)
    values (t.author_id, public.root_board_name(t.board_id), 10 * up_delta, 'upvote');
  end if;
  return null;
end $$;
create trigger thread_vote after insert or update or delete on public.thread_votes
  for each row execute function public.tg_thread_vote();

create or replace function public.tg_reply_vote()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  oldv int := case when tg_op in ('UPDATE','DELETE') then old.value else 0 end;
  newv int := case when tg_op in ('INSERT','UPDATE') then new.value else 0 end;
  rid bigint := coalesce(new.reply_id, old.reply_id);
  r record; up_delta int;
begin
  update public.replies set score = score + (newv - oldv) where id = rid returning author_id, thread_id into r;
  up_delta := (case when newv = 1 then 1 else 0 end) - (case when oldv = 1 then 1 else 0 end);
  if up_delta <> 0 and r.author_id is distinct from coalesce(new.user_id, old.user_id) then
    insert into public.karma_events (user_id, bucket, amount, reason)
    select r.author_id, public.root_board_name(t.board_id), 10 * up_delta, 'upvote'
    from public.threads t where t.id = r.thread_id;
  end if;
  return null;
end $$;
create trigger reply_vote after insert or update or delete on public.reply_votes
  for each row execute function public.tg_reply_vote();

-- Accepted answer: +25 karma to the reply author.
create or replace function public.tg_thread_accepted()
returns trigger language plpgsql security definer set search_path = '' as $$
declare a uuid; bucket text := public.root_board_name(new.board_id);
begin
  if old.accepted_reply_id is not null then
    select author_id into a from public.replies where id = old.accepted_reply_id;
    if a is not null then
      insert into public.karma_events (user_id, bucket, amount, reason) values (a, bucket, -25, 'accepted answer removed');
      update public.profiles set accepted_count = greatest(0, accepted_count - 1) where id = a;
    end if;
  end if;
  if new.accepted_reply_id is not null then
    select author_id into a from public.replies where id = new.accepted_reply_id;
    if a is not null then
      insert into public.karma_events (user_id, bucket, amount, reason) values (a, bucket, 25, 'accepted answer');
      update public.profiles set accepted_count = accepted_count + 1 where id = a;
      insert into public.activities (user_id, kind, kicker, title, meta, route)
      values (a, 'accepted', 'Accepted answer · ' || bucket, 'Re: ' || new.title, '+25 karma', '/t/' || new.id);
    end if;
  end if;
  return null;
end $$;
create trigger thread_accepted after update of accepted_reply_id on public.threads
  for each row when (old.accepted_reply_id is distinct from new.accepted_reply_id)
  execute function public.tg_thread_accepted();

create or replace function public.tg_karma_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set karma = karma + new.amount where id = new.user_id;
  return null;
end $$;
create trigger karma_event after insert on public.karma_events
  for each row execute function public.tg_karma_event();

-- Library
create or replace function public.tg_library_item()
returns trigger language plpgsql security definer set search_path = '' as $$
declare d int := case when tg_op = 'INSERT' then 1 else -1 end; r record; br text;
begin
  if tg_op = 'INSERT' then r := new; else r := old; end if;
  update public.subjects set
    notes_count = notes_count + case when r.kind in ('notes','slides') then d else 0 end,
    pyq_count   = pyq_count   + case when r.kind = 'pyq' then d else 0 end,
    lab_count   = lab_count   + case when r.kind = 'lab' then d else 0 end
  where code = r.subject_code returning branch_code into br;
  update public.branches set file_count = file_count + d where code = br;
  if r.uploader_id is not null then
    update public.profiles set upload_count = greatest(0, upload_count + d) where id = r.uploader_id;
    if tg_op = 'INSERT' and not new.is_demo then
      insert into public.activities (user_id, kind, kicker, title, meta, route)
      values (new.uploader_id, 'upload', 'Uploaded to Library · ' || new.subject_code, new.title, null,
              '/library/subject/' || new.subject_code);
    end if;
  end if;
  return null;
end $$;
create trigger library_item after insert or delete on public.library_items
  for each row execute function public.tg_library_item();

create or replace function public.tg_library_download()
returns trigger language plpgsql security definer set search_path = '' as $$
declare u uuid;
begin
  update public.library_items set downloads = downloads + 1, downloads_week = downloads_week + 1
  where id = new.item_id returning uploader_id into u;
  update public.profiles set download_count = download_count + 1 where id = u;
  return null;
end $$;
create trigger library_download after insert on public.library_downloads
  for each row execute function public.tg_library_download();

-- Generic ±1 counters
create or replace function public.tg_bump()
returns trigger language plpgsql security definer set search_path = '' as $$
declare d int := case when tg_op = 'INSERT' then 1 else -1 end; r record;
begin
  if tg_op = 'INSERT' then r := new; else r := old; end if;
  case tg_table_name
    when 'rsvps'         then update public.society_posts set rsvp_count = greatest(0, rsvp_count + d) where id = r.post_id;
    when 'place_hearts'  then update public.places set hearts = greatest(0, hearts + d) where id = r.place_id;
    when 'poll_votes'    then update public.poll_options set votes = greatest(0, votes + d) where id = r.option_id;
    when 'board_members' then update public.boards set member_count = greatest(0, member_count + d) where id = r.board_id;
    when 'wiki_talk'     then update public.wiki_articles set talk_count = greatest(0, talk_count + d) where id = r.article_id;
  end case;
  return null;
end $$;
create trigger rsvps_bump after insert or delete on public.rsvps for each row execute function public.tg_bump();
create trigger hearts_bump after insert or delete on public.place_hearts for each row execute function public.tg_bump();
create trigger poll_bump after insert or delete on public.poll_votes for each row execute function public.tg_bump();
create trigger members_bump after insert or delete on public.board_members for each row execute function public.tg_bump();
create trigger talk_bump after insert or delete on public.wiki_talk for each row execute function public.tg_bump();

create or replace function public.tg_wiki_feedback()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.wiki_articles set useful_count = greatest(0, useful_count +
    (case when tg_op <> 'DELETE' and new.useful then 1 else 0 end) -
    (case when tg_op <> 'INSERT' and old.useful then 1 else 0 end))
  where id = coalesce(new.article_id, old.article_id);
  return null;
end $$;
create trigger wiki_feedback after insert or update or delete on public.wiki_feedback
  for each row execute function public.tg_wiki_feedback();

create or replace function public.tg_wiki_revision()
returns trigger language plpgsql security definer set search_path = '' as $$
declare a record;
begin
  if new.status <> 'published' then return null; end if;
  update public.wiki_articles set
    body = coalesce(new.body, body),
    updated_at = now(),
    editor_count = greatest(editor_count, (select count(distinct editor_id) from public.wiki_revisions where article_id = new.article_id))
  where id = new.article_id returning * into a;
  insert into public.activities (user_id, kind, kicker, title, meta, route)
  values (new.editor_id, 'wiki_edit', 'Edited wiki · ' || coalesce((select name from public.boards where id = a.board_id), 'Wiki'),
          a.title || ' — ' || new.summary,
          case when new.delta_words is not null then (case when new.delta_words >= 0 then '+' else '−' end) || abs(new.delta_words) || ' words' end,
          '/wiki/' || a.slug);
  return null;
end $$;
create trigger wiki_revision after insert on public.wiki_revisions
  for each row execute function public.tg_wiki_revision();

create or replace function public.tg_team_member()
returns trigger language plpgsql security definer set search_path = '' as $$
declare t record;
begin
  select * into t from public.teams where id = new.team_id;
  if t.owner_id <> new.user_id then
    insert into public.activities (user_id, kind, kicker, title, meta, route)
    values (new.user_id, 'team', 'Joined team · Team Up', t.title, null, '/teams');
  end if;
  return null;
end $$;
create trigger team_member after insert on public.team_members
  for each row execute function public.tg_team_member();

-- ── RPCs ──────────────────────────────────────────────────────────────────
create or replace function public.set_thread_vote(p_thread bigint, p_value smallint)
returns int language plpgsql security invoker set search_path = '' as $$
declare s int;
begin
  if p_value = 0 then
    delete from public.thread_votes where thread_id = p_thread and user_id = auth.uid();
  else
    insert into public.thread_votes (thread_id, user_id, value) values (p_thread, auth.uid(), p_value)
    on conflict (thread_id, user_id) do update set value = excluded.value;
  end if;
  select score into s from public.threads where id = p_thread;
  return s;
end $$;

create or replace function public.set_reply_vote(p_reply bigint, p_value smallint)
returns int language plpgsql security invoker set search_path = '' as $$
declare s int;
begin
  if p_value = 0 then
    delete from public.reply_votes where reply_id = p_reply and user_id = auth.uid();
  else
    insert into public.reply_votes (reply_id, user_id, value) values (p_reply, auth.uid(), p_value)
    on conflict (reply_id, user_id) do update set value = excluded.value;
  end if;
  select score into s from public.replies where id = p_reply;
  return s;
end $$;

-- Only the thread author may mark (or unmark) the accepted answer.
create or replace function public.accept_reply(p_thread bigint, p_reply bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.threads where id = p_thread and author_id = auth.uid()) then
    raise exception 'Only the original poster can accept an answer';
  end if;
  if p_reply is not null and not exists (select 1 from public.replies where id = p_reply and thread_id = p_thread) then
    raise exception 'Reply does not belong to this thread';
  end if;
  update public.threads set accepted_reply_id = p_reply where id = p_thread;
end $$;

-- Downloads are counted server-side; returns the storage path to sign.
create or replace function public.record_download(p_item bigint)
returns text language plpgsql security definer set search_path = '' as $$
declare path text;
begin
  if auth.uid() is null then raise exception 'Sign in to download'; end if;
  insert into public.library_downloads (item_id, user_id) values (p_item, auth.uid());
  select storage_path into path from public.library_items where id = p_item;
  return path;
end $$;

-- "Became a thread": turn a Lounge message into a thread in a board.
create or replace function public.promote_lounge_message(p_message bigint, p_board uuid, p_title text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare msg record; tid bigint;
begin
  select * into msg from public.lounge_messages where id = p_message;
  if msg is null then raise exception 'Message not found'; end if;
  if msg.author_id <> auth.uid() then raise exception 'Only the author can turn a message into a thread'; end if;
  insert into public.threads (board_id, author_id, title, body, from_lounge_message_id)
  values (p_board, msg.author_id, p_title, msg.body, msg.id) returning id into tid;
  update public.lounge_messages set promoted_thread_id = tid where id = p_message;
  return tid;
end $$;

create or replace function public.toggle_team_request(p_team bigint)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  if exists (select 1 from public.team_requests where team_id = p_team and user_id = auth.uid()) then
    delete from public.team_requests where team_id = p_team and user_id = auth.uid();
    return false;
  end if;
  insert into public.team_requests (team_id, user_id) values (p_team, auth.uid());
  return true;
end $$;

create or replace function public.toggle_rsvp(p_post bigint)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  if exists (select 1 from public.rsvps where post_id = p_post and user_id = auth.uid()) then
    delete from public.rsvps where post_id = p_post and user_id = auth.uid();
    return false;
  end if;
  insert into public.rsvps (post_id, user_id) values (p_post, auth.uid());
  return true;
end $$;

create or replace function public.toggle_heart(p_place bigint)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  if exists (select 1 from public.place_hearts where place_id = p_place and user_id = auth.uid()) then
    delete from public.place_hearts where place_id = p_place and user_id = auth.uid();
    return false;
  end if;
  insert into public.place_hearts (place_id, user_id) values (p_place, auth.uid());
  return true;
end $$;

-- Karma by board for the profile sidebar, plus the weekly delta.
create or replace function public.karma_breakdown(p_user uuid)
returns table (bucket text, amount bigint) language sql stable set search_path = '' as $$
  select bucket, sum(amount) from public.karma_events where user_id = p_user
  group by bucket having sum(amount) > 0 order by 2 desc limit 6
$$;

create or replace function public.karma_this_week(p_user uuid)
returns bigint language sql stable set search_path = '' as $$
  select coalesce(sum(amount), 0) from public.karma_events
  where user_id = p_user and created_at > now() - interval '7 days'
$$;

-- Removes every row seeded from supabase/seed.sql.
create or replace function public.dtour_clear_demo()
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.lounge_messages where is_demo;
  delete from public.campus_events where is_demo;
  delete from public.threads where is_demo;
  delete from public.wiki_articles where is_demo;
  delete from public.library_items where is_demo;
  delete from public.society_posts where is_demo;
  delete from public.teams where is_demo;
  delete from public.deadlines where is_demo;
  delete from public.places where is_demo;
  delete from public.societies where is_demo;
  delete from auth.users where id in (select id from public.profiles where is_demo);
  update public.boards set thread_count = (select count(*) from public.threads t where t.board_id = boards.id),
                           post_count = (select count(*) from public.threads t where t.board_id = boards.id)
                                      + (select count(*) from public.replies r join public.threads t on t.id = r.thread_id where t.board_id = boards.id);
end $$;
revoke execute on function public.dtour_clear_demo() from authenticated, anon, public;
