-- Changing your handle, Discord-style:
-- 1. Every @mention of the old handle in posts, replies, Lounge messages, wiki
--    pages, drafts and notifications is rewritten to the new handle.
-- 2. The old handle stays reserved for its owner for 30 days, so nobody can
--    grab it and pose as them. Links to /u/old-handle and new @old-handle
--    mentions still reach them during that time.
-- 3. A handle can be changed once every 7 days (picking one at onboarding
--    doesn't count). A short list of official-sounding handles is reserved.

alter table public.profiles add column handle_changed_at timestamptz;

create table public.handle_history (
  handle      text primary key,
  user_id     uuid not null references public.profiles on delete cascade,
  released_at timestamptz not null            -- others may claim it after this
);
create index on public.handle_history (user_id);
alter table public.handle_history enable row level security;  -- no policies: read only through the functions below

create table public.reserved_handles (handle text primary key);
alter table public.reserved_handles enable row level security;
insert into public.reserved_handles (handle) values
  ('admin'), ('administrator'), ('admins'), ('mod'), ('mods'), ('moderator'), ('moderators'),
  ('dtour'), ('dtu'), ('support'), ('help'), ('staff'), ('team'), ('official'), ('system'),
  ('root'), ('null'), ('undefined'), ('everyone'), ('here'), ('anonymous'), ('deleted'), ('me'), ('you');

-- Why a handle can or can't be used by the signed-in student:
-- invalid | reserved | taken | held (someone's recent old handle) | yours | available
create or replace function public.handle_status(p_handle text)
returns text language plpgsql stable security definer set search_path = '' as $$
declare h text := lower(trim(both from p_handle)); owner uuid;
begin
  if h !~ '^[a-z0-9][a-z0-9._]{2,23}$' then return 'invalid'; end if;
  select id into owner from public.profiles where handle = h;
  if owner is not null then return case when owner = auth.uid() then 'yours' else 'taken' end; end if;
  if exists (select 1 from public.reserved_handles where handle = h) then return 'reserved'; end if;
  select user_id into owner from public.handle_history where handle = h and released_at > now();
  if owner is not null and owner is distinct from auth.uid() then return 'held'; end if;
  return 'available';
end $$;
grant execute on function public.handle_status(text) to anon, authenticated;

-- Where an old handle points now (for /u/old-handle links). Null if nobody.
create or replace function public.current_handle(p_handle text)
returns text language sql stable security definer set search_path = '' as $$
  select p.handle from public.handle_history h join public.profiles p on p.id = h.user_id
  where h.handle = lower(p_handle) and h.released_at > now()
$$;
grant execute on function public.current_handle(text) to anon, authenticated;

-- Clients can't set the cooldown clock themselves.
create or replace function public.tg_profile_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' then
    new.karma := old.karma; new.thread_count := old.thread_count; new.reply_count := old.reply_count;
    new.accepted_count := old.accepted_count; new.upload_count := old.upload_count;
    new.download_count := old.download_count; new.is_demo := old.is_demo; new.created_at := old.created_at;
    new.role := old.role; new.handle_changed_at := old.handle_changed_at;
  end if;
  return new;
end $$;

-- Runs after profile_guard (triggers fire in name order).
create or replace function public.tg_profile_handle_check()
returns trigger language plpgsql set search_path = '' as $$
declare s text;
begin
  new.handle := lower(new.handle);
  if new.handle = old.handle or current_user <> 'authenticated' then return new; end if;
  select public.handle_status(new.handle) into s;
  if s = 'invalid' then raise exception 'Handles are 3–24 characters: lowercase letters, numbers, dots and underscores.' using errcode = 'check_violation'; end if;
  if s = 'taken' then raise exception '@% is taken. Try another.', new.handle using errcode = 'unique_violation'; end if;
  if s = 'reserved' then raise exception '@% is reserved. Try another.', new.handle using errcode = 'check_violation'; end if;
  if s = 'held' then raise exception '@% was someone’s handle recently and is held for them. Try another.', new.handle using errcode = 'check_violation'; end if;
  if old.onboarded then
    if old.handle_changed_at > now() - interval '7 days' then
      raise exception 'You can change your handle again on %.', to_char((old.handle_changed_at + interval '7 days') at time zone 'Asia/Kolkata', 'DD Mon')
        using errcode = 'check_violation';
    end if;
    new.handle_changed_at := now();
  end if;
  return new;
end $$;
create trigger profile_handle_check before update of handle on public.profiles
  for each row execute function public.tg_profile_handle_check();

-- Rewrites @old to @new. Matches only whole handles: "@riya" won't touch
-- "@riya_k" or "email@riya", but does match "@riya." at the end of a sentence.
create or replace function public.rename_mentions(p_text text, p_old text, p_new text)
returns text language sql immutable set search_path = '' as $$
  select regexp_replace(p_text,
    '(^|[^a-zA-Z0-9._@])@' || replace(p_old, '.', '\.') || '(?![a-zA-Z0-9_]|\.[a-zA-Z0-9_])',
    '\1@' || p_new, 'gi')
$$;

create or replace function public.tg_profile_handle_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
declare pat text := '(^|[^a-zA-Z0-9._@])@' || replace(old.handle, '.', '\.') || '(?![a-zA-Z0-9_]|\.[a-zA-Z0-9_])';
begin
  if new.handle = old.handle then return null; end if;
  -- Going back to a recent old handle: it's yours again, not "held".
  delete from public.handle_history where handle = new.handle and user_id = new.id;
  if not old.onboarded then return null; end if;  -- the auto-generated sign-up handle was never really used

  insert into public.handle_history (handle, user_id, released_at) values (old.handle, new.id, now() + interval '30 days')
  on conflict (handle) do update set user_id = excluded.user_id, released_at = excluded.released_at;

  update public.threads set title = public.rename_mentions(title, old.handle, new.handle), body = public.rename_mentions(body, old.handle, new.handle)
    where title ~* pat or body ~* pat;
  update public.replies set body = public.rename_mentions(body, old.handle, new.handle) where body ~* pat;
  update public.lounge_messages set body = public.rename_mentions(body, old.handle, new.handle) where body ~* pat;
  update public.drafts set title = public.rename_mentions(title, old.handle, new.handle), body = public.rename_mentions(body, old.handle, new.handle)
    where title ~* pat or body ~* pat;
  update public.wiki_articles set body = public.rename_mentions(body, old.handle, new.handle) where body ~* pat;
  update public.wiki_revisions set body = public.rename_mentions(body, old.handle, new.handle) where body ~* pat;
  update public.wiki_talk set body = public.rename_mentions(body, old.handle, new.handle) where body ~* pat;
  update public.society_posts set body = public.rename_mentions(body, old.handle, new.handle) where body ~* pat;
  update public.teams set description = public.rename_mentions(description, old.handle, new.handle) where description ~* pat;
  update public.notifications set snippet = public.rename_mentions(snippet, old.handle, new.handle) where snippet ~* pat;
  return null;
end $$;
create trigger profile_handle_changed after update of handle on public.profiles
  for each row execute function public.tg_profile_handle_changed();

-- New @old-handle mentions still notify the person while the old handle is held.
create or replace function public.notify_mentions(p_body text, p_actor uuid, p_text text, p_route text,
  p_thread bigint default null, p_reply bigint default null, p_msg bigint default null)
returns void language plpgsql security definer set search_path = '' as $$
declare h text; uid uuid;
begin
  for h in select distinct rtrim(lower(m[1]), '.') from regexp_matches(p_body, '@([a-zA-Z0-9][a-zA-Z0-9._]{2,23})', 'g') as m loop
    select id into uid from public.profiles where handle = h;
    if uid is null then
      select user_id into uid from public.handle_history where handle = h and released_at > now();
    end if;
    if uid is not null and not (p_reply is not null and exists (
      select 1 from public.notifications where user_id = uid and reply_id = p_reply)) then
      perform public.notify(uid, 'mention', p_actor, p_text, p_route, p_body, p_thread, p_reply, p_msg);
    end if;
  end loop;
end $$;
revoke execute on function public.notify_mentions(text, uuid, text, text, bigint, bigint, bigint) from anon, authenticated, public;
