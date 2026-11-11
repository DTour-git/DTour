begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Finish active vote writes before reconciling their derived scores.
lock table public.thread_votes, public.reply_votes in share row exclusive mode;

create or replace function public.tg_interaction_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- Only vote and feedback values may change within an existing interaction.
  if (to_jsonb(new) - array['value', 'useful']) is distinct from
     (to_jsonb(old) - array['value', 'useful']) then
    raise exception 'An interaction cannot change its owner or target'
      using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function public.tg_interaction_guard() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['thread_votes', 'reply_votes', 'poll_votes', 'saves',
                           'rsvps', 'place_hearts', 'board_members', 'wiki_feedback'] loop
    execute format('create trigger interaction_guard before update on public.%I
                    for each row execute function public.tg_interaction_guard()', t);
  end loop;
end $$;

-- Demo scores are authored fixtures. Real scores come from the remaining votes.
update public.threads t
set score = (select coalesce(sum(v.value), 0) from public.thread_votes v where v.thread_id = t.id)
where not t.is_demo;

update public.replies r
set score = (select coalesce(sum(v.value), 0) from public.reply_votes v where v.reply_id = r.id)
where not r.is_demo;

commit;
