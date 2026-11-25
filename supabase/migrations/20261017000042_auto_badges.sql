-- Badges are awarded automatically for real activity (#63).
--
-- The list (agreed for #63):
--   first_accepted  First accepted answer  seal-check      accent   accepted_count reaches 1
--   librarian       Librarian              books           accent   10 library uploads
--   wiki_author     Wiki author            book-open-text  accent2  a guide they started is published
--   karma_1000      1,000 karma            medal           accent2  karma reaches 1,000
--   team_player     Team player            users-three     neutral  joins someone else's team
--
-- Only triggers award badges, through award_badge(). Each user gets each kind
-- once (unique user_id + kind), and gets a 'badge' notification for it. Demo
-- users are skipped. A badge stays once earned, even if the karma or count
-- behind it drops later. Self-accepted answers (#37) and karma kept after a
-- delete (#38) are already blocked, so those can't be farmed into a badge.
-- Seeded demo badges keep kind = null, so the unique constraint ignores them.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.badges add column kind text;
alter table public.badges add constraint badges_user_kind unique (user_id, kind);

-- Clients only read badges (there were never write policies; this makes it explicit).
revoke insert, update, delete on public.badges from anon, authenticated;

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('mention','reply','comment','upvote','accepted','team_request','wiki_review','event_reminder','badge'));

-- ── Award one badge ───────────────────────────────────────────────────────
create or replace function public.award_badge(p_user uuid, p_kind text, p_notify boolean default true)
returns void language plpgsql security definer set search_path = '' as $$
declare b record; h text;
begin
  select * into b from (values
    ('first_accepted', 'seal-check',     'accent',  'First accepted answer'),
    ('librarian',      'books',          'accent',  'Librarian'),
    ('wiki_author',    'book-open-text', 'accent2', 'Wiki author'),
    ('karma_1000',     'medal',          'accent2', '1,000 karma'),
    ('team_player',    'users-three',    'neutral', 'Team player')
  ) as c(kind, icon, tone, label) where c.kind = p_kind;
  if not found then raise exception 'Unknown badge %', p_kind; end if;

  select handle into h from public.profiles where id = p_user and not is_demo;
  if h is null then return; end if;

  insert into public.badges (user_id, kind, icon, tone, label)
  values (p_user, b.kind, b.icon, b.tone, b.label)
  on conflict (user_id, kind) do nothing;
  if found and p_notify then
    perform public.notify(p_user, 'badge', null, 'You earned the “' || b.label || '” badge', '/u/' || h);
  end if;
end $$;
revoke execute on function public.award_badge(uuid, text, boolean) from public, anon, authenticated;

-- ── Triggers ──────────────────────────────────────────────────────────────
-- Counters on profiles are trigger-maintained (karma_events, accept_reply,
-- library_items), so crossing a threshold here is real activity.
create or replace function public.tg_profile_badges()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.accepted_count >= 1 and old.accepted_count < 1 then perform public.award_badge(new.id, 'first_accepted'); end if;
  if new.upload_count >= 10 and old.upload_count < 10 then perform public.award_badge(new.id, 'librarian'); end if;
  if new.karma >= 1000 and old.karma < 1000 then perform public.award_badge(new.id, 'karma_1000'); end if;
  return null;
end $$;
create trigger profile_badges after update of accepted_count, upload_count, karma on public.profiles
  for each row execute function public.tg_profile_badges();

-- A guide goes live when a moderator approves it (review_wiki_article).
create or replace function public.tg_wiki_article_badge()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'published' and new.started_by is not null
     and (tg_op = 'INSERT' or old.status <> 'published') then
    perform public.award_badge(new.started_by, 'wiki_author');
  end if;
  return null;
end $$;
create trigger wiki_article_badge after insert or update of status on public.wiki_articles
  for each row execute function public.tg_wiki_article_badge();

-- Joining your own team doesn't count; members only join through an accepted request (#54).
create or replace function public.tg_team_member_badge()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.teams where id = new.team_id and owner_id <> new.user_id) then
    perform public.award_badge(new.user_id, 'team_player');
  end if;
  return null;
end $$;
create trigger team_member_badge after insert on public.team_members
  for each row execute function public.tg_team_member_badge();

revoke execute on function public.tg_profile_badges(), public.tg_wiki_article_badge(), public.tg_team_member_badge()
  from public, anon, authenticated;

-- ── Backfill: badges already earned, without notifications ────────────────
do $$
begin
  perform public.award_badge(id, 'first_accepted', false) from public.profiles where accepted_count >= 1;
  perform public.award_badge(id, 'librarian', false) from public.profiles where upload_count >= 10;
  perform public.award_badge(id, 'karma_1000', false) from public.profiles where karma >= 1000;
  perform public.award_badge(p.id, 'wiki_author', false) from public.profiles p
    where exists (select 1 from public.wiki_articles a where a.started_by = p.id and a.status = 'published');
  perform public.award_badge(p.id, 'team_player', false) from public.profiles p
    where exists (select 1 from public.team_members m join public.teams t on t.id = m.team_id
                  where m.user_id = p.id and t.owner_id <> p.id);
end $$;

commit;
