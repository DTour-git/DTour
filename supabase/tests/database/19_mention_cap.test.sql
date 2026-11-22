-- @mentions notify at most 10 people per post (#40): the first 10 distinct
-- people in the order they appear. Unknown handles, repeats, an old handle of
-- someone already counted, and the author don't use up a place.
begin;
\ir 00_helpers.sql
select plan(7);

-- Twelve real (non-demo) students: capuser01 … capuser12.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select ('00000000-0000-4000-8000-0000000c00' || lpad(i::text, 2, '0'))::uuid, '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'capuser' || lpad(i::text, 2, '0') || '_2k24co1' || lpad(i::text, 2, '0') || '@dtu.ac.in', '',
  '{"provider":"email","providers":["email"]}', '{}', now(), now()
from generate_series(1, 12) i;
select is((select count(*) from public.profiles where handle like 'capuser__' and not is_demo), 12::bigint, 'twelve students to mention');

-- capuser03 used to be @oldcap03.
insert into public.handle_history (handle, user_id, released_at)
values ('oldcap03', '00000000-0000-4000-8000-0000000c0003', now() + interval '30 days');

insert into public.threads (id, board_id, author_id, title, body)
overriding system value values (90401, '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-00000000e2e2', 'Mention cap test', 'body');

insert into public.replies (id, thread_id, author_id, body) overriding system value values (90402, 90401, '00000000-0000-4000-8000-00000000e2e1',
  'hey @e2e.student @nobody.here @capuser01 @capuser01 @CapUser02 @capuser03 @oldcap03 '
  || '@capuser04 @capuser05 @capuser06 @capuser07 @capuser08 @capuser09 @capuser10 @capuser11 @capuser12');

select is((select count(*) from public.notifications where kind = 'mention' and reply_id = 90402), 10::bigint,
  'a post notifies at most 10 people it mentions');
select is((select count(*) from public.notifications n join public.profiles p on p.id = n.user_id
  where n.kind = 'mention' and n.reply_id = 90402 and p.handle in ('capuser01','capuser02','capuser03','capuser04','capuser05',
    'capuser06','capuser07','capuser08','capuser09','capuser10')), 10::bigint, 'the first 10 mentioned are the ones notified');
select is((select count(*) from public.notifications n join public.profiles p on p.id = n.user_id
  where n.kind = 'mention' and n.reply_id = 90402 and p.handle in ('capuser11', 'capuser12')), 0::bigint,
  'people mentioned after the first 10 are not');
select is((select count(*) from public.notifications where kind = 'mention' and reply_id = 90402
  and user_id = '00000000-0000-4000-8000-0000000c0003'), 1::bigint, 'an old handle and the new one notify their owner once');
select is((select count(*) from public.notifications where kind = 'mention' and reply_id = 90402
  and user_id = '00000000-0000-4000-8000-00000000e2e1'), 0::bigint, 'mentioning yourself notifies nobody');

-- A short mention still works as before.
insert into public.replies (id, thread_id, author_id, body) overriding system value values (90403, 90401, '00000000-0000-4000-8000-00000000e2e1',
  'thanks @capuser12');
select is((select count(*) from public.notifications where kind = 'mention' and reply_id = 90403
  and user_id = '00000000-0000-4000-8000-0000000c0012'), 1::bigint, 'a single mention is still notified');

select * from finish();
rollback;
