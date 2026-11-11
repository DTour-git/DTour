-- Use database time for member posts while preserving trusted seed timestamps.
create or replace function public.tg_thread_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' then
      new.score := 0; new.reply_count := 0; new.accepted_reply_id := null; new.is_demo := false; new.edited_at := null;
      new.created_at := now(); new.updated_at := now();
      new.poll_closes_at := case when new.kind = 'poll'
        then greatest(now(), least(coalesce(new.poll_closes_at, now() + interval '72 hours'), now() + interval '168 hours'))
        else null end;
    else
      new.score := old.score; new.reply_count := old.reply_count; new.is_demo := old.is_demo;
      new.accepted_reply_id := old.accepted_reply_id;  -- use accept_reply()
      new.board_id := old.board_id; new.kind := old.kind; new.society_id := old.society_id;
      new.created_at := old.created_at;
      new.updated_at := now();
      new.poll_closes_at := old.poll_closes_at;
      new.edited_at := case when new.title is distinct from old.title or new.body is distinct from old.body
                            then now() else old.edited_at end;
    end if;
  end if;
  return new;
end $$;

create or replace function public.tg_reply_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' then
      new.score := 0; new.is_demo := false; new.edited_at := null; new.deleted_at := null;
      new.created_at := now();
    else
      if old.deleted_at is not null then raise exception 'This reply was deleted'; end if;
      new.score := old.score; new.is_demo := old.is_demo; new.created_at := old.created_at;
      new.thread_id := old.thread_id; new.parent_id := old.parent_id; new.society_id := old.society_id;
      if new.deleted_at is not null then
        new.deleted_at := now(); new.body := '[deleted]'; new.edited_at := old.edited_at;
      else
        new.edited_at := case when new.body is distinct from old.body then now() else old.edited_at end;
      end if;
    end if;
  end if;
  return new;
end $$;

-- Bring existing future-dated posts back into chronological order.
update public.threads
set created_at = least(created_at, updated_at, now()), updated_at = least(updated_at, now())
where not is_demo and (created_at > now() or updated_at > now());

update public.replies
set created_at = now()
where not is_demo and created_at > now();
