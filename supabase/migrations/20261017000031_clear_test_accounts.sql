-- The pre-launch cleanup also removes the dev test accounts (#60).
--
-- supabase/dev/fixtures.sql creates e2e.student and e2e.moderator (role
-- moderator) with is_demo = false, so their triggers behave as for real
-- students. dtour_clear_demo() deleted only is_demo rows, so if the fixtures
-- ever reached a project that later went live, a known moderator account would
-- survive the documented cleanup. It now also deletes every account at
-- @dtour.invalid: the .invalid domain is reserved (RFC 2606) and can never be a
-- real student's address, and the fixtures use it for exactly this reason.
-- Otherwise unchanged from 20261017000002.
create or replace function public.dtour_clear_demo()
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.lounge_messages where is_demo;
  delete from public.campus_events where is_demo;
  delete from public.threads where is_demo;
  delete from public.wiki_articles where is_demo;
  delete from public.library_items where is_demo;
  delete from public.society_posts where is_demo;
  delete from public.teams where is_demo;
  delete from public.deadlines where is_demo;
  delete from public.places where is_demo;
  delete from public.societies where is_demo;
  delete from auth.users where id in (select id from public.profiles where is_demo);
  delete from auth.users where lower(email) like '%@dtour.invalid';
  update public.boards set thread_count = (select count(*) from public.threads t where t.board_id = boards.id),
                           post_count = (select count(*) from public.threads t where t.board_id = boards.id)
                                      + (select count(*) from public.replies r join public.threads t on t.id = r.thread_id where t.board_id = boards.id);
end $$;
revoke execute on function public.dtour_clear_demo() from authenticated, anon, public;
