begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Clients may complete onboarding but cannot reset it to bypass handle rules.
create or replace function public.tg_profile_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' then
    new.karma := old.karma; new.thread_count := old.thread_count; new.reply_count := old.reply_count;
    new.accepted_count := old.accepted_count; new.upload_count := old.upload_count;
    new.download_count := old.download_count; new.is_demo := old.is_demo; new.created_at := old.created_at;
    new.role := old.role; new.handle_changed_at := old.handle_changed_at;
    new.onboarded := old.onboarded or new.onboarded;
  end if;
  return new;
end $$;

-- A server-owned clock also protects profiles whose flag was previously cleared.
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
  if old.onboarded or old.handle_changed_at is not null then
    if old.handle_changed_at > now() - interval '7 days' then
      raise exception 'You can change your handle again on %.', to_char((old.handle_changed_at + interval '7 days') at time zone 'Asia/Kolkata', 'DD Mon')
        using errcode = 'check_violation';
    end if;
    new.handle_changed_at := now();
  end if;
  return new;
end $$;

create or replace function public.tg_profile_handle_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
declare pat text := '(^|[^a-zA-Z0-9._@])@' || replace(old.handle, '.', '\.') || '(?![a-zA-Z0-9_]|\.[a-zA-Z0-9_])';
begin
  if new.handle = old.handle then return null; end if;
  -- Going back to a recent old handle: it's yours again, not "held".
  delete from public.handle_history where handle = new.handle and user_id = new.id;
  if not old.onboarded and old.handle_changed_at is null then return null; end if;

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

revoke execute on function public.tg_profile_guard(), public.tg_profile_handle_check(),
  public.tg_profile_handle_changed() from anon, authenticated, public;

commit;
