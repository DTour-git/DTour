-- At most 10 people are notified per post for @mentions (#40).
--
-- notify_mentions() sent a notification (and with it a realtime event and a
-- phone push) to every @handle in a body. A 10,000-character reply could name
-- about 700 people, and posting it again did it again. Now only the first 10
-- distinct people mentioned, in the order they appear, are notified. Handles
-- that don't resolve to anyone, repeats (including someone's old and new
-- handle) and the author's own handle don't use up a place. Posting rate limits
-- are a separate issue (#13).
--
-- Otherwise unchanged from 20261017000012: a handle changed recently still
-- reaches its owner through handle_history, and someone already notified about
-- the same reply isn't notified twice. Same signature, so the thread, reply and
-- Lounge triggers keep calling it.
create or replace function public.notify_mentions(p_body text, p_actor uuid, p_text text, p_route text,
  p_thread bigint default null, p_reply bigint default null, p_msg bigint default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  h text;
  uid uuid;
  seen uuid[] := '{}';
begin
  for h in
    select m.handle from (
      select rtrim(lower(x.match[1]), '.') as handle, min(x.n) as first_at
      from regexp_matches(coalesce(p_body, ''), '@([a-zA-Z0-9][a-zA-Z0-9._]{2,23})', 'g') with ordinality as x(match, n)
      group by 1
    ) m order by m.first_at
  loop
    select id into uid from public.profiles where handle = h;
    if uid is null then
      select user_id into uid from public.handle_history where handle = h and released_at > now();
    end if;
    continue when uid is null or uid = p_actor or uid = any(seen);
    seen := seen || uid;
    exit when cardinality(seen) > 10;
    if not (p_reply is not null and exists (
      select 1 from public.notifications where user_id = uid and reply_id = p_reply)) then
      perform public.notify(uid, 'mention', p_actor, p_text, p_route, p_body, p_thread, p_reply, p_msg);
    end if;
  end loop;
end $$;
revoke execute on function public.notify_mentions(text, uuid, text, text, bigint, bigint, bigint) from anon, authenticated, public;
