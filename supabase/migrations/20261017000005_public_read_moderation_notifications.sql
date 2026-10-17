-- 1. Public reading: anyone can read content; every write still needs a DTU account.
-- 2. Wiki moderation: new articles and edits wait for a moderator (an AI pre-check can fill ai_verdict later).
-- 3. Notifications: mentions, replies, comments, upvotes, accepted answers, team requests, wiki reviews.

-- ── 1. Public read ────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'app_config','branches','profiles','societies','society_members','board_categories','boards','threads','replies',
    'poll_options','karma_events','activities','badges','wiki_categories','wiki_articles','wiki_revisions','wiki_talk',
    'subjects','library_items','exam_windows','society_posts','teams','team_roles','team_members','deadlines','places',
    'campus_events','lounge_rooms','lounge_messages'] loop
    execute format('grant select on public.%I to anon', t);
    execute format('drop policy if exists "members read" on public.%I', t);
    execute format('create policy "public read" on public.%I for select to anon, authenticated using (true)', t);
  end loop;
end $$;

-- Personal rows stay private to their owner.
do $$
declare t text;
begin
  foreach t in array array['thread_votes','reply_votes','saves','poll_votes','rsvps','place_hearts','board_members','wiki_feedback','team_requests','library_downloads'] loop
    execute format('drop policy if exists "members read" on public.%I', t);
    execute format('create policy "own read" on public.%I for select to authenticated using (user_id = auth.uid())', t);
  end loop;
end $$;
-- Team owners see requests to their teams.
create policy "owner reads requests" on public.team_requests for select to authenticated
  using (exists (select 1 from public.teams t where t.id = team_id and t.owner_id = auth.uid()));

grant select on public.search_documents to anon;
grant execute on function public.search(text, text, int), public.search_total(text), public.fuzzy_pattern(text), public.fmt_n(bigint),
  public.karma_breakdown(uuid), public.karma_this_week(uuid), public.root_board_name(uuid), public.board_path(uuid) to anon;

create or replace function public.board_new_counts()
returns table (board_id uuid, n bigint) language sql stable security invoker set search_path = '' as $$
  select t.board_id, count(*) from public.threads t
  where auth.uid() is not null
    and t.created_at > coalesce((select boards_seen_at from public.profiles where id = auth.uid()), now())
  group by t.board_id
$$;
grant execute on function public.board_new_counts() to anon;

-- File downloads are counted per account, so they need sign-in (record_download already checks).
drop policy if exists "members read library" on storage.objects;
create policy "members read library" on storage.objects for select to authenticated using (bucket_id = 'library');
create policy "public media" on storage.objects for select to anon, authenticated using (bucket_id = 'media');

-- ── 2. Roles & wiki moderation ────────────────────────────────────────────
alter table public.profiles add column role text not null default 'member' check (role in ('member','moderator','admin'));

create or replace function public.is_moderator()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('moderator','admin'))
$$;
grant execute on function public.is_moderator() to anon, authenticated;

-- role can only change via SQL/admin (extend the profile guard)
create or replace function public.tg_profile_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_setting('role', true) = 'authenticated' then
    new.karma := old.karma; new.thread_count := old.thread_count; new.reply_count := old.reply_count;
    new.accepted_count := old.accepted_count; new.upload_count := old.upload_count;
    new.download_count := old.download_count; new.is_demo := old.is_demo; new.created_at := old.created_at;
    new.role := old.role;
  end if;
  return new;
end $$;

alter table public.wiki_articles
  add column status text not null default 'published' check (status in ('pending','published','rejected')),
  add column reviewed_by uuid references public.profiles on delete set null,
  add column reviewed_at timestamptz,
  add column review_note text,
  add column ai_verdict jsonb;               -- reserved for an AI moderator pass
alter table public.wiki_revisions
  add column reviewed_by uuid references public.profiles on delete set null,
  add column reviewed_at timestamptz,
  add column review_note text,
  add column ai_verdict jsonb;
alter table public.wiki_revisions alter column status set default 'suggested';
alter table public.wiki_revisions drop constraint wiki_revisions_status_check;
alter table public.wiki_revisions add constraint wiki_revisions_status_check check (status in ('suggested','published','rejected'));

-- Readers see published articles; authors and mods also see pending ones.
drop policy "public read" on public.wiki_articles;
create policy "public read" on public.wiki_articles for select to anon, authenticated
  using (status = 'published' or started_by = auth.uid() or public.is_moderator());
drop policy "public read" on public.wiki_revisions;
create policy "public read" on public.wiki_revisions for select to anon, authenticated
  using (status = 'published' or editor_id = auth.uid() or public.is_moderator());

-- Members can only submit for review.
drop policy "start article" on public.wiki_articles;
create policy "start article" on public.wiki_articles for insert to authenticated
  with check (started_by = auth.uid() and (status = 'pending' or public.is_moderator()));
drop policy "revise" on public.wiki_revisions;
create policy "revise" on public.wiki_revisions for insert to authenticated
  with check (editor_id = auth.uid() and (status = 'suggested' or public.is_moderator()));

-- Applying a revision now happens when it becomes published (insert by a mod, or approval).
drop trigger wiki_revision on public.wiki_revisions;
create or replace function public.tg_wiki_revision()
returns trigger language plpgsql security definer set search_path = '' as $$
declare a record;
begin
  if new.status <> 'published' or (tg_op = 'UPDATE' and old.status = 'published') then return null; end if;
  update public.wiki_articles set
    body = coalesce(new.body, body),
    updated_at = now(),
    editor_count = greatest(editor_count, (select count(distinct editor_id) from public.wiki_revisions where article_id = new.article_id and status = 'published'))
  where id = new.article_id returning * into a;
  if not exists (select 1 from public.profiles where id = new.editor_id and is_demo) then
    insert into public.activities (user_id, kind, kicker, title, meta, route)
    values (new.editor_id, 'wiki_edit', 'Edited wiki · ' || coalesce((select name from public.boards where id = a.board_id), 'Wiki'),
            a.title || ' — ' || new.summary,
            case when new.delta_words is not null then (case when new.delta_words >= 0 then '+' else '−' end) || abs(new.delta_words) || ' words' end,
            '/wiki/' || a.slug);
  end if;
  return null;
end $$;
create trigger wiki_revision after insert or update of status on public.wiki_revisions
  for each row execute function public.tg_wiki_revision();

create or replace function public.review_wiki_revision(p_revision bigint, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_moderator() then raise exception 'Only moderators can review edits'; end if;
  update public.wiki_revisions set status = case when p_approve then 'published' else 'rejected' end,
    reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_note
  where id = p_revision and status = 'suggested';
end $$;

create or replace function public.review_wiki_article(p_article bigint, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_moderator() then raise exception 'Only moderators can review articles'; end if;
  update public.wiki_articles set status = case when p_approve then 'published' else 'rejected' end,
    reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_note
  where id = p_article and status = 'pending';
  if p_approve then
    update public.wiki_revisions set status = 'published', reviewed_by = auth.uid(), reviewed_at = now()
    where article_id = p_article and status = 'suggested';
  end if;
end $$;
grant execute on function public.review_wiki_revision(bigint, boolean, text), public.review_wiki_article(bigint, boolean, text) to authenticated;

-- Search only indexes published articles.
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
  from public.wiki_articles a where a.status = 'published'
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
grant select on public.search_documents to anon, authenticated;

-- ── 3. Notifications ──────────────────────────────────────────────────────
create table public.notifications (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles on delete cascade,
  kind        text not null check (kind in ('mention','reply','comment','upvote','accepted','team_request','wiki_review')),
  actor_id    uuid references public.profiles on delete set null,
  thread_id   bigint references public.threads on delete cascade,
  reply_id    bigint references public.replies on delete cascade,
  lounge_message_id bigint references public.lounge_messages on delete cascade,
  team_id     bigint references public.teams on delete cascade,
  article_id  bigint references public.wiki_articles on delete cascade,
  count       int not null default 1,          -- grouped upvotes: "12 people upvoted…"
  text        text not null,                   -- headline, e.g. "replied to your thread"
  snippet     text,
  route       text not null,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index on public.notifications (user_id, created_at desc);
create index on public.notifications (user_id) where read_at is null;
alter table public.notifications enable row level security;
create policy "own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "mark read" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, update on public.notifications to authenticated;
alter publication supabase_realtime add table public.notifications;

create or replace function public.notify(p_user uuid, p_kind text, p_actor uuid, p_text text, p_route text,
  p_snippet text default null, p_thread bigint default null, p_reply bigint default null, p_msg bigint default null,
  p_team bigint default null, p_article bigint default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_user is null or p_user = p_actor then return; end if;
  if exists (select 1 from public.profiles where id = p_user and is_demo) then return; end if;
  insert into public.notifications (user_id, kind, actor_id, text, route, snippet, thread_id, reply_id, lounge_message_id, team_id, article_id)
  values (p_user, p_kind, p_actor, p_text, p_route, left(p_snippet, 160), p_thread, p_reply, p_msg, p_team, p_article);
end $$;
revoke execute on function public.notify(uuid, text, uuid, text, text, text, bigint, bigint, bigint, bigint, bigint) from anon, authenticated, public;

-- @mentions anywhere (Lounge, threads, replies)
create or replace function public.notify_mentions(p_body text, p_actor uuid, p_text text, p_route text,
  p_thread bigint default null, p_reply bigint default null, p_msg bigint default null)
returns void language plpgsql security definer set search_path = '' as $$
declare h text; uid uuid;
begin
  for h in select distinct lower(m[1]) from regexp_matches(p_body, '@([a-zA-Z0-9][a-zA-Z0-9._]{2,23})', 'g') as m loop
    select id into uid from public.profiles where handle = rtrim(h, '.');
    if uid is not null then
      perform public.notify(uid, 'mention', p_actor, p_text, p_route, p_body, p_thread, p_reply, p_msg);
    end if;
  end loop;
end $$;
revoke execute on function public.notify_mentions(text, uuid, text, text, bigint, bigint, bigint) from anon, authenticated, public;

create or replace function public.tg_notify_reply()
returns trigger language plpgsql security definer set search_path = '' as $$
declare t record; parent_author uuid;
begin
  if new.is_demo then return null; end if;
  select id, author_id, title into t from public.threads where id = new.thread_id;
  if new.parent_id is not null then
    select author_id into parent_author from public.replies where id = new.parent_id;
    perform public.notify(parent_author, 'comment', new.author_id, 'replied to your comment on “' || t.title || '”', '/t/' || t.id, new.body, t.id, new.id);
  end if;
  if parent_author is distinct from t.author_id then
    perform public.notify(t.author_id, 'reply', new.author_id, 'replied to “' || t.title || '”', '/t/' || t.id, new.body, t.id, new.id);
  end if;
  perform public.notify_mentions(new.body, new.author_id, 'mentioned you in “' || t.title || '”', '/t/' || t.id, t.id, new.id);
  return null;
end $$;
create trigger notify_reply after insert on public.replies for each row execute function public.tg_notify_reply();

create or replace function public.tg_notify_thread()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.is_demo then return null; end if;
  perform public.notify_mentions(new.title || ' ' || new.body, new.author_id, 'mentioned you in “' || new.title || '”', '/t/' || new.id, new.id);
  return null;
end $$;
create trigger notify_thread after insert on public.threads for each row execute function public.tg_notify_thread();

create or replace function public.tg_notify_lounge()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.is_demo then return null; end if;
  perform public.notify_mentions(new.body, new.author_id, 'mentioned you in #' || new.room_slug, '/lounge?room=' || new.room_slug, null, null, new.id);
  return null;
end $$;
create trigger notify_lounge after insert on public.lounge_messages for each row execute function public.tg_notify_lounge();

-- Upvotes are grouped: one unread notification per thread/reply, counting up.
create or replace function public.notify_upvote(p_owner uuid, p_actor uuid, p_thread bigint, p_reply bigint, p_title text)
returns void language plpgsql security definer set search_path = '' as $$
declare existing bigint;
begin
  if p_owner is null or p_owner = p_actor then return; end if;
  select id into existing from public.notifications
  where user_id = p_owner and kind = 'upvote' and read_at is null
    and thread_id is not distinct from p_thread and reply_id is not distinct from p_reply;
  if existing is not null then
    update public.notifications set count = count + 1, actor_id = p_actor, created_at = now(),
      text = 'and ' || count || ' other' || case when count = 1 then '' else 's' end || ' upvoted ' || p_title
    where id = existing;
  else
    perform public.notify(p_owner, 'upvote', p_actor, 'upvoted ' || p_title, '/t/' || p_thread, null, p_thread, p_reply);
  end if;
end $$;
revoke execute on function public.notify_upvote(uuid, uuid, bigint, bigint, text) from anon, authenticated, public;

create or replace function public.tg_notify_thread_vote()
returns trigger language plpgsql security definer set search_path = '' as $$
declare t record;
begin
  if new.value <> 1 or (tg_op = 'UPDATE' and old.value = 1) then return null; end if;
  select id, author_id, title into t from public.threads where id = new.thread_id;
  perform public.notify_upvote(t.author_id, new.user_id, t.id, null, 'your thread “' || t.title || '”');
  return null;
end $$;
create trigger notify_thread_vote after insert or update on public.thread_votes for each row execute function public.tg_notify_thread_vote();

create or replace function public.tg_notify_reply_vote()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  if new.value <> 1 or (tg_op = 'UPDATE' and old.value = 1) then return null; end if;
  select r2.id, r2.author_id, r2.thread_id, t.title into r from public.replies r2 join public.threads t on t.id = r2.thread_id where r2.id = new.reply_id;
  perform public.notify_upvote(r.author_id, new.user_id, r.thread_id, r.id, 'your reply on “' || r.title || '”');
  return null;
end $$;
create trigger notify_reply_vote after insert or update on public.reply_votes for each row execute function public.tg_notify_reply_vote();

create or replace function public.tg_notify_accepted()
returns trigger language plpgsql security definer set search_path = '' as $$
declare a uuid;
begin
  if new.accepted_reply_id is null then return null; end if;
  select author_id into a from public.replies where id = new.accepted_reply_id;
  perform public.notify(a, 'accepted', new.author_id, 'accepted your answer on “' || new.title || '” · +25 karma', '/t/' || new.id, null, new.id, new.accepted_reply_id);
  return null;
end $$;
create trigger notify_accepted after update of accepted_reply_id on public.threads
  for each row when (old.accepted_reply_id is distinct from new.accepted_reply_id) execute function public.tg_notify_accepted();

create or replace function public.tg_notify_team_request()
returns trigger language plpgsql security definer set search_path = '' as $$
declare t record;
begin
  select id, owner_id, title into t from public.teams where id = new.team_id;
  perform public.notify(t.owner_id, 'team_request', new.user_id, 'asked to join “' || t.title || '”', '/teams', null, null, null, null, t.id);
  return null;
end $$;
create trigger notify_team_request after insert on public.team_requests for each row execute function public.tg_notify_team_request();

create or replace function public.tg_notify_wiki_review()
returns trigger language plpgsql security definer set search_path = '' as $$
declare a record;
begin
  if tg_op <> 'UPDATE' or old.status = new.status or new.reviewed_by is null then return null; end if;
  if tg_table_name = 'wiki_revisions' then
    select id, slug, title into a from public.wiki_articles where id = new.article_id;
    perform public.notify(new.editor_id, 'wiki_review', new.reviewed_by,
      case when new.status = 'published' then 'approved your edit to “' || a.title || '”' else 'didn’t approve your edit to “' || a.title || '”' end,
      '/wiki/' || a.slug, new.review_note, null, null, null, null, a.id);
  else
    perform public.notify(new.started_by, 'wiki_review', new.reviewed_by,
      case when new.status = 'published' then 'published your guide “' || new.title || '”' else 'didn’t approve your guide “' || new.title || '”' end,
      '/wiki/' || new.slug, new.review_note, null, null, null, null, new.id);
  end if;
  return null;
end $$;
create trigger notify_rev_review after update of status on public.wiki_revisions for each row execute function public.tg_notify_wiki_review();
create trigger notify_article_review after update of status on public.wiki_articles for each row execute function public.tg_notify_wiki_review();

create or replace function public.mark_notifications_read()
returns void language sql security invoker set search_path = '' as $$
  update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null
$$;
grant execute on function public.mark_notifications_read() to authenticated;
