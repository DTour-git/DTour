-- RSVP event reminders (#8): pg_cron runs enqueue_event_reminders() every 15 minutes,
-- which notifies each RSVP'd student once, about 30 minutes before an event.
begin;
\ir 00_helpers.sql
select plan(14);

insert into public.societies (id, slug, name) values
  ('00000000-0000-4000-8000-0000000c2601', 'reminder-test', 'Reminder Test');

-- 92601 is the one that qualifies. The rest must be skipped: a recruiting post,
-- an event with no start time, one too soon, one too far off, and a demo one.
insert into public.society_posts (id, society_id, author_id, kind, title, when_label, starts_at, is_demo)
overriding system value values
  (92601, '00000000-0000-4000-8000-0000000c2601', '00000000-0000-4000-8000-00000000e2e2', 'event',      'Reminder event',     'x', now() + interval '40 minutes', false),
  (92602, '00000000-0000-4000-8000-0000000c2601', '00000000-0000-4000-8000-00000000e2e2', 'recruiting', 'Reminder recruiting', 'x', now() + interval '40 minutes', false),
  (92603, '00000000-0000-4000-8000-0000000c2601', '00000000-0000-4000-8000-00000000e2e2', 'event',      'Reminder no date',   'x', null,                          false),
  (92604, '00000000-0000-4000-8000-0000000c2601', '00000000-0000-4000-8000-00000000e2e2', 'event',      'Reminder too soon',  'x', now() + interval '10 minutes', false),
  (92605, '00000000-0000-4000-8000-0000000c2601', '00000000-0000-4000-8000-00000000e2e2', 'event',      'Reminder too far',   'x', now() + interval '60 minutes', false),
  (92606, '00000000-0000-4000-8000-0000000c2601', '00000000-0000-4000-8000-00000000e2e2', 'event',      'Reminder demo',      'x', now() + interval '40 minutes', true);
insert into public.rsvps (post_id, user_id)
select id, '00000000-0000-4000-8000-00000000e2e1' from public.society_posts where id between 92601 and 92606;

select has_extension('pg_cron', 'pg_cron is enabled');
select results_eq(
  $$select schedule, command, active from cron.job where jobname = 'dtour-event-reminders'$$,
  $$values ('*/15 * * * *', 'select public.enqueue_event_reminders()', true)$$,
  'the reminder job is active and runs every 15 minutes');
select is((select count(*) from cron.job where jobname = 'dtour-event-reminders'), 1::bigint, 'there is only one reminder job');

select cmp_ok(public.enqueue_event_reminders(), '>=', 1, 'the first run sends the reminder');
select is((select count(*) from public.notifications
           where user_id = '00000000-0000-4000-8000-00000000e2e1' and kind = 'event_reminder'), 1::bigint,
  'the RSVP student has one reminder in the bell');
select is((select route from public.notifications
           where user_id = '00000000-0000-4000-8000-00000000e2e1' and kind = 'event_reminder'), '/societies',
  'it links to the societies page');
select is((select text from public.notifications
           where user_id = '00000000-0000-4000-8000-00000000e2e1' and kind = 'event_reminder'),
  'Reminder event starts in about 30 minutes', 'it names the event');
select is((select count(*) from public.event_reminder_deliveries
           where post_id = 92601 and user_id = '00000000-0000-4000-8000-00000000e2e1'), 1::bigint,
  'the delivery is recorded');

select is(public.enqueue_event_reminders(), 0, 'running again sends nothing');
select is((select count(*) from public.notifications
           where user_id = '00000000-0000-4000-8000-00000000e2e1' and kind = 'event_reminder'), 1::bigint,
  'so the bell still has exactly one reminder');
select is((select count(*) from public.event_reminder_deliveries where post_id between 92602 and 92606), 0::bigint,
  'recruiting, undated, too-soon, too-far and demo posts get no reminder');

select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', $q$select count(*) from public.event_reminder_deliveries$q$), '42501',
  'students cannot read the delivery log');
select is(pg_temp.try_as('authenticated', '00000000-0000-4000-8000-00000000e2e1', $q$select public.enqueue_event_reminders()$q$), '42501',
  'students cannot run the reminder job');
select is(pg_temp.try_as('anon', null, $q$select public.enqueue_event_reminders()$q$), '42501',
  'visitors cannot run it either');

select * from finish();
rollback;
