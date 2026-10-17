-- DTour demo content — the copy from the design prototypes, so both apps look
-- like the handoff on day one. Every row is is_demo = true; remove it all with
--   select public.dtour_clear_demo();
-- Times are relative to the day the seed runs (IST) so "Today at DTU" is live.

-- Helpers (session-local)
create or replace function pg_temp.at(h int, m int, day_offset int default 0)
returns timestamptz language sql as $$
  select least(
    ((date_trunc('day', now() at time zone 'Asia/Kolkata') + make_interval(days => day_offset, hours => h, mins => m)) at time zone 'Asia/Kolkata'),
    now() - interval '1 minute')
$$;
create or replace function pg_temp.at_future(h int, m int, day_offset int default 0)
returns timestamptz language sql as $$
  select (date_trunc('day', now() at time zone 'Asia/Kolkata') + make_interval(days => day_offset, hours => h, mins => m)) at time zone 'Asia/Kolkata'
$$;
create or replace function pg_temp.u(n int) returns uuid language sql as $$
  select ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid
$$;

-- ── Config ────────────────────────────────────────────────────────────────
insert into public.allowed_email_domains (domain) values ('dtu.ac.in') on conflict do nothing;

insert into public.app_config (id, launch_date, location, sem_label, sem_start, record_online, record_label)
values (1, current_date - 213, 'Bawana Road, Delhi', 'odd sem', current_date - 75, 2140, 'Engifest night ''26')
on conflict (id) do update set launch_date = excluded.launch_date, sem_start = excluded.sem_start,
  record_online = excluded.record_online, record_label = excluded.record_label;

insert into public.branches (code, name, full_name, roll_code, sort, file_count) values
  ('COE', 'Computer Engg.', 'Computer Engineering', 'co', 1, 0),
  ('IT',  'Information Tech.', 'Information Technology', 'it', 2, 2100),
  ('ECE', 'Electronics & Comm.', 'Electronics & Communication', 'ec', 3, 1800),
  ('EE',  'Electrical', 'Electrical Engineering', 'ee', 4, 940),
  ('ME',  'Mechanical', 'Mechanical Engineering', 'me', 5, 1200),
  ('SE',  'Software Engg.', 'Software Engineering', 'se', 6, 860),
  ('MCE', 'Maths & Computing', 'Mathematics & Computing', 'mc', 7, 710),
  ('CE',  'Civil', 'Civil Engineering', 'ce', 8, 620),
  ('ENE', 'Environmental', 'Environmental Engineering', 'en', 9, 0),
  ('PE',  'Production', 'Production & Industrial Engg.', 'pe', 10, 0),
  ('BT',  'Biotechnology', 'Biotechnology', 'bt', 11, 0),
  ('EP',  'Engineering Physics', 'Engineering Physics', 'ep', 12, 0),
  ('FY',  'First year (common)', 'First year (common)', null, 99, 0)
on conflict (code) do nothing;

-- ── People ────────────────────────────────────────────────────────────────
with people(n, handle, display_name, branch, grad, sem, tint, bio, joined) as (values
  (1,  'aarav.k',        null,        'COE', 2028, 3, 'accent',  'Learning backend, breaking things, fixing them at 3 am. Usually in the library or at the H-4 canteen.', '2024-08-01'),
  (2,  'segfault_sneha', null,        'IT',  2027, 5, 'accent2', 'Top contributor in Academics this month.', '2023-08-02'),
  (3,  'dhruv.ece',      null,        'ECE', 2027, 5, 'neutral', 'ECE sem 5 doubts and chai runs.', '2023-08-02'),
  (4,  'riya_codes',     null,        'COE', 2027, 5, 'neutral', 'Shares lab files and the CN quiz updates.', '2023-08-03'),
  (5,  'council_dtu',    'DTU Student Council', null, null, null, 'accent-light', 'Official account of the DTU Student Council.', '2026-03-18'),
  (6,  'bawana_bandit',  null,        'ME',  2027, 5, 'neutral', null, '2023-08-05'),
  (7,  'offer_letter_pls', null,      'IT',  2025, 8, 'neutral', null, '2021-08-04'),
  (8,  'pixelpushr',     null,        'SE',  2027, 5, 'accent2', null, '2023-08-06'),
  (9,  'tanya.n',        'Tanya N.',  'COE', 2026, 7, 'accent',  null, '2022-08-01'),
  (10, 'oat_regular',    null,        'EE',  2028, 3, 'neutral', null, '2024-08-07'),
  (11, 'momo_maxxer',    null,        'ME',  2028, 3, 'neutral', null, '2024-08-07'),
  (12, 'signals_victim', null,        'ECE', 2028, 3, 'accent2', null, '2024-08-08'),
  (13, 'hostel_h6',      null,        'CE',  2027, 5, 'neutral', null, '2023-08-08'),
  (14, 'fresher_kabir',  null,        'ME',  2030, 1, 'neutral', null, '2026-10-17'),
  (15, 'neha.builds',    null,        'SE',  2028, 3, 'accent2', null, '2024-08-09'),
  (16, 'yash.tensor',    null,        'MCE', 2027, 5, 'neutral', null, '2023-08-09'),
  (17, 'ishaan.r',       null,        'ECE', 2029, 1, 'accent',  null, '2025-08-01'),
  (18, 'priya.s',        null,        'COE', 2027, 5, 'accent2', null, '2023-08-10'),
  (19, 'vj.dev',         null,        'IT',  2027, 5, 'accent',  null, '2023-08-10'),
  (20, 'manav.s',        null,        'ME',  2027, 5, 'accent-light', null, '2023-08-10'),
  (21, 'library_bot',    null,        null,  null, null, 'neutral', 'Archives old papers into the Library.', '2026-03-18'),
  (22, 'cr_coe_b',       null,        'COE', 2028, 3, 'neutral', null, '2024-08-11'),
  (23, 'gdsc.dtu',       'GDSC DTU',  null,  null, null, 'accent-light', null, '2026-03-18'),
  (24, 'music.society',  'Music Society', null, null, null, 'accent-light', null, '2026-03-18'),
  (25, 'riya.m',         null,        'IT',  2026, 7, 'accent2', null, '2022-08-12')
), ins_users as (
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  select pg_temp.u(n), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         handle || '@dtour.invalid', '', now(),
         '{"provider":"email","providers":["email"],"dtour_seed":true}', '{}', joined::timestamptz, now(),
         '', '', '', ''
  from people
  on conflict (id) do nothing
  returning id
)
insert into public.profiles (id, handle, display_name, branch_code, grad_year, semester, tint, bio,
                             onboarded, is_demo, created_at)
select pg_temp.u(n), handle, display_name, branch, grad, sem, tint, bio, true, true, joined::timestamptz
from people
on conflict (id) do nothing;

update public.profiles set hostel = 'Hostel H-4', github = 'aaravk', linkedin = 'aarav-k',
  skills = '{Node.js,PostgreSQL,React,C++}', open_to_teams = true where id = pg_temp.u(1);
update public.profiles set skills = '{Flutter,Firebase}', open_to_teams = true where id = pg_temp.u(15);
update public.profiles set skills = '{PyTorch,CV}', open_to_teams = true where id = pg_temp.u(16);
update public.profiles set skills = '{Arduino,PCB design}', open_to_teams = true where id = pg_temp.u(17);

insert into public.societies (id, slug, name, short_name, icon, tint, description, is_demo) values
  (pg_temp.u(101), 'gdsc-dtu', 'GDSC DTU', null, 'code', 'accent', 'Google Developer Student Club. Workshops, doubt sessions, hackathons.', true),
  (pg_temp.u(102), 'music-society', 'Music Society', null, 'music-notes', 'accent2', 'Jamming nights, open mics and the OAT.', true),
  (pg_temp.u(103), 'dramatics-society', 'Dramatics Society', 'Dramatics Soc.', 'mask-happy', 'accent2', 'Street play and stage.', true),
  (pg_temp.u(104), 'ieee-dtu', 'IEEE DTU', null, 'cpu', 'accent', 'Talks, papers and the alumni network.', true),
  (pg_temp.u(105), 'engifest', 'Engifest', null, 'confetti', 'accent2', 'DTU''s annual cultural fest.', true),
  (pg_temp.u(106), 'design-club', 'Design Club', null, 'paint-brush', 'accent', 'Figma, posters and product design.', true),
  (pg_temp.u(107), 'student-council', 'DTU Student Council', 'Council', 'bank', 'accent', 'Verified campus news.', true)
on conflict do nothing;

insert into public.society_members (society_id, user_id, role, can_post) values
  (pg_temp.u(101), pg_temp.u(1), 'Core member', false),
  (pg_temp.u(102), pg_temp.u(1), 'Member', false),
  (pg_temp.u(101), pg_temp.u(23), 'Official account', true),
  (pg_temp.u(102), pg_temp.u(24), 'Official account', true),
  (pg_temp.u(107), pg_temp.u(5), 'Official account', true)
on conflict do nothing;

-- ── Boards ────────────────────────────────────────────────────────────────
insert into public.board_categories (id, slug, name, subtitle, tone, icon) values
  (1, 'campus', 'Campus', 'Life inside the gates', 'accent', 'megaphone'),
  (2, 'padhai', 'Padhai', 'Courses, exams and getting through them', 'accent2', 'book-open-text'),
  (3, 'career', 'Career', 'Internships, placements and what''s next', 'accent', 'briefcase'),
  (4, 'culture', 'Culture', 'Fests, societies and things students make', 'accent2', 'confetti'),
  (5, 'bahar', 'Bahar', 'Food, rides and everything outside', 'ink', 'bowl-food')
on conflict do nothing;

insert into public.boards (id, slug, category_id, parent_id, name, short_name, description, icon, verified_only, link_screen, rules, sort, is_demo) values
  (pg_temp.u(201), 'campus-buzz', 1, null, 'Campus Buzz', null, 'Gossip, announcements and whatever just happened near the main gate.', 'megaphone', false, null, '{}', 1, true),
  (pg_temp.u(202), 'pata-hai', 1, null, 'Pata Hai Aaj Kya Hua?', null, 'Verified news from the council, CRs and societies.', 'newspaper', true, null, '{}', 2, true),
  (pg_temp.u(203), 'academics', 2, null, 'Academics', null, 'Doubts, PYQs and prof reviews — one sub-board per branch and semester.', 'book-open-text', false, null, '{}', 1, true),
  (pg_temp.u(204), 'exams-results', 2, null, 'Exams & Results', null, 'Datesheets, re-evaluation, supplementaries, the "is it out yet" thread.', 'exam', false, null, '{}', 2, true),
  (pg_temp.u(205), 'placements', 3, null, 'Placements & Internships', 'Placements', 'Interview experiences, OA prep, referrals.', 'briefcase', false, null, '{}', 1, true),
  (pg_temp.u(206), 'team-up', 3, null, 'Team Up', null, 'Find teammates for hackathons and projects.', 'users-three', false, 'teams', '{}', 2, true),
  (pg_temp.u(207), 'roadmaps', 3, null, 'Roadmaps & New Fields', null, 'What to learn, in what order, and whether it''s worth it.', 'path', false, null, '{}', 3, true),
  (pg_temp.u(208), 'fests', 4, null, 'Fests: Engifest, Invictus', 'Fests', 'Passes, line-ups and volunteering.', 'confetti', false, null, '{}', 1, true),
  (pg_temp.u(209), 'societies', 4, null, 'Societies', null, 'Events, recruitments, workshops', 'flag-banner', false, 'societies', '{}', 2, true),
  (pg_temp.u(210), 'made-at-dtu', 4, null, 'Made at DTU', null, 'Art, music, projects, photos', 'paint-brush', false, null, '{}', 3, true),
  (pg_temp.u(211), 'food-hangouts', 5, null, 'Food & Hangouts', null, 'Where to eat and where to go.', 'bowl-food', false, null, '{}', 1, true),
  (pg_temp.u(212), 'rides', 5, null, 'Rides & Commute', null, 'Metro, cabs, carpools home', 'car-profile', false, null, '{}', 2, true),
  (pg_temp.u(213), 'off-topic', 5, null, 'Off-topic', null, 'Anything goes (mostly)', 'chat-teardrop-dots', false, null, '{}', 3, true)
on conflict do nothing;

-- Sub-boards
insert into public.boards (id, slug, category_id, parent_id, name, short_name, description, icon, sort, is_demo) values
  (pg_temp.u(231), 'lost-found', 1, pg_temp.u(201), 'Lost & found', null, 'Lost something on campus? Found something?', 'magnifying-glass', 1, true),
  (pg_temp.u(232), 'hostel-life', 1, pg_temp.u(201), 'Hostel life', null, 'Hostels, wardens, wifi.', 'buildings', 2, true),
  (pg_temp.u(233), 'mess-canteen', 1, pg_temp.u(201), 'Mess & canteen', null, 'Menus and reviews.', 'bowl-food', 3, true)
on conflict do nothing;

insert into public.boards (id, slug, category_id, parent_id, name, short_name, description, icon, sort, is_demo)
select pg_temp.u(240 + b.sort), 'academics-' || lower(b.code), 2, pg_temp.u(203), b.code, null,
       'Doubts, PYQs and prof reviews for ' || b.full_name || '.', 'book-open-text', b.sort, true
from public.branches b where b.code in ('COE','IT','ECE','EE','ME','SE','MCE','CE','ENE','PE','BT')
on conflict do nothing;

insert into public.boards (id, slug, category_id, parent_id, name, short_name, description, icon, rules, member_count, sort, is_demo) values
  (pg_temp.u(260), 'coe-sem-3', 2, pg_temp.u(241), 'COE · 3rd semester', 'COE · 3rd sem',
   'Doubts, PYQs and prof reviews for second-year COE.', 'book-open-text',
   '{"Mention the subject code (CO201…)","Share PYQs as PDFs, not photos","No leaked papers — ever","Mark the answer that helped"}',
   1204, 1, true)
on conflict do nothing;

-- ── Threads ───────────────────────────────────────────────────────────────
insert into public.threads (id, board_id, author_id, society_id, kind, title, body, standfirst, image_label, tags, attachment, is_demo, created_at)
overriding system value values
  (1, pg_temp.u(260), pg_temp.u(2), null, 'question',
   'DSA end-sem: which units actually matter? Six years of PYQs inside',
   E'Went through every DSA end-sem since 2020. Short version: trees and graphs are roughly 45% of the marks, every single year. Hashing shows up as one 10-marker and that''s it.\n\nBreakdown by unit is in the sheet. If your branch''s paper differs, reply and I''ll add a column.',
   'Trees and graphs are roughly 45% of marks every year. Topic-wise breakdown attached — add your branch''s if it differs.',
   null, '{DSA,end-sem,PYQ}', '{"name":"DSA_PYQ_2020–26.pdf","size":"2.4 MB","subject":"CO201","library_item_id":1}',
   true, now() - interval '2 hours'),
  (2, pg_temp.u(202), pg_temp.u(5), pg_temp.u(107), 'news',
   'Engifest passes move to SPS-10, and the library goes 24×7 for end-sems',
   E'Engifest pass distribution has moved from the OAT to SPS-10. Bring your college ID — one pass per student.\n\nThe central library will stay open 24×7 from tonight until the last end-sem paper.',
   'Bring your college ID. Distribution runs till 6 pm or until passes run out — whichever comes first, knowing us.',
   'photo: queue outside SPS', '{Engifest,library}', null, true, pg_temp.at(14, 5)),
  (3, pg_temp.u(201), pg_temp.u(6), null, 'thread', 'Who keeps taking cycles from the H-4 stand?',
   'Third cycle gone this month. Warden says CCTV is “under process”.', null, null, '{hostel}', null, true, now() - interval '4 minutes'),
  (4, pg_temp.u(233), pg_temp.u(11), null, 'thread', 'Mess menu changed again — rate it',
   'New menu dropped on the notice board this morning. Paneer on Tuesdays is gone. Rate it out of 10.', null, null, '{mess}', null, true, now() - interval '5 hours'),
  (5, pg_temp.u(204), pg_temp.u(4), null, 'thread', 'Odd-sem datesheet (tentative) is out',
   'Unofficial copy from the CRs. End-sems start 5 Nov.', null, null, '{datesheet}', null, true, now() - interval '1 hour'),
  (6, pg_temp.u(203), pg_temp.u(10), null, 'question', 'Best prof for Engg. Maths III?',
   'Section-wise prof reviews from the last three batches, please. Who explains PDEs like a human?', null, null, '{MA201}', null, true, now() - interval '9 hours'),
  (7, pg_temp.u(205), pg_temp.u(7), null, 'thread', 'Interview experience: SDE intern, three rounds',
   'OA, one DSA round, one system-design-lite round. Questions and prep timeline inside.', null, null, '{interview,SDE}', null, true, now() - interval '31 minutes'),
  (8, pg_temp.u(207), pg_temp.u(3), null, 'question', 'Is VLSI worth it in 2027?',
   'An ECE senior on chip-design jobs in India and what to learn first.', null, null, '{VLSI,ECE}', null, true, now() - interval '1 day'),
  (9, pg_temp.u(211), pg_temp.u(11), null, 'poll', 'Post-exam treat: Sec-11 momos win the poll',
   'Where are we going after the last paper?', null, null, '{food}', null, true, now() - interval '20 hours'),
  (10, pg_temp.u(212), pg_temp.u(8), null, 'thread', 'Cab to IGI Friday, 2 seats left',
   'Leaving 6 am from Gate 1. Split four ways.', null, null, '{cab}', null, true, now() - interval '3 hours'),
  (11, pg_temp.u(232), pg_temp.u(13), null, 'thread', 'H-6 Wi-Fi goes down',
   'Whole of H-6 has had no wifi since 8. Complaint registered.', null, null, '{wifi}', null, true, pg_temp.at(8, 2)),
  (12, pg_temp.u(202), pg_temp.u(5), pg_temp.u(107), 'news', 'Robotics team wins nationals, again',
   'DTU''s robotics team took first place at the national championship for the second year running.', null, null, '{robotics}', null, true, pg_temp.at(10, 15)),
  (13, pg_temp.u(203), pg_temp.u(12), null, 'question', 'Best Fourier transform resources that are not 3-hour lectures',
   'Started in the Lounge. 3Blue1Brown plus two handwritten notes from seniors.', null, null, '{signals}', null, true, now() - interval '50 minutes'),
  (14, pg_temp.u(203), pg_temp.u(22), null, 'question', 'Why does my linked list segfault on delete?',
   'Deleting the head node crashes every time. Code in replies.', null, null, '{C++,DSA}', null, true, now() - interval '5 hours'),
  (15, pg_temp.u(205), pg_temp.u(1), null, 'question', 'Is it worth doing a startup internship in 2nd year?',
   'Got an offer from a 12-person startup for the winter. Worth it over a research project?', null, null, '{internship}', null, true, now() - interval '3 days');

select setval(pg_get_serial_sequence('public.threads', 'id'), 100);

insert into public.replies (id, thread_id, parent_id, author_id, society_id, body, is_demo, created_at)
overriding system value values
  (1, 1, null, pg_temp.u(23), pg_temp.u(101), 'Can confirm from our doubt sessions. We''re running a 2-hour graphs revision on Wednesday in SPS-12 — we''ll use this sheet as the base.', true, now() - interval '1 hour'),
  (2, 1, null, pg_temp.u(3), null, 'ECE paper last year had two questions on heaps, not graphs. Adding our column tonight.', true, now() - interval '58 minutes'),
  (3, 1, 2, pg_temp.u(2), null, 'Perfect, tag me when it''s in.', true, now() - interval '52 minutes'),
  (4, 14, null, pg_temp.u(1), null, 'You free the head before moving the pointer. Save head->next first, then delete.', true, now() - interval '2 hours'),
  (5, 13, null, pg_temp.u(9), null, '3Blue1Brown''s video first, then the handwritten notes in the Library under EE sem 3.', true, now() - interval '40 minutes');
select setval(pg_get_serial_sequence('public.replies', 'id'), 100);

update public.threads set accepted_reply_id = 1 where id = 1;
update public.threads set accepted_reply_id = 4 where id = 14;
update public.karma_events set created_at = now() - interval '10 days' where reason = 'accepted answer';

insert into public.poll_options (thread_id, label, votes, sort) values
  (9, 'Sec-11 momo lane', 165, 1), (9, 'Unity One food court', 98, 2), (9, 'Chole bhature, Sec-7', 55, 3);

-- Counters to match the design
update public.threads t set score = v.score, reply_count = v.replies from (values
  (1, 284, 63), (2, 210, 184), (3, 201, 118), (4, 88, 64), (5, 172, 40), (6, 64, 52), (7, 156, 41),
  (8, 97, 33), (9, 318, 24), (10, 0, 12), (11, 76, 140), (12, 120, 92), (13, 22, 14), (14, 41, 9), (15, 96, 58)
) as v(id, score, replies) where t.id = v.id;
update public.replies r set score = v.s from (values (1, 96), (2, 41), (3, 6), (4, 41), (5, 8)) as v(id, s) where r.id = v.id;

update public.boards b set thread_count = v.t, post_count = v.p from (values
  ('campus-buzz', 2418, 31200), ('pata-hai', 612, 8400), ('academics', 5102, 48900), ('exams-results', 1340, 22100),
  ('placements', 1877, 26400), ('team-up', 642, 4100), ('roadmaps', 410, 6100), ('fests', 964, 12700),
  ('societies', 380, 5200), ('made-at-dtu', 290, 3300), ('food-hangouts', 1230, 19800), ('rides', 540, 4400),
  ('off-topic', 1870, 22800), ('coe-sem-3', 318, 4200)
) as v(slug, t, p) where b.slug = v.slug;

-- ── Karma, activity, badges for @aarav.k ──────────────────────────────────
insert into public.karma_events (user_id, bucket, amount, reason, created_at) values
  (pg_temp.u(1), 'Academics', 709, 'history', now() - interval '60 days'),
  (pg_temp.u(1), 'Academics', 86, 'this week', now() - interval '2 hours'),
  (pg_temp.u(1), 'Placements', 310, 'history', now() - interval '40 days'),
  (pg_temp.u(1), 'Campus Buzz', 190, 'history', now() - interval '30 days'),
  (pg_temp.u(1), 'Library uploads', 100, 'history', now() - interval '20 days'),
  (pg_temp.u(2), 'Academics', 3210, 'history', now() - interval '90 days'),
  (pg_temp.u(4), 'Academics', 2140, 'history', now() - interval '90 days'),
  (pg_temp.u(3), 'Academics', 980, 'history', now() - interval '90 days');

update public.profiles p set thread_count = v.t, reply_count = v.r, accepted_count = v.a, upload_count = v.u, download_count = v.d
from (values (1, 48, 312, 17, 9, 2960), (2, 61, 402, 33, 14, 5120), (4, 30, 210, 12, 22, 3900)) as v(n, t, r, a, u, d)
where p.id = pg_temp.u(v.n);

delete from public.activities where user_id = pg_temp.u(1);
insert into public.activities (user_id, kind, kicker, title, meta, route, created_at) values
  (pg_temp.u(1), 'accepted', 'Accepted answer · Academics', 'Re: Why does my linked list segfault on delete?', '+25 karma · 41 votes', '/t/14', now() - interval '2 hours'),
  (pg_temp.u(1), 'upload', 'Uploaded to Library · CO207', 'OOP lab file — programs 6 to 10 with outputs', '312 downloads', '/library/subject/CO207', now() - interval '1 day'),
  (pg_temp.u(1), 'thread', 'Thread · Placements', 'Is it worth doing a startup internship in 2nd year?', '96 votes · 58 replies', '/t/15', now() - interval '3 days'),
  (pg_temp.u(1), 'wiki_edit', 'Edited wiki · Academics', 'How to get a 9+ CGPA at DTU — added COE lab tips', '+140 words', '/wiki/how-to-get-a-9-cgpa-at-dtu', now() - interval '5 days'),
  (pg_temp.u(1), 'team', 'Joined team · Team Up', 'SIH: crop-disease ML tool (Backend)', null, '/teams', now() - interval '7 days');

insert into public.badges (user_id, icon, tone, label) values
  (pg_temp.u(1), 'medal', 'accent2', 'Top helper Sep'),
  (pg_temp.u(1), 'books', 'accent', 'Librarian'),
  (pg_temp.u(1), 'fire', 'accent2', '30-day streak');

-- ── Wiki ──────────────────────────────────────────────────────────────────
insert into public.wiki_categories (id, slug, name, pill, tone) values
  (1, 'gpa-exams', 'GPA & exams', 'GPA & exams', 'accent2'),
  (2, 'placements', 'Placements', 'Placements', 'accent'),
  (3, 'roadmaps', 'Roadmaps & new fields', 'Roadmaps', 'accent'),
  (4, 'campus-life', 'Campus life', 'Campus life', 'ink')
on conflict do nothing;

insert into public.wiki_articles (id, slug, category_id, board_id, title, dek, body, cover_label, started_by, checked_by, checked_at,
                                  read_minutes, editor_count, useful_count, talk_count, views_week, is_demo, created_at)
overriding system value values
  (1, 'how-to-get-a-9-cgpa-at-dtu', 1, pg_temp.u(203), 'How to get a 9+ CGPA at DTU',
   'A living guide maintained by students who''ve done it — without living in the library.',
   E'### 1. How DTU grading works\n\nEvery course is relative-graded within its section. That means the class average matters more than the paper''s difficulty — a 62 can be an A+ in a hard batch. The first thing to learn is [how the grade boundaries are drawn](/wiki/how-to-get-a-9-cgpa-at-dtu), not how to score 90.\n\nInternals (mid-sem, assignments, attendance) are typically 50% of the course. Most people who lose a 9 lose it here, not in the end-sem.\n\n> [!senior] "Ask your seniors for the professor''s previous papers on day one. Same prof, same style, every year." — @offer_letter_pls, IT ''25\n\n### 2. Mid-sems are 30%, use them\n\nTreat the mid-sem as the real exam. It covers fewer units, it''s easier to top, and it sets your standing before the end-sem curve. Start revising two weeks out and do every PYQ from the last three years.\n\n### 3. Building a PYQ habit\n\nPick one subject a day. Solve one past paper under time, then check it against the Library''s solved copies. By end-sems you will have seen every question type twice.\n\n### 4. The week before end-sems\n\nNo new topics. Revise from your own short notes, sleep seven hours, and do one full paper a day in exam conditions.\n\n### 5. Labs and viva\n\nLab files are easy marks. Keep them current every week, and know your programs well enough to explain any line in the viva.\n\n### 6. Branch-specific notes\n\nCOE and IT: DSA and OOP labs carry heavy internals. ECE: heaps show up more than graphs in DSA. Add your branch''s notes below.',
   'cover image', pg_temp.u(9), pg_temp.u(7), current_date - 7, 9, 14, 1204, 23, 3400, true, now() - interval '400 days'),
  (2, 'the-week-before-end-sems', 1, pg_temp.u(203), 'The week before end-sems: a day-by-day plan', 'Seven days, no new topics.', E'### Day 7 to day 1\n\nA calm, boring plan that works.', null, pg_temp.u(2), pg_temp.u(7), current_date - 30, 6, 8, 410, 4, 900, true, now() - interval '300 days'),
  (3, 'labs-and-viva', 1, pg_temp.u(203), 'Labs and viva: what examiners actually ask', 'The ten questions that come up every time.', E'### What they ask\n\nExplain your program line by line.', null, pg_temp.u(4), null, null, 4, 5, 120, 2, 400, true, now() - interval '200 days'),
  (4, 're-evaluation-and-supplementaries', 1, pg_temp.u(204), 'Re-evaluation and supplementaries, explained', 'Forms, fees and deadlines.', E'### Re-evaluation\n\nApply within seven days of results.', null, pg_temp.u(7), pg_temp.u(9), current_date - 60, 5, 3, 88, 1, 300, true, now() - interval '250 days'),
  (5, 'placement-prep-the-6-month-plan', 2, pg_temp.u(205), 'Placement prep: the 6-month plan', 'Month-by-month DSA, projects and mock interviews.', E'### Month 1\n\nArrays, strings, hashing.', null, pg_temp.u(7), pg_temp.u(9), current_date - 20, 12, 9, 860, 12, 2100, true, now() - interval '350 days'),
  (6, 'resume-that-gets-past-the-tpo-shortlist', 2, pg_temp.u(205), 'Resume that gets past the DTU TPO shortlist', 'One page, three projects, numbers everywhere.', E'### Format\n\nOne page.', null, pg_temp.u(7), pg_temp.u(9), current_date - 40, 7, 11, 540, 6, 1500, true, now() - interval '320 days'),
  (7, 'off-campus-internships-for-2nd-years', 2, pg_temp.u(205), 'Off-campus internships for 2nd years', 'Where to apply and when.', E'### When to start\n\nSeptember.', null, pg_temp.u(2), null, null, 8, 4, 140, 3, 600, true, now() - interval '150 days'),
  (8, 'web-dev-roadmap-for-second-years', 3, pg_temp.u(207), 'Web dev roadmap for second years', 'HTML to deployed full-stack project in one semester.', E'### Step 1\n\nHTML and CSS, properly.', null, pg_temp.u(8), null, null, 10, 6, 330, 5, 800, true, now() - interval '180 days'),
  (9, 'is-vlsi-worth-it-in-2027', 3, pg_temp.u(207), 'Is VLSI worth it in 2027?', 'An ECE senior on chip-design jobs in India.', E'### The short answer\n\nYes, if you like digital design.', null, pg_temp.u(3), null, null, 6, 3, 190, 4, 700, true, now() - interval '90 days'),
  (10, 'getting-into-ml-research-as-an-undergrad', 3, pg_temp.u(207), 'Getting into ML research as an undergrad', 'Cold emails, reading groups and your first paper.', E'### Start with a reading group\n\nOne paper a week.', null, pg_temp.u(16), null, null, 9, 5, 210, 2, 650, true, now() - interval '120 days'),
  (11, 'fresher-survival-guide-first-30-days', 4, pg_temp.u(201), 'Fresher survival guide: first 30 days', 'Hostels, ID cards, societies and where to eat.', E'### Week 1\n\nGet your ID card and library card.', null, pg_temp.u(9), pg_temp.u(7), current_date - 70, 11, 22, 1500, 9, 1800, true, now() - interval '500 days'),
  (12, 'hackathons-forming-a-team-that-ships', 4, pg_temp.u(206), 'Hackathons: forming a team that ships', 'Roles, scope and the 3 am demo.', E'### Pick roles early\n\nOne designer, two builders, one pitch.', null, pg_temp.u(8), null, null, 6, 7, 260, 3, 500, true, now() - interval '100 days');
select setval(pg_get_serial_sequence('public.wiki_articles', 'id'), 100);

insert into public.wiki_revisions (article_id, editor_id, summary, delta_words, status, created_at) values
  (1, pg_temp.u(9), 'rewrote section 4', null, 'published', now() - interval '14 days'),
  (1, pg_temp.u(3), 'fixed ECE grading note', -22, 'published', now() - interval '5 days'),
  (1, pg_temp.u(2), 'added IT lab tips', 140, 'published', now() - interval '2 days');
delete from public.activities where kind = 'wiki_edit' and user_id <> pg_temp.u(1);
update public.wiki_articles a set editor_count = v.e, body = a.body from (values (1, 14)) as v(id, e) where a.id = v.id;

insert into public.wiki_talk (article_id, author_id, body, created_at) values
  (1, pg_temp.u(8), 'Should we add a section for design electives?', now() - interval '1 day');
update public.wiki_articles set talk_count = 23 where id = 1;

-- ── Library ───────────────────────────────────────────────────────────────
insert into public.subjects (code, name, short_name, branch_code, semester, professor, credits, exam_on, sort) values
  ('CO201', 'Data Structures', null, 'COE', 3, 'Prof. R. Sharma', 4, current_date + 19, 1),
  ('CO203', 'Discrete Structures', null, 'COE', 3, 'Prof. A. Gupta', 4, current_date + 21, 2),
  ('CO205', 'Digital Electronics', null, 'COE', 3, 'Prof. S. Verma', 4, current_date + 23, 3),
  ('CO207', 'Object Oriented Programming', 'Object Oriented Prog.', 'COE', 3, 'Prof. N. Jain', 4, current_date + 25, 4),
  ('MA201', 'Engineering Mathematics III', 'Engg. Mathematics III', 'COE', 3, 'Prof. K. Rao', 4, current_date + 27, 5),
  ('EE201', 'Signals & Systems', null, 'EE', 3, 'Prof. P. Singh', 4, current_date + 20, 1)
on conflict do nothing;

insert into public.library_items (id, subject_code, kind, title, format, size_bytes, uploader_id, downloads, downloads_week, top_rated, is_demo, created_at)
overriding system value values
  (1, 'CO201', 'pyq', 'DSA end-sem papers 2020–26', 'PDF', 2516582, pg_temp.u(2), 1840, 1840, true, true, now() - interval '20 days'),
  (2, 'CO201', 'pyq', 'Mid-sem 2025 with solutions', 'PDF', 880640, pg_temp.u(4), 940, 120, false, true, now() - interval '40 days'),
  (3, 'CO201', 'pyq', 'End-sem 2019 (scanned)', 'PDF', 3250586, pg_temp.u(21), 410, 30, false, true, now() - interval '200 days'),
  (4, 'CO201', 'notes', 'Unit 4: Trees & graphs, handwritten', 'PDF', 5452595, pg_temp.u(9), 1200, 400, true, true, now() - interval '60 days'),
  (5, 'CO201', 'notes', 'Complete short notes, all units', 'PDF', 1887437, pg_temp.u(7), 990, 210, false, true, now() - interval '100 days'),
  (6, 'CO201', 'slides', 'Prof''s slides, units 1–3', 'PPT', 7759462, pg_temp.u(22), 620, 90, false, true, now() - interval '30 days'),
  (7, 'CO201', 'lab', 'DS lab: all 12 programs in C++', 'ZIP', 122880, pg_temp.u(1), 540, 60, false, true, now() - interval '50 days'),
  (8, 'CO201', 'notes', 'Graph algorithms cheat sheet', 'PDF', 412000, pg_temp.u(2), 380, 80, false, true, now() - interval '10 days'),
  (9, 'CO201', 'notes', 'Recorded revision, Nov ''25', 'Video', 0, pg_temp.u(23), 260, 40, false, true, now() - interval '330 days'),
  (10, 'CO205', 'notes', 'K-maps & flip-flops, handwritten', 'PDF', 4100000, pg_temp.u(3), 920, 920, false, true, now() - interval '15 days'),
  (11, 'CO207', 'lab', 'OOP lab file, all 10 programs', 'PDF', 900000, pg_temp.u(4), 760, 760, false, true, now() - interval '25 days'),
  (12, 'CO207', 'lab', 'OOP lab file — programs 6 to 10 with outputs', 'PDF', 650000, pg_temp.u(1), 312, 200, false, true, now() - interval '1 day'),
  (13, 'EE201', 'notes', 'Fourier transform, handwritten', 'PDF', 2100000, pg_temp.u(9), 300, 90, false, true, now() - interval '12 days');
select setval(pg_get_serial_sequence('public.library_items', 'id'), 100);
delete from public.activities where kind = 'upload' and user_id <> pg_temp.u(1);
delete from public.activities where kind = 'upload' and title like 'DS lab%';

update public.subjects s set notes_count = v.n, pyq_count = v.p, lab_count = v.l, thread_count = v.t from (values
  ('CO201', 42, 18, 6, 3), ('CO203', 28, 14, 0, 0), ('CO205', 31, 16, 9, 0), ('CO207', 24, 11, 12, 0), ('MA201', 19, 20, 0, 0), ('EE201', 12, 9, 4, 1)
) as v(code, n, p, l, t) where s.code = v.code;
update public.branches b set file_count = v.c from (values
  ('COE', 2400), ('IT', 2100), ('ECE', 1800), ('EE', 940), ('ME', 1200), ('SE', 860), ('MCE', 710), ('CE', 620)
) as v(code, c) where b.code = v.code;
update public.profiles p set upload_count = v.u from (values (1, 9), (2, 14), (4, 22)) as v(n, u) where p.id = pg_temp.u(v.n);
update public.profiles p set download_count = v.d from (values (1, 2960), (2, 5120), (4, 3900)) as v(n, d) where p.id = pg_temp.u(v.n);

insert into public.exam_windows (branch_code, semester, label, starts_on) values (null, null, 'End-sems', current_date + 19);

-- ── Society board ─────────────────────────────────────────────────────────
insert into public.society_posts (id, society_id, author_id, kind, title, body, when_label, short_when, where_label, starts_at, rsvp_count, rsvp_word, apply_url, meta_note, featured, poster_label, is_demo, created_at)
overriding system value values
  (1, pg_temp.u(102), pg_temp.u(24), 'event', 'OAT jamming night', 'Open mic, 4 slots left. Bring an instrument or just your voice.', 'tonight 7 pm', 'tonight 7 pm', 'OAT', pg_temp.at_future(19, 0), 140, 'going', null, null, true, null, true, now() - interval '6 hours'),
  (2, pg_temp.u(101), pg_temp.u(23), 'workshop', 'Intro to Rust', 'Laptops needed. Repo and setup guide are up.', 'Mon 5 pm', 'Mon 5 pm', 'SPS-12', pg_temp.at_future(17, 0, 2), 88, 'going', null, null, false, 'society poster', true, now() - interval '1 day'),
  (3, pg_temp.u(103), null, 'recruiting', 'Dramatics Society auditions', 'Street play and stage. No experience needed — just turn up.', 'closes Sunday', 'till Sun', null, null, 0, 'going', 'https://forms.gle/', 'no experience needed', false, null, true, now() - interval '2 days'),
  (4, pg_temp.u(104), null, 'talk', 'Alumni talk: life at a chip startup', 'An ECE ''18 grad on VLSI careers in India. Q&A after.', 'Wed 3 pm', 'Wed 3 pm', 'Auditorium', pg_temp.at_future(15, 0, 4), 210, 'interested', null, null, false, null, true, now() - interval '3 days'),
  (5, pg_temp.u(105), null, 'recruiting', 'Engifest ''27 is hiring volunteers', 'Hospitality, sponsorship, media, logistics. All years welcome.', 'core team', 'core team', null, null, 0, 'going', 'https://forms.gle/', 'all years', false, null, true, now() - interval '4 days'),
  (6, pg_temp.u(106), null, 'workshop', 'Figma from zero, for non-designers', 'Two hours, one landing page. Perfect for hackathon teams.', 'Sat 11 am', 'Sat 11 am', null, pg_temp.at_future(11, 0, 7), 54, 'going', null, null, false, null, true, now() - interval '5 days');
select setval(pg_get_serial_sequence('public.society_posts', 'id'), 100);

-- ── Team Up ───────────────────────────────────────────────────────────────
insert into public.teams (id, owner_id, category, event_name, event_short, event_tone, title, short_title, description, deadline_label, deadline_on, urgent, extra_members, is_demo, created_at)
overriding system value values
  (1, pg_temp.u(18), 'hackathon', 'Smart India Hackathon', 'SIH', 'accent', 'Crop-disease detection from leaf photos', 'SIH · crop-disease ML tool', 'ML model + farmer-facing app. Shortlisting round in 3 weeks.', null, current_date + 3, true, 0, true, now() - interval '2 days'),
  (2, pg_temp.u(4), 'competition', 'Invictus CTF', null, 'accent', 'Team "segfault_squad" needs two more', 'Invictus CTF', 'We have web and forensics. Looking for people who enjoy binaries.', null, current_date + 7, false, 0, true, now() - interval '3 days'),
  (3, pg_temp.u(1), 'project', 'Project · open-ended', null, 'neutral', 'DTour mobile app (yes, this one)', null, 'Help build the campus app. React Native, weekends only.', 'Rolling', null, false, 0, true, now() - interval '5 days'),
  (4, pg_temp.u(20), 'competition', 'Robocon 2027', null, 'accent2', 'Robotics team recruiting first and second years', null, 'Mechanical, electronics and controls. No prior experience needed.', 'Trials Nov 2', null, true, 9, true, now() - interval '6 days');
select setval(pg_get_serial_sequence('public.teams', 'id'), 100);

insert into public.team_roles (team_id, name, filled, filled_by, sort) values
  (1, 'ML', true, pg_temp.u(19), 1), (1, 'Backend', true, pg_temp.u(1), 2), (1, 'Frontend', false, null, 3), (1, 'Designer', false, null, 4),
  (2, 'Web', true, pg_temp.u(4), 1), (2, 'Forensics', true, pg_temp.u(3), 2), (2, 'Reverse eng.', false, null, 3), (2, 'Crypto', false, null, 4),
  (3, 'Product', true, pg_temp.u(1), 1), (3, 'React Native', false, null, 2), (3, 'Backend', false, null, 3),
  (4, 'Mechanical', false, null, 1), (4, 'Embedded', false, null, 2), (4, 'Controls', false, null, 3);

insert into public.team_members (team_id, user_id) values
  (1, pg_temp.u(18)), (1, pg_temp.u(19)), (2, pg_temp.u(4)), (2, pg_temp.u(3)), (3, pg_temp.u(1)), (4, pg_temp.u(20));
delete from public.activities where kind = 'team' and user_id <> pg_temp.u(1);

insert into public.deadlines (on_date, title, sub, highlight, is_demo) values
  (current_date + 3, 'SIH internal round', '12 DTU teams registered', true, true),
  (current_date + 7, 'Invictus CTF registration', 'Teams of up to 4', false, true),
  (current_date + 16, 'Robocon trials', 'Mech workshop', false, true);

-- ── Kahan chalein? ────────────────────────────────────────────────────────
insert into public.places (category, name, short_name, where_label, short_where, price_label, distance_km, hearts, recs, tags, icon, event_on, metro_minutes, image_label, under_100, on_campus, sort, home_sort, home_meta, is_demo) values
  ('canteen', 'Cheese Maggi', null, 'Main canteen · after 10 pm', 'Main canteen · late', '₹60', null, 1200, 0, '{}', null, null, null, null, true, true, 1, null, null, true),
  ('canteen', 'Bread pakoda + chai', null, 'Hostel canteen, H-4', 'H-4 canteen', '₹35', null, 980, 0, '{}', null, null, null, null, true, true, 2, null, null, true),
  ('canteen', 'Cold coffee', null, 'Juice corner near the library', 'Juice corner', '₹50', null, 860, 0, '{}', null, null, null, null, true, true, 3, null, null, true),
  ('canteen', 'Rajma chawal', null, 'Mess, Thursdays only', 'Mess · Thursdays', 'included', null, 640, 0, '{}', null, null, null, null, true, true, 4, null, null, true),
  ('canteen', 'Maggi point', null, 'Gate 2 · late night', 'Gate 2', '₹40', null, 310, 0, '{}', null, null, null, 'photo: maggi point', true, true, 5, 3, 'Gate 2 · late night', true),
  ('nearby', 'Sec-11 momo lane', null, 'Rohini', null, '₹', 5.8, 0, 212, '{"Late night"}', null, null, null, 'photo: momo stall', true, false, 1, 1, '5.8 km · ₹', true),
  ('nearby', 'Unity One food court', null, 'Rohini', null, '₹₹', 7.0, 0, 96, '{Groups}', null, null, null, 'photo: food court', false, false, 2, null, null, true),
  ('nearby', 'Chole bhature, Sec-7 market', 'Chole bhature, Sec-7', 'Rohini', null, '₹', 6.0, 0, 140, '{Breakfast}', null, null, null, 'photo: chole bhature', true, false, 3, null, null, true),
  ('nearby', 'Study-friendly cafés', null, 'Rohini & Pitampura · list of 8', null, null, null, 0, 0, '{Wi-Fi,Quiet}', null, null, null, 'photo: cafe interior', false, false, 4, null, null, true),
  ('delhi', 'Sunday book market', null, 'Daryaganj · 9 am onwards', 'Daryaganj · 9 am', null, null, 0, 0, '{}', null, current_date + 1, 70, null, true, false, 1, null, null, true),
  ('delhi', 'Stand-up open mic night', 'Stand-up open mic', 'Connaught Place · 8 pm · ₹199', 'Connaught Place · ₹199', '₹199', null, 0, 0, '{}', null, current_date + 2, 60, null, false, false, 2, null, null, true),
  ('delhi', 'Indie gig: three Delhi bands', null, 'Hauz Khas Village · 9 pm', 'Hauz Khas Village', null, null, 0, 0, '{}', null, current_date + 4, 80, null, false, false, 3, null, null, true),
  ('delhi', 'Regional food festival', null, 'Dilli Haat, INA · all weekend', 'Dilli Haat, INA', null, null, 0, 0, '{}', null, current_date + 6, 75, null, true, false, 4, null, null, true),
  ('chill', 'Japanese Park', null, 'Rohini · 6.2 km · free · sunsets', 'Rohini · 6.2 km · free', 'free', 6.2, 0, 0, '{}', 'tree', null, null, 'photo: japanese park', true, false, 1, 2, '6.2 km · free', true),
  ('chill', 'Adventure Island', null, 'Rohini · 7 km · post-exam rides', 'Rohini · 7 km', null, 7.0, 0, 0, '{}', 'ticket', null, null, null, false, false, 2, null, null, true),
  ('chill', 'Swarna Jayanti Park', null, 'Rohini · 6.5 km · morning walks', 'Rohini · 6.5 km', 'free', 6.5, 0, 0, '{}', 'person-simple-walk', null, null, null, true, false, 3, null, null, true),
  ('chill', 'OAT after dark', null, 'On campus · the classic', 'On campus', 'free', null, 0, 0, '{}', 'moon-stars', null, null, null, true, true, 4, null, null, true);

-- ── Today at DTU ──────────────────────────────────────────────────────────
insert into public.campus_events (starts_at, ends_at, title, short_title, sub, thread_id, society_post_id, is_demo) values
  (pg_temp.at_future(8, 2),  null, 'H-6 Wi-Fi goes down', null, '140 replies', 11, null, true),
  (pg_temp.at_future(10, 15), null, 'Robotics team wins nationals, again', 'Robotics team wins nationals', '92 replies', 12, null, true),
  (pg_temp.at_future(14, 0), pg_temp.at_future(18, 0), 'Engifest passes at SPS-10', null, 'till 6 pm · bring ID', 2, null, true),
  (pg_temp.at_future(19, 0), pg_temp.at_future(22, 0), 'OAT jamming night', null, 'Music Society · 140 going', null, 1, true),
  (pg_temp.at_future(0, 0, 1), null, 'Library opens 24×7', null, null, 2, null, true);

-- ── Lounge ────────────────────────────────────────────────────────────────
insert into public.lounge_rooms (slug, label, short_label, sort, pinned_text, pinned_thread_id) values
  ('global', '#global', '#global', 1, 'Engifest passes at SPS-10 till 6', 2),
  ('coe-28', '#coe-28', '#coe-28', 2, null, null),
  ('hostel-h4', '#hostel-h4', '#hostel', 3, null, null),
  ('memes', '#memes', '#memes', 4, null, null)
on conflict do nothing;

insert into public.lounge_messages (room_slug, author_id, society_id, body, promoted_thread_id, is_demo, created_at) values
  ('global', pg_temp.u(3), null, 'koi canteen pe hai? chai pe chalo', null, true, now() - interval '9 minutes'),
  ('global', pg_temp.u(4), null, 'CN quiz postponed, confirmed by CR', null, true, now() - interval '8 minutes'),
  ('global', pg_temp.u(12), null, 'any good resource for Fourier transforms that isn''t a 3-hour lecture?', 13, true, now() - interval '7 minutes'),
  ('global', pg_temp.u(24), pg_temp.u(102), 'OAT jamming at 7 — reply to grab an open mic slot', null, true, now() - interval '5 minutes'),
  ('global', pg_temp.u(13), null, 'H-6 wifi still down. at this point it''s a lifestyle', null, true, now() - interval '3 minutes'),
  ('coe-28', pg_temp.u(22), null, 'DS lab viva moved to Thursday', null, true, now() - interval '30 minutes'),
  ('hostel-h4', pg_temp.u(6), null, 'cycle stand update: still no CCTV', null, true, now() - interval '50 minutes'),
  ('memes', pg_temp.u(11), null, 'end-sems in 19 days and I just discovered the syllabus', null, true, now() - interval '20 minutes');
update public.threads set from_lounge_message_id = (select id from public.lounge_messages where promoted_thread_id = 13 limit 1) where id = 13;
