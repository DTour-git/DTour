-- Wiki talk can be limited, deleted and reported like other posts (#55).
--
-- wiki_talk took any body from any member, with no length limit, and had no
-- UPDATE or DELETE policy and no report target, so neither the author, a
-- moderator nor the report queue could remove a talk post. Now:
--   - a talk post is 1–2000 characters (existing rows are left alone);
--   - its author, or a moderator, can delete it;
--   - it can be reported, and resolve_report() removes or dismisses it like a
--     Lounge message.

alter table public.wiki_talk add constraint wiki_talk_body_length
  check (char_length(btrim(body)) between 1 and 2000) not valid;

create policy "delete own talk, or any as a moderator" on public.wiki_talk for delete to authenticated
  using (author_id = auth.uid() or public.is_moderator());
grant delete on public.wiki_talk to authenticated;

-- Reports gain a fourth target.
alter table public.reports add column wiki_talk_id bigint references public.wiki_talk on delete cascade;
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.reports'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%num_nonnulls%'
  loop
    execute format('alter table public.reports drop constraint %I', c);
  end loop;
end $$;
alter table public.reports add constraint reports_one_target
  check (num_nonnulls(thread_id, reply_id, lounge_message_id, wiki_talk_id) = 1);
create unique index reports_once_talk on public.reports (reporter_id, wiki_talk_id) where wiki_talk_id is not null;

-- As in 20261017000011, plus the wiki_talk target.
create or replace function public.resolve_report(p_report bigint, p_remove boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  if not public.is_moderator() then raise exception 'Moderators only'; end if;
  select * into r from public.reports where id = p_report;
  if r is null then raise exception 'Report not found'; end if;
  if not p_remove then
    update public.reports set status = 'dismissed', reviewed_by = auth.uid(), reviewed_at = now()
    where status = 'open' and thread_id is not distinct from r.thread_id
      and reply_id is not distinct from r.reply_id and lounge_message_id is not distinct from r.lounge_message_id
      and wiki_talk_id is not distinct from r.wiki_talk_id;
    return;
  end if;
  if r.thread_id is not null then
    delete from public.threads where id = r.thread_id;
  elsif r.reply_id is not null then
    if exists (select 1 from public.replies where parent_id = r.reply_id) then
      update public.replies set body = '[removed by a moderator]', deleted_at = now() where id = r.reply_id;
      update public.reports set status = 'removed', reviewed_by = auth.uid(), reviewed_at = now()
      where reply_id = r.reply_id and status = 'open';
    else
      delete from public.replies where id = r.reply_id;
    end if;
  elsif r.wiki_talk_id is not null then
    delete from public.wiki_talk where id = r.wiki_talk_id;
  else
    delete from public.lounge_messages where id = r.lounge_message_id;
  end if;
end $$;
revoke execute on function public.resolve_report(bigint, boolean) from anon, public;
