# Handoff: DTour — DTU campus community platform

## Overview
DTour is a single place for DTU students: campus news ("Pata hai aaj kya hua?"), discussion boards, wiki-style student articles, a notes/PYQ library, society promotion, hackathon team-finding, food/hangout recommendations ("Kahan chalein?"), and a global live chat ("Lounge"). The design goal: keep classic forum mechanics (boards, votes, karma, flairs) but feel modern enough for students who don't normally use forums.

## About the design files
The files in this bundle are **design references built in HTML** — a clickable prototype showing intended look and behaviour, **not production code**. Recreate them in the target codebase using its own patterns. If no codebase exists yet, a sensible default is **Next.js (App Router) + TypeScript + Tailwind (or CSS Modules with CSS variables)**, with Postgres for data and a websocket service (e.g. Supabase Realtime / Socket.IO) for the Lounge.

Two clickable prototypes ship in `prototype/` — serve the folder locally (`npx serve prototype`) and open:
- `DTour Prototype.dc.html` — **website** (desktop, 1280px).
- `DTour Mobile Prototype.dc.html` — **mobile app** (390×844 phone frame, with a screen index on the left).

Both are final. `explorations/` holds earlier direction rounds and static mobile screens for context only.

**Suggested build:** one shared backend/API and design-token package; web in Next.js, mobile in **React Native (Expo)** so tokens, data models and the fuzzy-search ranking can be shared. A responsive web build is acceptable for v1 if the app comes later — follow the mobile spec below at < 768px.

## Fidelity
**High-fidelity.** Colours, type, spacing and copy are final-intent. Recreate pixel-close using the tokens below. Copy is realistic placeholder content — data must come from the backend.

## Global layout
- Content column: `max-width: 1280px`, centred, horizontal padding `48px`.
- Ground: `--color-bg #f3f2f2`; text `--color-text #201e1d`.
- Font: **Source Serif 4** everywhere (400, 600, italic 400). No sans-serif in UI chrome.
- Icons: **Phosphor, duotone weight** (`@phosphor-icons/web` or `@phosphor-icons/react` with `weight="duotone"`).
- Structure comes from whitespace and type scale. Boxes (`--color-surface #eae9e9`, radius 2px) are used only for discrete items: cards, board "desks", inputs, side modules.

### Header (all pages)
1. **Dateline row** (home only): 13px, `--color-neutral-700` — "Vol. 1 · No. 214 · {date} · Bawana Road, Delhi" left; "{n} in the Lounge" right with `users-three` icon in accent.
2. **Brand row** (padding 18px 48px): 
   - Logo: two 34×34 speech-bubble shapes (`border-radius: 50% 50% 50% 0`), cyan `#0088b0` at (0,0) and magenta `#d6006c` at (4px,3px), both `mix-blend-mode: multiply` → dark overlap. Wordmark "DTour" 600 48px/0.9, letter-spacing −0.035em. Clicking → Home.
   - Tagline: italic 18px, neutral-700, "The campus, all in one place."
   - Right cluster (gap 12px): Search trigger (280×40, surface fill, "Search anything", `/` key hint chip) · Primary button "Post" (pencil icon) → Post page · bell icon · 36px avatar circle (accent-200 fill, accent-800 initials) → Profile.
3. **Section nav**: 3px solid ink top rule + 1px ink bottom rule (the newspaper "thick-thin" pair), padding 10px 0, items 600 15px, gap 28px: Today · Boards · Articles · Library · Societies · Team Up · Kahan chalein?. Active item = accent colour (`aria-current="page"`). Right end: "End-sems in **19 days** · Your sem 3 notes →" (hourglass icon in magenta) — a per-user countdown to their next exam window.
4. **Floating Lounge button**: fixed bottom-right 28px, primary button 48px tall, "Lounge · 412 online". Opens the Lounge drawer.

## Screens

### 1. Today (home)
- **Lead row** grid `7fr / 4fr`, gap 56px, top padding 36px.
  - Left — lead news story: kicker "PATA HAI AAJ KYA HUA? · 2:05 PM" (11px, tracking .12em, uppercase, accent-2-700); H1 46px/1.06 balanced; italic standfirst 19px; 280px halftone image; meta row (author with verified seal, reply count, "Join the thread →").
  - Right — **Today at DTU**: large plate numeral of the date (`.cmyk-num`, 104px; three misregistered C/M/Y text plates, see `tokens/broadsheet.css`), label "SAT · WEEK 11 OF ODD SEM", title 28px. Below: vertical timeline rows `54px time | 14px dot | text`. Past = neutral-500 filled dot; **NOW** = magenta filled dot + magenta label; upcoming = 2px cyan ring.
- **From the boards** (padding-top 72px): H2 + tabs Hot / New / Top this week / My branch (active = 2px accent underline) + "All 22 boards →".
  - Feature row grid `2fr / 1fr`: featured thread (vote column 52px; tag, author, flair; title 32px; excerpt 17px; meta icons) | wiki guide (150px halftone, kicker, 23px title).
  - **Board desks** — 4-column grid, gap 20px. Each desk is a box: surface fill, radius 2px, padding 18/22/22, **3px top border in the category colour** (Campus cyan, Padhai magenta, Career cyan, Bahar ink). Header: "01" number + name 19px + icon right. Two thread items (17px title, 13px meta). Footer link "More in {name} →".
  - Two-up boxes (gap 20px): "Teams looking for you" (team, deadline, needed roles) | "Kahan chalein?" (3 place thumbnails 90px).
- **Society board** strip: H2 + type tags + 4 columns of society posts (kicker with type/date, 19px title, society name + verified seal + RSVP count).

### 2. Boards (index)
- Title "The Boards" 54px + italic standfirst; stats right (members, posts, online now in accent).
- Category blocks: header row = plate numeral (64px `.cmyk-num`) + H3 in category ramp-800 + subtitle; 3px bottom border in category colour; column headers THREADS / POSTS / LATEST.
- Board row grid `52px | 1fr | 90px | 90px | 270px`, padding 18px 0, divider `color-mix(text 8%)`: 48px tinted icon tile (ramp-100 bg, ramp-700 icon) · name 19px + "48 new" magenta tag + description + sub-board links · thread count · post count · latest post (avatar, ellipsised title, handle · time).
- Smaller categories render as 3 columns (number 34px, H4, icon + name + counts).
- Footer "Who's online · 412" surface box with handle list, newest member, record online.
- Categories: 01 Campus (Campus Buzz, Pata Hai Aaj Kya Hua? — verified/read-only), 02 Padhai (Academics with branch sub-boards, Exams & Results), 03 Career (Placements & Internships, Team Up, Roadmaps & New Fields), 04 Culture (Fests, Societies, Made at DTU), 05 Bahar (Food & Hangouts, Rides & Commute, Off-topic).

### 3. Thread
- Grid `1fr / 300px`, gap 64px. Breadcrumb. Vote rail (48px: up, score, down, save, share). Tags, H1 40px, author row (avatar, handle, flair tag e.g. "IT '27", karma, time). Body 17px/1.65, max 680px. Attachment box (surface) linking to Library location.
- Replies header "63 replies" + sort Best / Newest / Oldest. Reply composer (surface). Replies: 36px avatar; society authors get icon avatar + seal + "Society"; **Accepted** tag (accent) on the accepted answer; nested replies indented with 2px neutral-300 left rule; OP tag (accent-2).
- Sidebar: About this board (Join button), Related in Library, Wiki link.

### 4. Article (wiki)
- Grid `200px TOC | 1fr | 250px`. Tabs Read / Edit / History / Talk · n. H1 52px; italic dek 21px; contributor avatars stack (−8px overlap, 2px bg ring), "Started by … · 14 editors · 9 min", "Checked by a senior · Oct 2026" (shield-check). Body 18px/1.7, max 680px, H3 sections, "From a senior" pull quote in surface box (italic 19px). Footer: useful? thumbs + "Suggest an edit".
- Sidebar: Recent edits (+/− word deltas in accent / accent-2), More guides, Talk.

### 5. Library
- Title + search ("Search subjects, codes like CO201") + Upload button.
- Three-column browser `220px Branch | 170px Semester | 1fr Subjects`, 1px dividers. Selected item = accent-100 fill, accent-800 text, caret. Subject rows: code (13px) · name 19px + counts (notes / PYQs / lab files) · status tag ("End-sem in 19d" magenta) or caret.
- "Most downloaded this week" — 3 `.card`s (kicker, title, meta with download count).

### 6. Societies (Society board)
- Title + "Promote an event" primary. Filter pills: All · Events · Recruitments · Workshops · Talks & lectures.
- 3-column masonry (`columns: 3`). Featured event = accent-2-100 box. Items: kicker (type · when · where), 24px title, description, society + seal + RSVP/"Apply".

### 7. Team Up
- Title, buttons "I'm looking for a team" (secondary) + "Post a team" (primary). Filter pills with counts + "Needs my skills" filter.
- Grid `1fr / 300px`. Left: 2-col team cards (`.card`, padding 22px): event tag + deadline, 21px title, description, roles (filled = check-circle neutral; open = dashed circle accent, bold), member avatars, "Ask to join".
- Right: Upcoming deadlines (date numerals), "Looking for a team" people list.

### 8. Kahan chalein?
- Title 54px + "Recommend a place". Filter pills: Everything · On campus · Khaana nearby · Events in Delhi · Chill spots · Under ₹100.
- Numbered sections, each with a 3px coloured bottom rule under the header: 01 Canteen favourites (4 cols: item, where, price, hearts) · 02 Khaana nearby (4 cols with 150px halftone images, distance/price, tags) · 03 This week in Delhi (date numeral | title + venue | metro travel time from Samaypur Badli) · 04 Chill spots (icon list).

### 9. Post (composer)
- Grid `1fr / 300px`. H1 "What do you want to share?".
- **Type** selector: 6 tiles (Thread, Question, Wiki article, Team, Poll, Society post). Selected tile: accent-100 fill, inset 2px accent ring.
- Two-up: "Post in" board picker (colour square + path, leaf in 600) with suggested boards; "Posting as" (avatar, handle, flair, Change).
- Title: borderless input, 600 30px, 2px ink underline, counter /140 and helper text.
- Body: toolbar (bold, italic, link, quote, code, list, LaTeX, image, attach; "Markdown + LaTeX supported") + textarea 180px min; dashed drop zone (files are also filed into the Library).
- Type-specific blocks: Poll (options, add option, duration segmented 1d/3d/1w) · Team (event, close date, role chips) · Society post (kind segmented, when, where, verified note) · Wiki (shared-edit notice with templates).
- Tags field; footer: notify checkbox, Save draft (ghost), Preview (secondary), Post (primary).
- Sidebar: **Already asked?** — live similar-thread suggestions while the title is typed (prototype: word overlap; production: full-text/semantic search). Board rules. Karma rules.

### 10. Profile
- Header: 112px avatar, handle H1 46px + flair tags, italic bio, joined / hostel / GitHub / LinkedIn, Settings + Edit profile.
- Stats row: karma as 72px plate numeral + weekly delta; threads, replies, accepted answers (accent), Library uploads, downloads.
- Grid `1fr / 320px`. Tabs Activity · Threads · Replies · Uploads · Saved · Drafts. Activity rows (icon, kind kicker, 18px title, meta) link to their targets.
- Sidebar boxes: karma by board (bars), Open to teams toggle + skills, Societies (with roles), Badges.

### Overlays
- **Lounge drawer**: fixed right, 360px, full height, `--shadow-lg`. Header (title, online count, close), room tabs (#global, #coe-28, #hostel, #memes), message list (handle 13px bold + time; text 15px), "Became a thread in …" chip for promoted messages, composer with send button.
- **Search (fzf-style command palette)**: see below.

## Interactions & behaviour
- Nav items, logo, avatar, "Post", thread/article/library links all route. Current screen persisted (prototype uses `localStorage['dtour_screen']`; production = real routes: `/`, `/boards`, `/b/[board]/[threadId]`, `/wiki/[slug]`, `/library/[branch]/[sem]/[subject]`, `/societies`, `/teams`, `/kahan-chalein`, `/new`, `/u/[handle]`).
- **Search palette**
  - Open: click search field, `/` (when not typing), or `⌘K / Ctrl+K`. Close: Esc or backdrop click.
  - 960×540 modal, 80px from top. Prompt "›" in magenta, input 20px, live counter `matched/total`, Esc chip.
  - Scope pills: All, Threads, Articles, Library, People, Boards, Societies, Places. `Tab` / `Shift+Tab` cycles scope. Prefixes: `@` people, `#` boards, `lib:` library.
  - Fuzzy subsequence matching, ranked: +8 for consecutive char, +6 for word-start, +1 otherwise, small length penalty. Matched characters rendered bold in accent-2-700.
  - Left list: selected row = accent-100 fill + 4px accent bar. `↑/↓` (or Ctrl+J/K) move, Enter opens, hover selects. Right pane previews selected item (kind, title, meta, snippet, "↵ Open").
  - Empty state: "Nothing matches. Ask it as a new thread →".
  - Production: back with a search index (Postgres FTS / Meilisearch / Typesense) and keep client-side fuzzy re-ranking for the fzf feel.
- Post type tiles switch the type-specific form block. Title updates similar-thread suggestions as you type.
- Hover: links → accent-800; primary button → accent-600, active accent-700; secondary → 7% ink tint. Focus: `outline: 2px solid var(--color-accent); outline-offset: 2px`.
- Responsive: website is designed at 1280px; below 768px use the mobile app spec (next section).

## Mobile app
Prototype: `prototype/DTour Mobile Prototype.dc.html`. Same tokens, type and content as the website; this section covers only what differs.

### Shell
- Frame 390×844 (iPhone 14/15 class). Status bar 47px. Screens scroll inside; fixed bars sit above the home indicator (bottom padding 26–30px).
- **Bottom tab bar** (fixed, bg + 1px top divider, padding 6/8/26): Today (`sun-horizon`) · Boards (`squares-four`) · **Post** (48×36 accent block with `plus`, no label) · Lounge (`chats-circle`) · You (`user-circle`). Icons 25px, labels 11px; active = accent-700 + 600 weight.
- Tabs reset the stack; every other screen pushes onto a **back stack** (caret-left in a 44px hit area, top-left). Post opens modally with an ✕.
- App bar: back · title 600 16px + 12px subtitle · up to two 44px icon actions.
- **Minimum hit target 44×44px** everywhere. Pills are 36px tall with 14px side padding; primary actions 44px.
- Horizontal pill rows and card carousels scroll sideways (no visible scrollbar).

### Screens
1. **Today** — logo + DTour 27px, search + bell. Thick/thin rule strip: date · "End-sems in 19 days" (→ Library). Round shortcuts (52px circles, tinted): Library, Societies, Team Up, Kahan chalein?, Articles (→ Wiki index). Lead news (kicker, 25px headline, 150px halftone). "Today at DTU": 56px plate numeral + timeline (44px time | 12px dot | title). "From the boards": three thread rows with category kicker.
2. **Boards** — 32px title, online/new line. Categories as in web (number 30px in ramp-700, 20px name, 3px category rule). Rows 66px: 42px tinted icon tile, 17px name, meta, magenta new-count tag or caret. Culture → Societies, Bahar → Kahan chalein?, Team Up row → Team Up.
3. **Thread** — tags, 25px title, author/flair, body 16px/1.6, attachment row (→ Library), action row: vote pill (toggles: accent-100 → solid accent, count +1), replies, save, share. Replies with Accepted tag, OP tag, nested rule. **Fixed reply bar** at bottom.
4. **Wiki index** (from Articles shortcut) — "The Wiki" 32px, italic stats line, topic pills (GPA & exams, Placements, Roadmaps, New fields, Campus life), featured "Most read this week" (150px image), numbered categories with article rows (title 16.5px, editors · read time, shield-check if senior-checked), "Missing a guide?" prompt. Pencil action → Post (Wiki type).
5. **Wiki article** — 32px title, italic dek, editor avatars, "Checked by a senior", collapsible "On this page" bar (44px), body 16.5px/1.65, senior quote box. **Fixed bottom bar**: useful count, Talk, "Suggest edit" primary.
6. **Library** — branch title in app bar, "Semester 3" 30px, counts, search (→ Search), semester pills, subject rows 64px (name 17.5px, code · counts, exam tag) → **Subject files**. "Most downloaded" card.
7. **Subject files** (e.g. CO201 Data Structures) — title 28px, exam tag, professor · credits. Filter pills **All / PYQs / Notes / Lab files / Threads** (functional). File rows: 42×48 tile with type icon (PDF magenta, notes cyan, slides, code), 15.5px title, format · size · uploader, optional "Top rated" tag, 44px download action with count. Threads section links to discussions. Floating **Upload** button (48px, bottom-right above tabs).
8. **Society board** — filter pills; featured event box (accent-2-100) with RSVP button that toggles "I'm going" ↔ "Going ✓" and the count; list of society posts with RSVP / Apply.
9. **Team Up** — filter pills; "You're open to teams" banner (→ Profile); team cards with filled/open roles; "Ask to join" toggles to "Requested ✓".
10. **Kahan chalein?** — filter pills; numbered sections: Canteen favourites (sideways carousel, 140px items), Khaana nearby (200px image cards), This week in Delhi (date | title | metro time), Chill spots.
11. **New post** (modal) — ✕, title, Post. Type pills (selected = accent-100 + 2px inset accent ring). Board picker (46px). Title input 23px with 2px ink underline and /140 counter; **"Already asked?"** card appears when title words match an existing thread (tap → that thread). Body textarea. Formatting toolbar pinned above keyboard (image, attach, bold, link, code, LaTeX, tag).
12. **You** — handle bar with edit/settings, 76px avatar, flairs, bio, 52px karma plate numeral, 4-up stats, "Open to teams" row, tabs (Activity / Threads / Saved / Library), activity rows that deep-link.
13. **Search** (full screen, from any magnifier) — "›" prompt + autofocused input + `n/total` counter + Cancel. Scope pills (All, Threads, Library, People, Boards, Places). Same fuzzy ranking and highlight as web; selected row accent-100 + 4px bar; preview card for the top result; prefix hints `@ # lib:`. Enter opens top result.
14. **Lounge** (tab) — title + online count, room tabs (#global, #coe-28 with unread tag, #hostel-h4, #memes), pinned news banner, messages (32px avatar, handle, flair, time), "Became a thread" chip, composer (44px input + send; Enter sends and appends your message).

### Mobile-specific behaviour
- Back stack per tab; Android back = pop. Persist last screen (prototype: `localStorage['dtour_m_stack']`).
- Pull-to-refresh on Today, Boards, Lounge. Lounge uses realtime updates; push notifications for replies, accepted answers, RSVP'd events, team requests.
- Optimistic UI for votes, RSVP, join requests and Lounge sends.
- Downloads open the system PDF viewer / share sheet; Upload uses the document picker and asks for type (Notes / PYQ / Lab) + subject.

## State (prototype → production)
- `screen` → router. `lounge` (drawer open). `searchOpen, q, sel, scope`. `postType, title`.
- Entities: User (handle, branch, year, karma, bio, skills, openToTeams, societies[]), Board (category, parent, colour, rules), Thread (board, author, title, body, tags, votes, acceptedReplyId, attachments), Reply (thread, parent, author, votes), WikiArticle (+ revisions, editors, checkedBy/At, talk), LibraryItem (branch, sem, subjectCode, type: notes|pyq|lab, file, downloads), Society (verified), SocietyPost (kind: event|recruiting|workshop|talk, when, where, rsvps), Team (event, deadline, roles[{name, filledBy}]), Place (category, distance, price, hearts, recs), CampusEvent/NewsItem (time, verified source) for the Today timeline, LoungeMessage (room, author, text, promotedThreadId).
- Karma: +10 per upvote received, +25 on accepted answer (shown on Post page).

## Design tokens (from `tokens/broadsheet.css`)
- Colours: bg `#f3f2f2` · surface `#eae9e9` · text `#201e1d` · accent (cyan) `#0088b0` · accent-2 (magenta) `#d6006c` · process yellow `#edbb00` (print treatments only) · divider `color-mix(#201e1d 16%)`.
- Ramps 100→900: neutral `#f8f4f4 #eae7e7 #d7d3d3 #bab6b6 #9b9797 #7d7979 #605d5d #444141 #2d2b2b`; accent `#e9f8ff #cbeeff #99e0ff #62c5ee #38a6cf #1186ac #006786 #004961 #0a303e`; accent-2 `#fff1f4 #ffdee6 #ffc0d0 #ff90b1 #ff458e #d82071 #aa0b56 #790e3d #4b1528`.
- Use 700+ steps for small text on the ground; the 500 accents are for icons, large type and fills.
- Type: Source Serif 4. Scale used: 11 (kickers, caps .12em) · 12.5–13.5 (meta) · 14.5–16 (UI/body small) · 17–18 (body) · 19–25 (titles) · 28–32 (section) · 40–54 (page H1) · 64–168 (plate numerals). Headings 600, line-height 1.02–1.3, letter-spacing −0.015 to −0.035em.
- Spacing scale: 5, 10, 15, 20, 30, 40px (density 1.25×); layout gaps 20 / 40 / 56 / 64px; section spacing 36–72px.
- Radius: 1 / 2 / 4px. Avatars are circles.
- Shadows: sm `0 1px 2px rgba(45,43,43,.14)` · md `0 3px 10px rgba(45,43,43,.16)` · lg `0 12px 32px rgba(45,43,43,.22)`.
- Special treatments: `.halftone` (3px dot screen over images), `.cmyk-num` (plate numerals) — copy the CSS from `tokens/broadsheet.css`.

## Assets
- Icons: Phosphor duotone (MIT).
- Font: Source Serif 4 (Google Fonts, OFL).
- All imagery is placeholder (striped halftone boxes labelled with what goes there: news photo, cover image, society poster, food/place photos, map). Replace with real uploads; apply `.halftone` styling.
- Logo is CSS-only (two overlapping bubble shapes) — export to SVG for favicon/app icon.

## Files
- `prototype/DTour Prototype.dc.html` — website prototype (all screens + search palette + Lounge drawer).
- `prototype/DTour Mobile Prototype.dc.html` — mobile app prototype (14 screens, back stack, live search, Lounge send, RSVP/join/vote toggles, subject file filters). Both need `support.js` and the `_ds/` folder next to them.
- `tokens/broadsheet.css` — the full token sheet and component classes (buttons, tags, inputs, segmented control, cards, nav, plate numerals, halftone).
- `explorations/DTour Explorations.dc.html` — earlier website direction rounds (home variants, classifieds, Lounge-first) for reference.
- `explorations/DTour Mobile Screens.dc.html` — static overview of the mobile screens side by side.
- `screenshots/web/` — 14 captures of the website (viewport at 72% zoom, so each shows the top of the page; open the prototype for full length): today-hero, today-boards, today-societies, boards, thread, article, library, societies, team-up, kahan-chalein, post, profile, search, lounge-drawer.
- `screenshots/mobile/` — 14 phone captures: today, boards, thread, wiki-index, wiki-article, library, subject-files, society-board, team-up, kahan-chalein, new-post, profile, search, lounge.
- Screenshots are quick visual references; the prototypes and this README are the source of truth for exact values.
