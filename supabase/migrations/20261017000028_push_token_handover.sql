-- A phone's push token moves to whoever signs in on it (#44), and real Expo
-- tokens pass the table's format check (they never did; see the end).
--
-- A push token belongs to an app installation, not a person. When a second
-- student signed in on a phone, the app's upsert of the same token hit the row
-- still owned by the first, RLS refused the update, the app swallowed the
-- error, and the phone kept receiving the first student's notifications.
--
-- register_push_token() saves the token for the caller whoever held it before.
-- Holding the token is the proof: Expo issues it only to that installation.
-- The apps also delete it on sign-out now, while the session can still do so.
create or replace function public.register_push_token(p_token text, p_platform text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in to turn on phone alerts'; end if;
  insert into public.device_push_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), p_platform, now())
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = excluded.updated_at;
end $$;
revoke execute on function public.register_push_token(text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;

-- The token check from 20261017000007 escaped its brackets twice ('\\['), so it
-- looked for a literal backslash and refused every real Expo token
-- (ExponentPushToken[…]): no phone could ever register. Check the real format.
alter table public.device_push_tokens drop constraint device_push_tokens_token_check;
alter table public.device_push_tokens add constraint device_push_tokens_token_check
  check (token ~ '^Expo(nent)?PushToken\[[^]]+\]$');
