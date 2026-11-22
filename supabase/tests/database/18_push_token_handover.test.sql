-- Push tokens (#44): a phone's token moves to whoever signs in on it, and stays
-- private to its owner. e2e1 and e2e2 share a phone; profile 2 is someone else.
begin;
\ir 00_helpers.sql
select plan(11);

-- The first student turns on phone alerts.
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $$select public.register_push_token('ExponentPushToken[shared-phone]', 'android')$$), 'ok', 'a student can register their phone');
select is((select user_id from public.device_push_tokens where token = 'ExponentPushToken[shared-phone]'),
  '00000000-0000-4000-8000-00000000e2e1'::uuid, 'the token is theirs');

-- The old way of re-registering (a plain upsert) is what failed for the next student.
select isnt(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  $$insert into public.device_push_tokens (token, user_id, platform) values ('ExponentPushToken[shared-phone]', '00000000-0000-4000-8000-00000000e2e2', 'android')
    on conflict (token) do update set user_id = excluded.user_id$$), 'ok', 'a direct upsert of someone else''s token is still refused');

-- The next student on the same phone gets it.
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  $$select public.register_push_token('ExponentPushToken[shared-phone]', 'android')$$), 'ok', 'the next student on the phone can register it');
select is((select user_id from public.device_push_tokens where token = 'ExponentPushToken[shared-phone]'),
  '00000000-0000-4000-8000-00000000e2e2'::uuid, 'the token now belongs to the next student');
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $$select count(*) from public.device_push_tokens where token = 'ExponentPushToken[shared-phone]'$$), 0::bigint,
  'the first student no longer has it');

-- Tokens stay private, visitors can't register, and bad values are refused.
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-000000000002',
  'select count(*) from public.device_push_tokens'), 0::bigint, 'nobody else can see the token');
select isnt(pg_temp.try_as('anon', null,
  $$select public.register_push_token('ExponentPushToken[visitor]', 'ios')$$), 'ok', 'a visitor cannot register a token');
select isnt(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $$select public.register_push_token('not-a-token', 'android')$$), 'ok', 'a malformed token is refused');

-- Both formats Expo issues are accepted (the old check refused every real token).
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $$select public.register_push_token('ExpoPushToken[xXxXxXxXxXxXxXxXxXxXxX]', 'ios')$$), 'ok', 'an ExpoPushToken is accepted');
select isnt(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $$select public.register_push_token('ExponentPushToken\\[x\\]', 'ios')$$), 'ok', 'a token with backslashes is refused');

select * from finish();
rollback;
