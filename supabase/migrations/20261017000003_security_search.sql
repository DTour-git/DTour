-- Row-level security, search, storage and realtime.
-- DTour is a campus-only community: every read requires a signed-in DTU user.

-- ── Grants (explicit; RLS does the real gating) ───────────────────────────
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
revoke execute on function public.dtour_clear_demo() from authenticated;
revoke execute on function public.hook_before_user_created(jsonb) from authenticated;

-- Helper: may the current user post as this society?
create or replace function public.can_post_as(p_society uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.society_members
                 where society_id = p_society and user_id = auth.uid() and can_post)
$$;

create or replace function public.is_society_poster()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.society_members where user_id = auth.uid() and can_post)
$$;

-- Enable RLS everywhere, then read-for-members on every table.
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "members read" on public.%I for select to authenticated using (true)', t);
  end loop;
end $$;

-- Users can read their own drafts only (replace the blanket read policy).
drop policy "members read" on public.drafts;
create policy "own drafts" on public.drafts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Reference/config tables: read-only to clients (no write policies).
--   app_config, allowed_email_domains, branches, board_categories, boards,
--   wiki_categories, subjects, exam_windows, lounge_rooms, deadlines, campus_events,
--   karma_events, activities, badges, library_downloads

-- Profiles: you edit yourself (counters are protected by a trigger below).
create policy "edit self" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.tg_profile_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_setting('role', true) = 'authenticated' then
    new.karma := old.karma; new.thread_count := old.thread_count; new.reply_count := old.reply_count;
    new.accepted_count := old.accepted_count; new.upload_count := old.upload_count;
    new.download_count := old.download_count; new.is_demo := old.is_demo; new.created_at := old.created_at;
  end if;
  return new;
end $$;
create trigger profile_guard before update on public.profiles
  for each row execute function public.tg_profile_guard();

-- Threads
create policy "post threads" on public.threads for insert to authenticated with check (
  author_id = auth.uid()
  and (society_id is null or public.can_post_as(society_id))
  and (not (select verified_only from public.boards where id = board_id) or public.is_society_poster())
  and (kind <> 'news' or public.is_society_poster())
);
create policy "edit own threads" on public.threads for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "delete own threads" on public.threads for delete to authenticated using (author_id = auth.uid());

create or replace function public.tg_thread_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_setting('role', true) = 'authenticated' then
    if tg_op = 'INSERT' then
      new.score := 0; new.reply_count := 0; new.accepted_reply_id := null; new.is_demo := false;
    else
      new.score := old.score; new.reply_count := old.reply_count; new.is_demo := old.is_demo;
      new.accepted_reply_id := old.accepted_reply_id;  -- use accept_reply()
      new.updated_at := now();
    end if;
  end if;
  return new;
end $$;
create trigger thread_guard before insert or update on public.threads
  for each row execute function public.tg_thread_guard();

-- Replies
create policy "post replies" on public.replies for insert to authenticated with check (
  author_id = auth.uid() and (society_id is null or public.can_post_as(society_id)));
create policy "edit own replies" on public.replies for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "delete own replies" on public.replies for delete to authenticated using (author_id = auth.uid());

create or replace function public.tg_reply_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_setting('role', true) = 'authenticated' then
    if tg_op = 'INSERT' then new.score := 0; new.is_demo := false;
    else new.score := old.score; new.is_demo := old.is_demo; end if;
  end if;
  return new;
end $$;
create trigger reply_guard before insert or update on public.replies
  for each row execute function public.tg_reply_guard();

-- Personal rows: votes, saves, rsvps, hearts, poll votes, memberships, feedback, requests
do $$
declare t text;
begin
  foreach t in array array['thread_votes','reply_votes','saves','rsvps','place_hearts','poll_votes',
                           'board_members','wiki_feedback','team_requests'] loop
    execute format('create policy "own rows insert" on public.%I for insert to authenticated with check (user_id = auth.uid())', t);
    execute format('create policy "own rows update" on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create policy "own rows delete" on public.%I for delete to authenticated using (user_id = auth.uid())', t);
  end loop;
end $$;

-- Poll options are created by the poll's author.
create policy "poll author adds options" on public.poll_options for insert to authenticated
  with check (exists (select 1 from public.threads t where t.id = thread_id and t.author_id = auth.uid()));

-- Wiki: anyone can start an article or edit (edits are credited revisions).
create policy "start article" on public.wiki_articles for insert to authenticated with check (started_by = auth.uid());
create policy "revise" on public.wiki_revisions for insert to authenticated with check (editor_id = auth.uid());
create policy "talk" on public.wiki_talk for insert to authenticated with check (author_id = auth.uid());

-- Library uploads
create policy "upload files" on public.library_items for insert to authenticated with check (uploader_id = auth.uid());
create policy "delete own files" on public.library_items for delete to authenticated using (uploader_id = auth.uid());

-- Society board: verified society posters only.
create policy "society posts" on public.society_posts for insert to authenticated
  with check (public.can_post_as(society_id) and author_id = auth.uid());
create policy "edit society posts" on public.society_posts for update to authenticated
  using (public.can_post_as(society_id)) with check (public.can_post_as(society_id));

-- Teams
create policy "post team" on public.teams for insert to authenticated with check (owner_id = auth.uid());
create policy "edit own team" on public.teams for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "delete own team" on public.teams for delete to authenticated using (owner_id = auth.uid());
create policy "team roles by owner" on public.team_roles for all to authenticated
  using (exists (select 1 from public.teams t where t.id = team_id and t.owner_id = auth.uid()))
  with check (exists (select 1 from public.teams t where t.id = team_id and t.owner_id = auth.uid()));
create policy "team members by owner" on public.team_members for insert to authenticated
  with check (exists (select 1 from public.teams t where t.id = team_id and t.owner_id = auth.uid()));
create policy "owner reviews requests" on public.team_requests for update to authenticated
  using (exists (select 1 from public.teams t where t.id = team_id and t.owner_id = auth.uid()));

-- Places
create policy "recommend place" on public.places for insert to authenticated with check (author_id = auth.uid());

-- Lounge
create policy "send messages" on public.lounge_messages for insert to authenticated with check (
  author_id = auth.uid() and promoted_thread_id is null
  and (society_id is null or public.can_post_as(society_id)));
create policy "delete own messages" on public.lounge_messages for delete to authenticated using (author_id = auth.uid());

-- New threads per board since the viewer last opened Boards.
create or replace function public.board_new_counts()
returns table (board_id uuid, n bigint) language sql stable security invoker set search_path = '' as $$
  select t.board_id, count(*) from public.threads t
  where t.created_at > coalesce((select boards_seen_at from public.profiles where id = auth.uid()), now())
  group by t.board_id
$$;
grant execute on function public.board_new_counts() to authenticated;

-- ── Search ────────────────────────────────────────────────────────────────
-- One row per searchable thing. The palette pre-filters server-side with a
-- subsequence regex (same semantics as the client fzf scorer), then ranks
-- on the client so the highlight and ordering feel like fzf.
create or replace function public.fmt_n(n bigint)
returns text language sql immutable as $$ select to_char(n, 'FM999,999,999') $$;

create or replace view public.search_documents with (security_invoker = on) as
  select 'Thread'::text as kind, 'chat-circle'::text as icon, t.title,
         coalesce(b.short_name, b.name) || ' · ' || public.fmt_n(t.score) || ' votes · ' || public.fmt_n(t.reply_count) || ' replies' as sub,
         left(regexp_replace(t.body, '\s+', ' ', 'g'), 220) as body,
         '/t/' || t.id as route, t.score + t.reply_count as popularity
  from public.threads t join public.boards b on b.id = t.board_id
  union all
  select 'Article', 'article', a.title,
         'Wiki · ' || a.editor_count || ' editors' || coalesce(' · checked ' || to_char(a.checked_at, 'Mon YYYY'), ''),
         coalesce(a.dek, ''), '/wiki/' || a.slug, a.views_week + a.useful_count
  from public.wiki_articles a
  union all
  select 'Library', case when i.kind = 'pyq' then 'file-pdf' else 'file-text' end,
         i.title || ' (' || i.subject_code || ')',
         'Library › ' || s.branch_code || ' › Sem ' || s.semester || ' · ' || public.fmt_n(i.downloads) || ' downloads',
         s.name, '/library/subject/' || s.code, i.downloads
  from public.library_items i join public.subjects s on s.code = i.subject_code
  union all
  select 'Person', 'user', '@' || p.handle,
         coalesce(p.branch_code || ' ''' || right(p.grad_year::text, 2) || ' · ', '') || public.fmt_n(p.karma) || ' karma',
         coalesce(p.bio, ''), '/u/' || p.handle, p.karma
  from public.profiles p
  union all
  select 'Board', 'hash', '#' || b.slug || ' — ' || b.name,
         c.name || ' · ' || public.fmt_n(b.thread_count) || ' threads', coalesce(b.description, ''),
         coalesce('/' || b.link_screen, '/b/' || b.slug), b.thread_count
  from public.boards b join public.board_categories c on c.id = b.category_id
  union all
  select 'Society', 'flag-banner', s.name, case when s.verified then 'Verified society' else 'Society' end,
         coalesce(s.description, ''), '/societies', 0
  from public.societies s
  union all
  select 'Team', 'users-three', t.title, 'Team Up · ' || coalesce(t.deadline_label, 'Rolling'),
         coalesce(t.description, ''), '/teams', 0
  from public.teams t
  union all
  select 'Place', 'map-pin', p.name, 'Kahan chalein? · ' || concat_ws(' · ', p.where_label, p.price_label),
         '', '/kahan-chalein', p.hearts + p.recs
  from public.places p;

create or replace function public.fuzzy_pattern(q text)
returns text language sql immutable as $$
  select string_agg(regexp_replace(c, '([.^$*+?()\[\]{}|\\-])', '\\\1', 'g'), '.*')
  from regexp_split_to_table(regexp_replace(lower(q), '\s+', '', 'g'), '') as c
$$;

create or replace function public.search(q text default '', p_kind text default null, p_limit int default 80)
returns setof public.search_documents language sql stable security invoker set search_path = '' as $$
  select * from public.search_documents d
  where (p_kind is null or d.kind = p_kind)
    and (coalesce(q, '') = '' or lower(d.title) ~ public.fuzzy_pattern(q))
  order by d.popularity desc
  limit p_limit
$$;

create or replace function public.search_total(p_kind text default null)
returns bigint language sql stable security invoker set search_path = '' as $$
  select count(*) from public.search_documents d where p_kind is null or d.kind = p_kind
$$;

grant select on public.search_documents to authenticated;
grant execute on function public.search(text, text, int), public.search_total(text),
  public.fuzzy_pattern(text), public.fmt_n(bigint) to authenticated;

-- ── Storage ───────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('library', 'library', false, 52428800),   -- PDFs, notes, lab files (50 MB)
       ('media', 'media', true, 10485760)          -- images, posters, avatars (10 MB)
on conflict (id) do nothing;

create policy "members read library" on storage.objects for select to authenticated
  using (bucket_id = 'library');
create policy "upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id in ('library', 'media') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own objects" on storage.objects for delete to authenticated
  using (bucket_id in ('library', 'media') and (storage.foldername(name))[1] = auth.uid()::text);

-- ── Realtime ──────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.lounge_messages;
