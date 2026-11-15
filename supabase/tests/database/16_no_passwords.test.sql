-- No passwords on DTour accounts (#30): sign-in is Google or an email code, so
-- a password set at sign-up (or later) is never kept.
begin;
\ir 00_helpers.sql
select plan(5);

-- A password sign-up, as Supabase Auth writes it: the account is created
-- (an email-code sign-up looks the same), but the hash is dropped.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-4000-8000-0000000a0030', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'name_2k24co030@dtu.ac.in', extensions.crypt('attacker-password', extensions.gen_salt('bf')),
  '{"provider":"email","providers":["email"]}', '{}', now(), now());
select is((select encrypted_password from auth.users where id = '00000000-0000-4000-8000-0000000a0030'), '',
  'a password given at sign-up is not stored');
select is((select count(*) from public.profiles where id = '00000000-0000-4000-8000-0000000a0030'), 1::bigint,
  'the account itself is still created');

-- Setting a password later (updateUser, password reset) is dropped too.
update auth.users set encrypted_password = extensions.crypt('new-password', extensions.gen_salt('bf'))
where id = '00000000-0000-4000-8000-0000000a0030';
select is((select encrypted_password from auth.users where id = '00000000-0000-4000-8000-0000000a0030'), '',
  'a password set later is not stored');

-- Confirming the address (what an email-code sign-in does) still works.
update auth.users set email_confirmed_at = now() where id = '00000000-0000-4000-8000-0000000a0030';
select ok((select email_confirmed_at is not null from auth.users where id = '00000000-0000-4000-8000-0000000a0030'),
  'confirming the email still works');

select is((select count(*) from auth.users where coalesce(encrypted_password, '') <> ''), 0::bigint,
  'no account has a password');

select * from finish();
rollback;
