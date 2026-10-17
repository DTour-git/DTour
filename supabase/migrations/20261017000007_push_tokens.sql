-- Expo push tokens are private to their owner. The push Edge Function uses
-- its service role to read them after a notification is inserted.
create table public.device_push_tokens (
  token text primary key check (token ~ '^Expo(nent)?PushToken\\[[^]]+\\]$'),
  user_id uuid not null references public.profiles on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);
create index on public.device_push_tokens (user_id);
alter table public.device_push_tokens enable row level security;
create policy "read own push tokens" on public.device_push_tokens for select to authenticated using (user_id = auth.uid());
create policy "register own push token" on public.device_push_tokens for insert to authenticated with check (user_id = auth.uid());
create policy "refresh own push token" on public.device_push_tokens for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete own push token" on public.device_push_tokens for delete to authenticated using (user_id = auth.uid());
grant select, insert, update, delete on public.device_push_tokens to authenticated;
