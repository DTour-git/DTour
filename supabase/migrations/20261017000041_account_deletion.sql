-- Students can delete their own account (#14) and download their data.
--
-- Decision: a deleted user's threads, replies, Lounge messages, wiki talk and
-- wiki edits stay, with no author (the app shows "[deleted user]"). Cascading
-- would delete other people's replies under their threads. Everything personal
-- (profile, votes, saves, drafts, push tokens, notifications, karma, activity,
-- memberships, RSVPs, teams they own, reports they filed) already cascades from
-- profiles. Library uploads, society posts and places already set null.
-- The handle is released at once: handle_status() reads profiles, which is gone.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- ── Keep the content, drop the author ─────────────────────────────────────
alter table public.threads         alter column author_id drop not null;
alter table public.replies         alter column author_id drop not null;
alter table public.lounge_messages alter column author_id drop not null;
alter table public.wiki_talk       alter column author_id drop not null;
alter table public.wiki_revisions  alter column editor_id drop not null;

alter table public.threads         drop constraint threads_author_id_fkey,
  add constraint threads_author_id_fkey foreign key (author_id) references public.profiles(id) on delete set null;
alter table public.replies         drop constraint replies_author_id_fkey,
  add constraint replies_author_id_fkey foreign key (author_id) references public.profiles(id) on delete set null;
alter table public.lounge_messages drop constraint lounge_messages_author_id_fkey,
  add constraint lounge_messages_author_id_fkey foreign key (author_id) references public.profiles(id) on delete set null;
alter table public.wiki_talk       drop constraint wiki_talk_author_id_fkey,
  add constraint wiki_talk_author_id_fkey foreign key (author_id) references public.profiles(id) on delete set null;
alter table public.wiki_revisions  drop constraint wiki_revisions_editor_id_fkey,
  add constraint wiki_revisions_editor_id_fkey foreign key (editor_id) references public.profiles(id) on delete set null;

-- Voting on a deleted user's reply must not write karma for nobody
-- (tg_thread_vote already skips a thread with no author).
create or replace function public.tg_reply_vote()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  oldv int := case when tg_op in ('UPDATE','DELETE') then old.value else 0 end;
  newv int := case when tg_op in ('INSERT','UPDATE') then new.value else 0 end;
  rid bigint := coalesce(new.reply_id, old.reply_id);
  r record; up_delta int;
begin
  update public.replies set score = score + (newv - oldv) where id = rid returning author_id, thread_id into r;
  if r.author_id is null then return null; end if;
  up_delta := (case when newv = 1 then 1 else 0 end) - (case when oldv = 1 then 1 else 0 end);
  if up_delta <> 0 and r.author_id is distinct from coalesce(new.user_id, old.user_id) then
    insert into public.karma_events (user_id, bucket, amount, reason)
    select r.author_id, public.root_board_name(t.board_id), 10 * up_delta, 'upvote'
    from public.threads t where t.id = r.thread_id;
  end if;
  return null;
end $$;

-- ── Delete my account ─────────────────────────────────────────────────────
-- A client can't delete auth.users itself, so this runs as the function owner.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ── Download my data ──────────────────────────────────────────────────────
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
    'poll_votes', coalesce((select jsonb_agg(to_jsonb(v)) from public.poll_votes v where v.user_id = uid), '[]')
  );
end $$;
revoke execute on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;

commit;
