-- Per-user rate limits on posting (#13). Enforced by before-insert triggers, so web, mobile and
-- direct API calls are all covered. Moderators, admins and server-side (non-"authenticated") writes are exempt.
--
-- Each allowed insert is logged in a private ledger and the trigger counts the ledger, not the content
-- table. Deleting your own post, or backdating created_at, therefore can't buy extra posts.

create table public.rate_limit_hits (
  user_id uuid not null references public.profiles on delete cascade,
  action  text not null,
  at      timestamptz not null default now()
);
create index on public.rate_limit_hits (user_id, action, at);
alter table public.rate_limit_hits enable row level security;  -- no policies: only the trigger below touches it
revoke all on public.rate_limit_hits from public, anon, authenticated;

-- Usage: execute function public.tg_rate_limit(max_inserts, window). The action is the table name.
-- SQLSTATE 'DT429' is custom on purpose: PostgREST maps PT-prefixed codes to HTTP statuses.
create or replace function public.tg_rate_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  max_hits int := tg_argv[0]::int;
  win interval := tg_argv[1]::interval;
  oldest timestamptz;
  mins int;
begin
  if uid is null or current_setting('role', true) is distinct from 'authenticated' or public.is_moderator() then
    return new;
  end if;
  -- A new wiki article is saved together with its first revision; the article insert already counted.
  if tg_table_name = 'wiki_revisions' then
    if exists (
      select 1 from public.wiki_articles a
      where a.id = new.article_id and a.started_by = uid
        and not exists (select 1 from public.wiki_revisions r where r.article_id = a.id)
    ) then
      return new;
    end if;
  end if;

  -- Serialise this user's inserts so parallel requests can't slip past the count.
  perform pg_advisory_xact_lock(hashtextextended(uid::text || ':' || tg_table_name, 0));
  delete from public.rate_limit_hits where user_id = uid and action = tg_table_name and at < now() - win;

  select min(at) into oldest from public.rate_limit_hits where user_id = uid and action = tg_table_name;
  if (select count(*) from public.rate_limit_hits where user_id = uid and action = tg_table_name) >= max_hits then
    mins := greatest(1, ceil(extract(epoch from (oldest + win - now())) / 60)::int);
    raise exception 'Slow down a little — try again in %.', case when mins = 1 then 'a minute' else mins || ' minutes' end
      using errcode = 'DT429';
  end if;
  insert into public.rate_limit_hits (user_id, action) values (uid, tg_table_name);
  return new;
end $$;
revoke execute on function public.tg_rate_limit() from public, anon, authenticated;

create trigger rate_limit before insert on public.lounge_messages for each row execute function public.tg_rate_limit(10, '1 minute');
create trigger rate_limit before insert on public.threads         for each row execute function public.tg_rate_limit(10, '1 hour');
create trigger rate_limit before insert on public.replies         for each row execute function public.tg_rate_limit(30, '10 minutes');
create trigger rate_limit before insert on public.reports         for each row execute function public.tg_rate_limit(10, '1 hour');
create trigger rate_limit before insert on public.team_requests   for each row execute function public.tg_rate_limit(10, '1 hour');
create trigger rate_limit before insert on public.places          for each row execute function public.tg_rate_limit(10, '1 hour');
create trigger rate_limit before insert on public.wiki_articles   for each row execute function public.tg_rate_limit(10, '1 hour');
create trigger rate_limit before insert on public.wiki_revisions  for each row execute function public.tg_rate_limit(10, '1 hour');
