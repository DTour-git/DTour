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

-- A suggested edit by a departed student can still be approved: the activity
-- row needs a user, and review_wiki_article matches a guide's first revision
-- to its starter, both of which are now null.
create or replace function public.tg_wiki_revision()
returns trigger language plpgsql security definer set search_path = '' as $$
declare a record;
begin
  if new.status <> 'published' or (tg_op = 'UPDATE' and old.status = 'published') then return null; end if;
  update public.wiki_articles set
    body = coalesce(new.body, body),
    updated_at = now(),
    editor_count = greatest(editor_count, (select count(distinct editor_id) from public.wiki_revisions where article_id = new.article_id and status = 'published'))
  where id = new.article_id returning * into a;
  if new.editor_id is not null and not exists (select 1 from public.profiles where id = new.editor_id and is_demo) then
    insert into public.activities (user_id, kind, kicker, title, meta, route)
    values (new.editor_id, 'wiki_edit', 'Edited wiki · ' || coalesce((select name from public.boards where id = a.board_id), 'Wiki'),
            a.title || ' — ' || new.summary,
            case when new.delta_words is not null then (case when new.delta_words >= 0 then '+' else '−' end) || abs(new.delta_words) || ' words' end,
            '/wiki/' || a.slug);
  end if;
  return null;
end $$;

create or replace function public.review_wiki_article(p_article bigint, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare a record;
begin
  if not public.is_moderator() then raise exception 'Only moderators can review articles'; end if;

  -- The row lock makes a second, concurrent call wait and then find the guide
  -- no longer pending.
  update public.wiki_articles set status = case when p_approve then 'published' else 'rejected' end,
    reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_note
  where id = p_article and status = 'pending'
  returning id, started_by, body into a;
  if not found then raise exception 'This guide is not waiting for review'; end if;

  if p_approve then
    -- Publishing the revision applies its body (tg_wiki_revision), so it has
    -- to match the body the moderator approved.
    update public.wiki_revisions set status = 'published', reviewed_by = auth.uid(), reviewed_at = now()
    where id = (select r.id from public.wiki_revisions r
                where r.article_id = a.id and r.editor_id is not distinct from a.started_by and r.status = 'suggested'
                  and coalesce(r.body, a.body) = a.body
                order by r.id limit 1);
  end if;
end $$;

-- ── Delete my account ─────────────────────────────────────────────────────
-- A client can't delete auth.users itself, so this runs as the function owner.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  -- Leave teams first: tg_team_member_left reopens the roles they filled, which
  -- the cascade can't, because it clears team_roles.filled_by before it runs.
  delete from public.team_members where user_id = auth.uid();
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
