-- A suspension survives deleting the account (#132, follow-up to #14 and #64).
--
-- suspensions.user_id cascaded from profiles, and a suspended member may delete their
-- account. So deleting it wiped the suspension and its log entry, and the member could
-- sign straight back up with the same @dtu.ac.in address (and the same handle, which
-- deletion releases) as an unsuspended student.
--
-- Decision for #132: deleting stays allowed while suspended. The active suspension is
-- kept, tied to the email address, so it applies again on re-signup and stays in the
-- moderators' log. Only what that needs is stored:
--   * The suspension row itself stays, with user_id set to null and the handle it had
--     (former_handle), so /mod shows "@handle (account deleted)" and a moderator can
--     still lift it.
--   * suspension_carryovers holds the SHA-256 of the normalised (trimmed, lower-cased)
--     email for that row and nothing else. It is private: no client role can read or
--     write it, moderators included.
--   * Past suspensions (lifted or ended) are deleted with the account, as before.
--   * A kept row is deleted, and its hash with it, once it is no longer in force:
--     lifted by a moderator (at once), or past its end date (the next time anyone
--     deletes their account or signs up). A row for an
--     indefinite suspension stays until it is lifted or the student signs up again.
-- When an auth user with the same email signs up again, the row moves to the new profile
-- (user_id set, former_handle cleared) and the hash is deleted. The profile is marked
-- onboarded, because a suspended member can't edit their profile and would otherwise be
-- stuck on /onboarding, unable to read. It gets the old handle back if nobody else has
-- taken it.
-- Both triggers sit on auth.users, so a maintainer deleting a user in the dashboard is
-- covered too. The hash is plain, not keyed: DTU addresses are guessable from roll
-- numbers, and a key stored in this same database wouldn't add any protection.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.suspensions alter column user_id drop not null;
alter table public.suspensions drop constraint suspensions_user_id_fkey,
  add constraint suspensions_user_id_fkey foreign key (user_id) references public.profiles(id) on delete set null;
alter table public.suspensions add column former_handle text;

create table public.suspension_carryovers (
  suspension_id bigint primary key references public.suspensions on delete cascade,
  email_sha256  bytea not null
);
create index on public.suspension_carryovers (email_sha256);
alter table public.suspension_carryovers enable row level security;  -- no policies: only the triggers below touch it
revoke all on public.suspension_carryovers from public, anon, authenticated;

create or replace function public.email_sha256(p_email text)
returns bytea language sql immutable set search_path = '' as $$
  select extensions.digest(lower(trim(p_email)), 'sha256')
$$;
revoke execute on function public.email_sha256(text) from public, anon, authenticated;

-- Kept rows of deleted accounts that are no longer in force go, with their hash. So do
-- rows left without a hash (a profile deleted without its auth user): nothing can
-- bring them back.
create or replace function public.prune_kept_suspensions()
returns void language sql security definer set search_path = '' as $$
  delete from public.suspensions s
  where s.user_id is null
    and (s.lifted_at is not null or s.ends_at <= now()
         or not exists (select 1 from public.suspension_carryovers c where c.suspension_id = s.id))
$$;
revoke execute on function public.prune_kept_suspensions() from public, anon, authenticated;

-- ── Keep the active suspension when the account goes ──────────────────────
create or replace function public.tg_keep_suspension()
returns trigger language plpgsql security definer set search_path = '' as $$
declare kept bigint;
begin
  perform public.prune_kept_suspensions();
  select s.id into kept from public.suspensions s
  where s.user_id = old.id and s.lifted_at is null and (s.ends_at is null or s.ends_at > now())
  order by s.created_at desc limit 1;
  -- Everything else about this member goes with the account, as before.
  delete from public.suspensions where user_id = old.id and id is distinct from kept;
  if kept is not null then
    update public.suspensions set former_handle = (select handle from public.profiles where id = old.id) where id = kept;
    if old.email is not null then
      insert into public.suspension_carryovers (suspension_id, email_sha256) values (kept, public.email_sha256(old.email));
    end if;
  end if;
  return old;  -- deleting the profile then sets user_id to null on the kept row
end $$;
create trigger keep_suspension before delete on auth.users
  for each row execute function public.tg_keep_suspension();

-- ── Put it back when the same email signs up again ────────────────────────
create or replace function public.tg_restore_suspension()
returns trigger language plpgsql security definer set search_path = '' as $$
declare s record;
begin
  perform public.prune_kept_suspensions();
  if new.email is null or not exists (select 1 from public.profiles where id = new.id) then return null; end if;
  select k.id, k.former_handle into s
  from public.suspension_carryovers c join public.suspensions k on k.id = c.suspension_id
  where c.email_sha256 = public.email_sha256(new.email) and k.user_id is null
  order by k.created_at desc limit 1;
  if not found then return null; end if;

  update public.profiles set onboarded = true,
    handle = case when s.former_handle is not null and public.handle_status(s.former_handle) = 'available'
                  then s.former_handle else handle end
  where id = new.id;
  update public.suspensions set user_id = new.id, former_handle = null where id = s.id;
  delete from public.suspension_carryovers where email_sha256 = public.email_sha256(new.email);
  return null;
end $$;
-- Trigger names fire in alphabetical order: after on_auth_user_created made the profile.
create trigger restore_suspension after insert on auth.users
  for each row execute function public.tg_restore_suspension();

-- A moderator lifting a deleted member's kept suspension ends the need to keep it.
create or replace function public.tg_lifted_kept_suspension()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.prune_kept_suspensions();
  return null;
end $$;
create trigger lifted_kept_suspension after update of lifted_at on public.suspensions
  for each row when (new.user_id is null and new.lifted_at is not null)
  execute function public.tg_lifted_kept_suspension();

revoke execute on function public.tg_keep_suspension(), public.tg_restore_suspension(), public.tg_lifted_kept_suspension()
  from public, anon, authenticated;

-- ── Download my data: the suspensions are about you, so they're in it ─────
create or replace function public.export_my_data()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = uid),
    'threads', coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at) from public.threads t where t.author_id = uid), '[]'),
    'replies', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at) from public.replies r where r.author_id = uid), '[]'),
    'thread_votes', coalesce((select jsonb_agg(to_jsonb(v)) from public.thread_votes v where v.user_id = uid), '[]'),
    'reply_votes', coalesce((select jsonb_agg(to_jsonb(v)) from public.reply_votes v where v.user_id = uid), '[]'),
    'poll_votes', coalesce((select jsonb_agg(to_jsonb(v)) from public.poll_votes v where v.user_id = uid), '[]'),
    'suspensions', coalesce((select jsonb_agg(jsonb_build_object('reason', s.reason, 'ends_at', s.ends_at,
                                                                 'created_at', s.created_at, 'lifted_at', s.lifted_at)
                                              order by s.created_at)
                             from public.suspensions s where s.user_id = uid), '[]')
  );
end $$;
revoke execute on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;

commit;
