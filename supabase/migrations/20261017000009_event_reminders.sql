-- Called every 15 minutes by pg_cron after deployment. Inserting a normal
-- notification also sends a phone push through the push webhook, if enabled.
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('mention','reply','comment','upvote','accepted','team_request','wiki_review','event_reminder'));

create table public.event_reminder_deliveries (
  post_id bigint not null references public.society_posts on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  delivered_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.event_reminder_deliveries enable row level security;

create or replace function public.enqueue_event_reminders()
returns integer language plpgsql security definer set search_path = '' as $$
declare sent integer;
begin
  with eligible as (
    select r.post_id, r.user_id, p.title, p.starts_at, p.author_id
    from public.rsvps r
    join public.society_posts p on p.id = r.post_id
    join public.profiles u on u.id = r.user_id
    where p.kind <> 'recruiting' and not p.is_demo and not u.is_demo
      and p.starts_at > now() + interval '30 minutes'
      and p.starts_at <= now() + interval '45 minutes'
  ), claimed as (
    insert into public.event_reminder_deliveries (post_id, user_id)
    select post_id, user_id from eligible
    on conflict do nothing
    returning post_id, user_id
  )
  insert into public.notifications (user_id, kind, actor_id, text, route)
  select e.user_id, 'event_reminder', e.author_id,
    e.title || ' starts in about 30 minutes', '/societies'
  from eligible e join claimed c using (post_id, user_id);
  get diagnostics sent = row_count;
  return sent;
end $$;
revoke all on function public.enqueue_event_reminders() from public, anon, authenticated;
