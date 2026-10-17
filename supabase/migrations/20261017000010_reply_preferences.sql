-- Thread authors can opt out of reply notifications per post. Mentions and
-- replies to their own comments remain separate notifications.
alter table public.threads
  add column notify_on_reply boolean not null default true;

create or replace function public.tg_notify_reply()
returns trigger language plpgsql security definer set search_path = '' as $$
declare t record; parent_author uuid;
begin
  if new.is_demo then return null; end if;
  select id, author_id, title, notify_on_reply into t from public.threads where id = new.thread_id;
  if new.parent_id is not null then
    select author_id into parent_author from public.replies where id = new.parent_id;
    perform public.notify(parent_author, 'comment', new.author_id, 'replied to your comment on "' || t.title || '"', '/t/' || t.id, new.body, t.id, new.id);
  end if;
  if t.notify_on_reply and parent_author is distinct from t.author_id then
    perform public.notify(t.author_id, 'reply', new.author_id, 'replied to "' || t.title || '"', '/t/' || t.id, new.body, t.id, new.id);
  end if;
  perform public.notify_mentions(new.body, new.author_id, 'mentioned you in "' || t.title || '"', '/t/' || t.id, t.id, new.id);
  return null;
end $$;
