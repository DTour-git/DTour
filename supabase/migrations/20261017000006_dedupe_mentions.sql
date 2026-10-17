-- Don't send a "mention" when the same reply already notified that person.
create or replace function public.notify_mentions(p_body text, p_actor uuid, p_text text, p_route text,
  p_thread bigint default null, p_reply bigint default null, p_msg bigint default null)
returns void language plpgsql security definer set search_path = '' as $$
declare h text; uid uuid;
begin
  for h in select distinct lower(m[1]) from regexp_matches(p_body, '@([a-zA-Z0-9][a-zA-Z0-9._]{2,23})', 'g') as m loop
    select id into uid from public.profiles where handle = rtrim(h, '.');
    if uid is not null and not (p_reply is not null and exists (
      select 1 from public.notifications where user_id = uid and reply_id = p_reply)) then
      perform public.notify(uid, 'mention', p_actor, p_text, p_route, p_body, p_thread, p_reply, p_msg);
    end if;
  end loop;
end $$;
revoke execute on function public.notify_mentions(text, uuid, text, text, bigint, bigint, bigint) from anon, authenticated, public;
