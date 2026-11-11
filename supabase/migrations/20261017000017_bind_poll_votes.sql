begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

lock table public.poll_options, public.poll_votes in share row exclusive mode;

-- Remove legacy rows that attributed an option's vote to a different poll.
delete from public.poll_votes v
using public.poll_options o
where v.option_id = o.id and v.thread_id <> o.thread_id;

alter table public.poll_options
  add constraint poll_options_id_thread_id_key unique (id, thread_id);

alter table public.poll_votes
  drop constraint poll_votes_option_id_fkey,
  add constraint poll_votes_option_id_fkey foreign key (option_id, thread_id)
    references public.poll_options (id, thread_id) on delete cascade,
  add constraint poll_votes_option_user_key unique (option_id, user_id);

-- Rebuild real totals from valid rows; demo totals are authored fixtures.
update public.poll_options o
set votes = (select count(*) from public.poll_votes v where v.option_id = o.id)
where exists (select 1 from public.threads t where t.id = o.thread_id and not t.is_demo);

commit;
