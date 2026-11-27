-- A suspension survives deleting the account (#132, follow-up to #14 and #64).
--
-- suspensions.user_id cascades from profiles, and a suspended member may delete
-- their account. So deleting the account wiped the suspension, and the member could
-- sign straight back up with the same @dtu.ac.in address (and get the same handle
-- back, since deletion releases it) as an unsuspended student.
--
-- Decision for #132: keep a minimal record across deletion, keyed by the email.
--   * When an auth user with an active suspension is deleted (delete_my_account,
--     or a maintainer in the dashboard), a BEFORE DELETE trigger on auth.users keeps
--     the SHA-256 of the lower-cased email, the handle, and the suspension's reason,
--     end date, moderator and start time in suspension_carryovers.
--   * When an auth user with the same email signs up again, an AFTER INSERT trigger
--     (it fires after on_auth_user_created, which makes the profile) puts the
--     suspension back on the new profile and removes the record. The profile is
--     marked onboarded, since a suspended member can't edit their profile and would
--     otherwise be stuck on /onboarding, unable to read. It gets the old handle back
--     if nobody else has taken it.
--   * A record is kept only while its suspension would still be in force: expired
--     ones are ignored and pruned. A record for an indefinite suspension stays until
--     the student signs up again.
--   * Lifted or expired suspensions aren't carried. A member with no active
--     suspension leaves nothing behind.
-- The table is private: no client role can read or write it. A plain hash, not a
-- keyed one: DTU addresses are guessable from roll numbers either way, and a key
-- stored in the same database wouldn't protect them from anyone who can read this table.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table public.suspension_carryovers (
  id           bigint generated always as identity primary key,
  email_sha256 bytea not null,
  handle       text,
  reason       text not null,
  ends_at      timestamptz,                    -- null: until a moderator lifts it
  created_by   uuid references public.profiles on delete set null,
  suspended_at timestamptz not null,
  kept_at      timestamptz not null default now()
);
create index on public.suspension_carryovers (email_sha256);
alter table public.suspension_carryovers enable row level security;  -- no policies: only the triggers below touch it
revoke all on public.suspension_carryovers from public, anon, authenticated;

create or replace function public.email_sha256(p_email text)
returns bytea language sql immutable set search_path = '' as $$
  select extensions.digest(lower(trim(p_email)), 'sha256')
$$;
revoke execute on function public.email_sha256(text) from public, anon, authenticated;

-- ── Keep the active suspension when the account goes ──────────────────────
create or replace function public.tg_keep_suspension()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.suspension_carryovers where ends_at <= now();
  if old.email is null then return old; end if;
  insert into public.suspension_carryovers (email_sha256, handle, reason, ends_at, created_by, suspended_at)
  select public.email_sha256(old.email), p.handle, s.reason, s.ends_at, s.created_by, s.created_at
  from public.suspensions s join public.profiles p on p.id = s.user_id
  where s.user_id = old.id and s.lifted_at is null and (s.ends_at is null or s.ends_at > now())
  order by s.created_at desc limit 1;
  return old;
end $$;
create trigger keep_suspension before delete on auth.users
  for each row execute function public.tg_keep_suspension();

-- ── Put it back when the same email signs up again ────────────────────────
create or replace function public.tg_restore_suspension()
returns trigger language plpgsql security definer set search_path = '' as $$
declare c record;
begin
  if new.email is null or not exists (select 1 from public.profiles where id = new.id) then return null; end if;
  select * into c from public.suspension_carryovers
  where email_sha256 = public.email_sha256(new.email) and (ends_at is null or ends_at > now())
  order by suspended_at desc limit 1;
  if not found then return null; end if;

  update public.profiles set onboarded = true,
    handle = case when c.handle is not null and public.handle_status(c.handle) = 'available' then c.handle else handle end
  where id = new.id;
  insert into public.suspensions (user_id, reason, ends_at, created_by, created_at)
  values (new.id, c.reason, c.ends_at, c.created_by, c.suspended_at);
  delete from public.suspension_carryovers where email_sha256 = c.email_sha256;
  return null;
end $$;
-- Trigger names fire in alphabetical order: after on_auth_user_created made the profile.
create trigger restore_suspension after insert on auth.users
  for each row execute function public.tg_restore_suspension();

revoke execute on function public.tg_keep_suspension(), public.tg_restore_suspension() from public, anon, authenticated;

commit;
