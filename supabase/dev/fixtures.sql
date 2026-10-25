-- DEV ONLY. Test accounts for end-to-end and database tests, applied after seed.sql
-- by `npm run db:dev:reset` and `npm run test:db`. Never run this against production.
-- Unlike the demo users these are is_demo = false, so notifications and triggers
-- behave exactly as they do for real students.

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-4000-8000-00000000e2e1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'e2e.student@dtour.invalid', '', now(), '{"provider":"email","providers":["email"],"dtour_seed":true}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-4000-8000-00000000e2e2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'e2e.moderator@dtour.invalid', '', now(), '{"provider":"email","providers":["email"],"dtour_seed":true}', '{}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

insert into public.profiles (id, handle, branch_code, grad_year, semester, tint, bio, onboarded, is_demo, role)
values
  ('00000000-0000-4000-8000-00000000e2e1', 'e2e.student', 'COE', 2028, 3, 'accent', 'Automated test account.', true, false, 'member'),
  ('00000000-0000-4000-8000-00000000e2e2', 'e2e.moderator', 'IT', 2027, 5, 'accent2', 'Automated test moderator.', true, false, 'moderator')
on conflict (id) do update set role = excluded.role, onboarded = true, is_demo = false;

-- pgTAP powers supabase/tests/database/*.test.sql
create extension if not exists pgtap with schema extensions;
