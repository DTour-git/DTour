-- No passwords on DTour accounts (#30).
--
-- Sign-in is Google or a 6-digit email code (AGENTS.md), but Supabase's email
-- provider also accepts POST /auth/v1/signup with a password. The DTU-only
-- checks look at the address, not who owns the mailbox. supabase/config.toml
-- now turns email confirmations on, so a password sign-up for a classmate's
-- address no longer signs anyone in. But when the real student later signs in
-- with a code, that confirms the address, and the attacker's password would
-- still be on the account.
--
-- So no auth user keeps a password: whatever is written (POST /signup, the
-- admin API, updateUser, a password reset) is cleared before the row is saved,
-- and password sign-in always fails. The row itself can't be refused instead:
-- Supabase Auth gives users created by an email-code request a random password
-- too, so refusing passwords would block code sign-ups.

create or replace function public.strip_auth_password()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.encrypted_password := '';
  return new;
end $$;
revoke execute on function public.strip_auth_password() from public, anon, authenticated;

create trigger strip_auth_password before insert or update of encrypted_password on auth.users
  for each row execute function public.strip_auth_password();

-- Accounts created before this migration may already carry one.
update auth.users set encrypted_password = '' where coalesce(encrypted_password, '') <> '';
