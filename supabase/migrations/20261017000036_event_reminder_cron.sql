-- Runs public.enqueue_event_reminders() (migration 09) every 15 minutes (#8).
-- The function picks events starting 30-45 minutes out, and
-- event_reminder_deliveries makes repeat runs a no-op. cron.schedule upserts
-- by job name, so this is safe if the job was already created by hand or the
-- migration is replayed.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('dtour-event-reminders', '*/15 * * * *', 'select public.enqueue_event_reminders()');
