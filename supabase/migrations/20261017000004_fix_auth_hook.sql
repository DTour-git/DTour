-- The hook's local variable shadowed allowed_email_domains.domain.
create or replace function public.hook_before_user_created(event jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_email  text := lower(coalesce(event->'user'->>'email', ''));
  v_domain text := split_part(v_email, '@', 2);
begin
  if v_domain <> '' and exists (select 1 from public.allowed_email_domains d where d.domain = v_domain) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'DTour is only for DTU students — sign in with your @dtu.ac.in email.'));
end $$;
