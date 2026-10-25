-- Notifications come from triggers: replies, grouped upvotes and @mentions.
begin;
\ir 00_helpers.sql
select plan(4);

insert into public.threads (id, board_id, author_id, title, body)
overriding system value values (90002, '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-00000000e2e2', 'Notification test thread', 'body');

insert into public.replies (thread_id, author_id, body) values (90002, '00000000-0000-4000-8000-00000000e2e1', 'a reply');
select is((select count(*) from public.notifications where user_id = '00000000-0000-4000-8000-00000000e2e2' and kind = 'reply' and thread_id = 90002),
  1::bigint, 'thread author is notified of a reply');

insert into public.thread_votes values (90002, '00000000-0000-4000-8000-00000000e2e1', 1), (90002, '00000000-0000-4000-8000-000000000003', 1);
select is((select count(*) from public.notifications where user_id = '00000000-0000-4000-8000-00000000e2e2' and kind = 'upvote' and thread_id = 90002),
  1::bigint, 'two upvotes are grouped into one notification');
select is((select count from public.notifications where user_id = '00000000-0000-4000-8000-00000000e2e2' and kind = 'upvote' and thread_id = 90002),
  2, 'the grouped notification counts both voters');

insert into public.lounge_messages (room_slug, author_id, body) values ('global', '00000000-0000-4000-8000-00000000e2e1', 'chai? @e2e.moderator');
select is((select count(*) from public.notifications where user_id = '00000000-0000-4000-8000-00000000e2e2' and kind = 'mention'),
  1::bigint, '@mention in the Lounge notifies that person');

select * from finish();
rollback;
