-- DTour core schema. Entities follow design_handoff_dtour/README.md → "State".
-- Counters (thread_count, reply_count, downloads, …) are denormalised and kept
-- current by triggers in the next migration. Rows marked is_demo come from
-- supabase/seed.sql and can be removed with public.dtour_clear_demo().

create extension if not exists pg_trgm with schema extensions;

-- ── Config ────────────────────────────────────────────────────────────────
create table public.app_config (
  id            smallint primary key default 1 check (id = 1),
  launch_date   date not null default current_date,       -- "Vol. 1 · No. 214"
  location      text not null default 'Bawana Road, Delhi',
  sem_label     text not null default 'odd sem',
  sem_start     date not null default current_date,       -- "Week 11 of odd sem"
  record_online int  not null default 0,
  record_label  text,
  timezone      text not null default 'Asia/Kolkata'
);

create table public.allowed_email_domains (
  domain text primary key check (domain = lower(domain))
);

-- ── People ────────────────────────────────────────────────────────────────
create table public.branches (
  code       text primary key,             -- COE
  name       text not null,                -- Computer Engg.
  full_name  text not null,                -- Computer Engineering
  roll_code  text unique,                  -- "co" in 2k23co123
  sort       smallint not null default 0,
  file_count int not null default 0        -- Library column count ("2.1k")
);

create table public.profiles (
  id             uuid primary key references auth.users on delete cascade,
  handle         text not null unique check (handle ~ '^[a-z0-9][a-z0-9._]{2,23}$'),
  display_name   text,
  branch_code    text references public.branches,
  grad_year      smallint,                 -- 2028 → flair "COE '28"
  semester       smallint check (semester between 1 and 8),
  bio            text,
  hostel         text,
  github         text,
  linkedin       text,
  skills         text[] not null default '{}',
  open_to_teams  boolean not null default false,
  tint           text not null default 'neutral' check (tint in ('accent','accent2','neutral','accent-light')),
  karma          int not null default 0,
  thread_count   int not null default 0,
  reply_count    int not null default 0,
  accepted_count int not null default 0,
  upload_count   int not null default 0,
  download_count int not null default 0,
  onboarded      boolean not null default false,
  boards_seen_at timestamptz not null default now(), -- "139 new since your last visit"
  is_demo        boolean not null default false,
  created_at     timestamptz not null default now()
);

create table public.societies (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,               -- GDSC DTU
  short_name  text,                        -- Dramatics Soc.
  icon        text not null default 'flag-banner',
  tint        text not null default 'accent' check (tint in ('accent','accent2','neutral')),
  verified    boolean not null default true,
  description text,
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now()
);

create table public.society_members (
  society_id uuid references public.societies on delete cascade,
  user_id    uuid references public.profiles on delete cascade,
  role       text not null default 'Member',   -- "Core member"
  can_post   boolean not null default false,   -- may post as the society
  primary key (society_id, user_id)
);

-- ── Boards & threads ──────────────────────────────────────────────────────
create table public.board_categories (
  id       smallint primary key,               -- 01..05
  slug     text not null unique,
  name     text not null,                      -- Campus
  subtitle text not null,                      -- Life inside the gates
  tone     text not null check (tone in ('accent','accent2','ink')),
  icon     text not null
);

create table public.boards (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  category_id   smallint not null references public.board_categories,
  parent_id     uuid references public.boards on delete cascade,
  name          text not null,                 -- COE · 3rd semester
  short_name    text,                          -- COE · 3rd sem
  description   text,
  icon          text not null default 'chat-circle',
  verified_only boolean not null default false,-- Pata Hai Aaj Kya Hua?
  link_screen   text,                          -- societies | teams | kahan (row routes there)
  rules         text[] not null default '{}',
  thread_count  int not null default 0,
  post_count    int not null default 0,
  member_count  int not null default 0,
  sort          smallint not null default 0,
  is_demo       boolean not null default false
);
create index on public.boards (category_id, sort);
create index on public.boards (parent_id);

create table public.board_members (
  board_id uuid references public.boards on delete cascade,
  user_id  uuid references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (board_id, user_id)
);

create table public.threads (
  id                bigint generated always as identity primary key,
  board_id          uuid not null references public.boards on delete cascade,
  author_id         uuid not null references public.profiles on delete cascade,
  society_id        uuid references public.societies on delete set null,  -- posted as a society
  kind              text not null default 'thread' check (kind in ('thread','question','poll','news')),
  title             text not null check (char_length(title) between 3 and 140),
  body              text not null default '',
  standfirst        text,                       -- news italic dek
  image_label       text,                       -- placeholder label until real uploads
  image_path        text,
  tags              text[] not null default '{}',
  score             int not null default 0,
  reply_count       int not null default 0,
  accepted_reply_id bigint,
  attachment        jsonb,                      -- {name, size, library_item_id}
  poll_closes_at    timestamptz,
  from_lounge_message_id bigint,
  is_demo           boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index on public.threads (board_id, created_at desc);
create index on public.threads (author_id, created_at desc);
create index on public.threads (kind, created_at desc);
create index threads_title_trgm on public.threads using gin (title extensions.gin_trgm_ops);

create table public.replies (
  id         bigint generated always as identity primary key,
  thread_id  bigint not null references public.threads on delete cascade,
  parent_id  bigint references public.replies on delete cascade,
  author_id  uuid not null references public.profiles on delete cascade,
  society_id uuid references public.societies on delete set null,
  body       text not null check (char_length(body) between 1 and 10000),
  score      int not null default 0,
  is_demo    boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.replies (thread_id, created_at);
alter table public.threads add constraint threads_accepted_fk
  foreign key (accepted_reply_id) references public.replies on delete set null;

create table public.thread_votes (
  thread_id bigint references public.threads on delete cascade,
  user_id   uuid references public.profiles on delete cascade,
  value     smallint not null check (value in (-1, 1)),
  primary key (thread_id, user_id)
);
create table public.reply_votes (
  reply_id bigint references public.replies on delete cascade,
  user_id  uuid references public.profiles on delete cascade,
  value    smallint not null check (value in (-1, 1)),
  primary key (reply_id, user_id)
);
create table public.saves (
  user_id    uuid references public.profiles on delete cascade,
  thread_id  bigint references public.threads on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, thread_id)
);
create table public.drafts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles on delete cascade,
  kind       text not null default 'thread',
  board_id   uuid references public.boards on delete set null,
  title      text not null default '',
  body       text not null default '',
  payload    jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

create table public.poll_options (
  id        bigint generated always as identity primary key,
  thread_id bigint not null references public.threads on delete cascade,
  label     text not null,
  votes     int not null default 0,
  sort      smallint not null default 0
);
create table public.poll_votes (
  thread_id bigint references public.threads on delete cascade,
  user_id   uuid references public.profiles on delete cascade,
  option_id bigint not null references public.poll_options on delete cascade,
  primary key (thread_id, user_id)
);

-- ── Karma & activity ──────────────────────────────────────────────────────
create table public.karma_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles on delete cascade,
  bucket     text not null,                  -- board name or 'Library uploads'
  amount     int not null,
  reason     text not null,
  created_at timestamptz not null default now()
);
create index on public.karma_events (user_id, created_at desc);

create table public.activities (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles on delete cascade,
  kind       text not null check (kind in ('accepted','upload','thread','wiki_edit','team','reply')),
  kicker     text not null,                  -- "Accepted answer · Academics"
  title      text not null,
  meta       text,
  route      text not null,                  -- /b/academics/12
  created_at timestamptz not null default now()
);
create index on public.activities (user_id, created_at desc);

create table public.badges (
  id      bigint generated always as identity primary key,
  user_id uuid not null references public.profiles on delete cascade,
  icon    text not null,
  tone    text not null default 'accent',
  label   text not null,
  created_at timestamptz not null default now()
);

-- ── Wiki ──────────────────────────────────────────────────────────────────
create table public.wiki_categories (
  id   smallint primary key,
  slug text not null unique,
  name text not null,                        -- GPA & exams
  pill text not null,                        -- pill label on the index
  tone text not null check (tone in ('accent','accent2','ink'))
);

create table public.wiki_articles (
  id            bigint generated always as identity primary key,
  slug          text not null unique,
  category_id   smallint references public.wiki_categories,
  board_id      uuid references public.boards on delete set null,
  title         text not null,
  dek           text,
  body          text not null default '',    -- markdown: ### sections, > [!senior] quotes
  cover_label   text,
  started_by    uuid references public.profiles on delete set null,
  checked_by    uuid references public.profiles on delete set null,
  checked_at    date,
  read_minutes  smallint not null default 5,
  editor_count  int not null default 1,
  useful_count  int not null default 0,
  talk_count    int not null default 0,
  views_week    int not null default 0,
  is_demo       boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.wiki_revisions (
  id          bigint generated always as identity primary key,
  article_id  bigint not null references public.wiki_articles on delete cascade,
  editor_id   uuid not null references public.profiles on delete cascade,
  summary     text not null,
  delta_words int,
  body        text,
  status      text not null default 'published' check (status in ('published','suggested','rejected')),
  created_at  timestamptz not null default now()
);
create index on public.wiki_revisions (article_id, created_at desc);

create table public.wiki_talk (
  id         bigint generated always as identity primary key,
  article_id bigint not null references public.wiki_articles on delete cascade,
  author_id  uuid not null references public.profiles on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

create table public.wiki_feedback (
  article_id bigint references public.wiki_articles on delete cascade,
  user_id    uuid references public.profiles on delete cascade,
  useful     boolean not null,
  primary key (article_id, user_id)
);

-- ── Library ───────────────────────────────────────────────────────────────
create table public.subjects (
  code        text primary key,               -- CO201
  name        text not null,                  -- Data Structures
  short_name  text,                           -- Object Oriented Prog.
  branch_code text not null references public.branches,
  semester    smallint not null,
  professor   text,
  credits     smallint,
  exam_on     date,                           -- next end-sem paper
  notes_count int not null default 0,
  pyq_count   int not null default 0,
  lab_count   int not null default 0,
  thread_count int not null default 0,
  sort        smallint not null default 0
);
create index on public.subjects (branch_code, semester, sort);

create table public.library_items (
  id             bigint generated always as identity primary key,
  subject_code   text not null references public.subjects on delete cascade,
  kind           text not null check (kind in ('notes','pyq','lab','slides')),
  title          text not null,
  format         text not null default 'PDF',
  size_bytes     bigint,
  storage_path   text,
  uploader_id    uuid references public.profiles on delete set null,
  downloads      int not null default 0,
  downloads_week int not null default 0,
  top_rated      boolean not null default false,
  is_demo        boolean not null default false,
  created_at     timestamptz not null default now()
);
create index on public.library_items (subject_code, kind, downloads desc);
create index library_title_trgm on public.library_items using gin (title extensions.gin_trgm_ops);

create table public.library_downloads (
  id         bigint generated always as identity primary key,
  item_id    bigint not null references public.library_items on delete cascade,
  user_id    uuid references public.profiles on delete set null,
  created_at timestamptz not null default now()
);

create table public.exam_windows (
  id          bigint generated always as identity primary key,
  branch_code text references public.branches,   -- null = everyone
  semester    smallint,
  label       text not null default 'End-sems',
  starts_on   date not null
);

-- ── Societies board ───────────────────────────────────────────────────────
create table public.society_posts (
  id           bigint generated always as identity primary key,
  society_id   uuid not null references public.societies on delete cascade,
  author_id    uuid references public.profiles on delete set null,
  kind         text not null check (kind in ('event','recruiting','workshop','talk')),
  title        text not null,
  body         text,
  when_label   text not null,                   -- "tonight 7 pm"
  short_when   text,                            -- Today strip: "till Sun"
  where_label  text,
  starts_at    timestamptz,
  rsvp_count   int not null default 0,
  rsvp_word    text not null default 'going',   -- going | interested
  apply_url    text,
  meta_note    text,                            -- "no experience needed"
  featured     boolean not null default false,
  poster_label text,
  poster_path  text,
  is_demo      boolean not null default false,
  created_at   timestamptz not null default now()
);
create index on public.society_posts (created_at desc);

create table public.rsvps (
  post_id    bigint references public.society_posts on delete cascade,
  user_id    uuid references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- ── Team Up ───────────────────────────────────────────────────────────────
create table public.teams (
  id             bigint generated always as identity primary key,
  owner_id       uuid not null references public.profiles on delete cascade,
  category       text not null check (category in ('hackathon','project','competition','research')),
  event_name     text not null,                 -- Smart India Hackathon
  event_short    text,                          -- SIH
  event_tone     text not null default 'accent' check (event_tone in ('accent','accent2','neutral')),
  title          text not null,
  short_title    text,                          -- Today box: "SIH · crop-disease ML tool"
  description    text,
  deadline_label text,                          -- "3 days left" fallback
  deadline_on    date,
  urgent         boolean not null default false,
  extra_members  int not null default 0,        -- "+9"
  is_demo        boolean not null default false,
  created_at     timestamptz not null default now()
);

create table public.team_roles (
  id        bigint generated always as identity primary key,
  team_id   bigint not null references public.teams on delete cascade,
  name      text not null,
  filled_by uuid references public.profiles on delete set null,
  filled    boolean not null default false,
  sort      smallint not null default 0
);

create table public.team_members (
  team_id bigint references public.teams on delete cascade,
  user_id uuid references public.profiles on delete cascade,
  primary key (team_id, user_id)
);

create table public.team_requests (
  team_id    bigint references public.teams on delete cascade,
  user_id    uuid references public.profiles on delete cascade,
  status     text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create table public.deadlines (
  id         bigint generated always as identity primary key,
  on_date    date not null,
  title      text not null,
  sub        text,
  highlight  boolean not null default false,
  is_demo    boolean not null default false
);

-- ── Kahan chalein? ────────────────────────────────────────────────────────
create table public.places (
  id            bigint generated always as identity primary key,
  category      text not null check (category in ('canteen','nearby','delhi','chill')),
  name          text not null,
  short_name    text,
  where_label   text,                           -- Main canteen · after 10 pm
  short_where   text,                           -- mobile copy
  price_label   text,                           -- ₹60 · ₹₹ · free
  distance_km   numeric(5,1),
  hearts        int not null default 0,
  recs          int not null default 0,
  tags          text[] not null default '{}',
  icon          text,
  event_on      date,
  metro_minutes smallint,
  image_label   text,
  image_path    text,
  under_100     boolean not null default false,
  on_campus     boolean not null default false,
  sort          smallint not null default 0,
  home_sort     smallint,                      -- Today page "Kahan chalein?" picks
  home_meta     text,                          -- "5.8 km · ₹"
  author_id     uuid references public.profiles on delete set null,
  is_demo       boolean not null default false,
  created_at    timestamptz not null default now()
);

create table public.place_hearts (
  place_id bigint references public.places on delete cascade,
  user_id  uuid references public.profiles on delete cascade,
  primary key (place_id, user_id)
);

-- ── Today timeline ────────────────────────────────────────────────────────
create table public.campus_events (
  id         bigint generated always as identity primary key,
  starts_at  timestamptz not null,
  ends_at    timestamptz,
  title      text not null,
  short_title text,
  sub        text,                               -- "140 replies", "till 6 pm · bring ID"
  thread_id  bigint references public.threads on delete set null,
  society_post_id bigint references public.society_posts on delete set null,
  is_demo    boolean not null default false
);
create index on public.campus_events (starts_at);

-- ── Lounge ────────────────────────────────────────────────────────────────
create table public.lounge_rooms (
  slug             text primary key,              -- global
  label            text not null,                 -- #global
  short_label      text,                          -- web drawer label (#hostel)
  sort             smallint not null default 0,
  pinned_text      text,
  pinned_thread_id bigint references public.threads on delete set null
);

create table public.lounge_messages (
  id                 bigint generated always as identity primary key,
  room_slug          text not null references public.lounge_rooms on delete cascade,
  author_id          uuid not null references public.profiles on delete cascade,
  society_id         uuid references public.societies on delete set null,
  body               text not null check (char_length(body) between 1 and 1000),
  promoted_thread_id bigint references public.threads on delete set null,
  is_demo            boolean not null default false,
  created_at         timestamptz not null default now()
);
create index on public.lounge_messages (room_slug, created_at desc);
alter table public.threads add constraint threads_lounge_fk
  foreign key (from_lounge_message_id) references public.lounge_messages on delete set null;
