-- dtour_clear_demo() (#60) removes the demo content and the dev test accounts,
-- and leaves real students alone. Runs inside a transaction, so nothing is lost.
begin;
\ir 00_helpers.sql
select plan(7);

-- A real student, with a thread of their own.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-4000-8000-0000000d0060', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'realstudent_2k24co060@dtu.ac.in', '', '{"provider":"email","providers":["email"]}', '{}', now(), now());
insert into public.threads (id, board_id, author_id, title, body)
overriding system value values (90601, '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-0000000d0060', 'A real thread', 'body');

select ok((select count(*) from auth.users where email like '%@dtour.invalid') >= 2, 'the test accounts exist before the cleanup');
select is((select role from public.profiles where id = '00000000-0000-4000-8000-00000000e2e2'), 'moderator',
  'one of them is a moderator');

select lives_ok('select public.dtour_clear_demo()', 'the cleanup runs');

select is((select count(*) from auth.users where email like '%@dtour.invalid'), 0::bigint, 'the test accounts are gone');
select is((select count(*) from public.profiles where role = 'moderator'
  and id in ('00000000-0000-4000-8000-00000000e2e1', '00000000-0000-4000-8000-00000000e2e2')), 0::bigint,
  'so is the test moderator''s profile');
select is((select count(*) from public.profiles where is_demo), 0::bigint, 'the demo students are gone, as before');
select is((select count(*) from public.threads where id = 90601), 1::bigint, 'a real student and their thread stay');

select * from finish();
rollback;
