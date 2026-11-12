begin;
\ir 00_helpers.sql
select plan(18);

update public.profiles set handle = 'guard_generated', onboarded = false, handle_changed_at = null
where id = '00000000-0000-4000-8000-00000000e2e1';
delete from public.handle_history where user_id = '00000000-0000-4000-8000-00000000e2e1';

select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$update public.profiles set handle = 'guard_chosen', onboarded = true where id = auth.uid()$q$), 'ok', 'onboarding can choose a handle');
select is((select handle_changed_at from public.profiles where handle = 'guard_chosen'), null::timestamptz, 'onboarding does not start the cooldown');
select is((select count(*) from public.handle_history where handle = 'guard_generated'), 0::bigint, 'the generated handle is not held');

select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  'update public.profiles set onboarded = false where id = auth.uid()'), 'ok', 'clearing onboarding does not prevent other profile updates');
select ok((select onboarded from public.profiles where handle = 'guard_chosen'), 'completed onboarding cannot be cleared');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$update public.profiles set handle = 'guard_first' where id = auth.uid()$q$), 'ok', 'the first post-onboarding rename is allowed');
select is((select handle_changed_at from public.profiles where handle = 'guard_first'), now(), 'the server starts the cooldown');
select is((select released_at from public.handle_history where handle = 'guard_chosen'), now() + interval '30 days', 'the old handle is held for thirty days');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$update public.profiles set handle = 'guard_second' where id = auth.uid()$q$), '23514', 'a second rename is blocked during cooldown');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$update public.profiles set onboarded = false, handle = 'guard_second' where id = auth.uid()$q$), '23514', 'clearing onboarding in the rename cannot bypass cooldown');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  'update public.profiles set onboarded = false, handle_changed_at = null where id = auth.uid()'), 'ok', 'client clock changes are ignored');
select is((select handle_changed_at from public.profiles where handle = 'guard_first'), now(), 'the client cannot clear the server clock');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  $q$update public.profiles set handle = 'guard_chosen' where id = auth.uid()$q$), '23514', 'another student cannot claim a held handle');

-- Model a profile whose flag was cleared before this fix was deployed.
update public.profiles set onboarded = false where handle = 'guard_first';
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$update public.profiles set handle = 'guard_second' where id = auth.uid()$q$), '23514', 'the server clock also protects legacy incomplete profiles');
update public.profiles set handle_changed_at = now() - interval '7 days' where handle = 'guard_first';
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  $q$update public.profiles set handle = 'guard_second' where id = auth.uid()$q$), 'ok', 'a rename is allowed when seven days have elapsed');
select is((select handle_changed_at from public.profiles where handle = 'guard_second'), now(), 'a legacy incomplete profile restarts the server clock');
select is((select released_at from public.handle_history where handle = 'guard_first'), now() + interval '30 days', 'a legacy incomplete profile still holds its old handle');
select is(public.current_handle('guard_first'), 'guard_second', 'old handle links resolve to the renamed profile');

select * from finish();
rollback;
