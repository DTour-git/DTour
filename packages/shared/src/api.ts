// Data access shared by web and mobile. Every function takes a Supabase client
// (server or browser on web, AsyncStorage-backed on mobile) so the queries,
// shapes and business rules live in one place.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { istDate, daysUntil } from './format';
import { rank, titleWords, overlap, type SearchDoc, type SearchKind } from './fuzzy';
import type { Tint, Tone } from './tokens';

export type DB = SupabaseClient<Database>;
type Tables = Database['public']['Tables'];
export type ProfileRow = Tables['profiles']['Row'];
export type BoardRow = Tables['boards']['Row'];
export type CategoryRow = Tables['board_categories']['Row'];
export type SocietyRow = Tables['societies']['Row'];
export type PlaceRow = Tables['places']['Row'];
export type SubjectRow = Tables['subjects']['Row'];
export type BranchRow = Tables['branches']['Row'];
export type LibraryItemRow = Tables['library_items']['Row'];
export type ConfigRow = Tables['app_config']['Row'];

// ── View models ───────────────────────────────────────────────────────────
export interface PersonLite {
  id: string; handle: string; display_name: string | null; branch_code: string | null;
  grad_year: number | null; tint: Tint; karma: number;
}
export interface SocietyLite { id: string; slug: string; name: string; short_name: string | null; icon: string; tint: string; verified: boolean }
export interface BoardLite { id: string; slug: string; name: string; short_name: string | null; category_id: number; verified_only: boolean; parent_id: string | null }
export interface Attachment { name: string; size?: string; subject?: string; library_item_id?: number }

export interface ThreadCard {
  id: number; title: string; body: string; standfirst: string | null; kind: string;
  score: number; reply_count: number; created_at: string; tags: string[];
  attachment: Attachment | null; image_label: string | null; image_path: string | null;
  accepted_reply_id: number | null; board: BoardLite; author: PersonLite; society: SocietyLite | null;
  edited_at: string | null; poll_pct?: number | null;
}

export interface ReplyNode {
  id: number; thread_id: number; parent_id: number | null; body: string; score: number; created_at: string;
  edited_at: string | null; deleted_at: string | null; author: PersonLite; society: SocietyLite | null; children: ReplyNode[]; myVote: number;
}

const PERSON = 'id,handle,display_name,branch_code,grad_year,tint,karma';
const SOCIETY = 'id,slug,name,short_name,icon,tint,verified';
const BOARD = 'id,slug,name,short_name,category_id,verified_only,parent_id';
export const THREAD_SELECT =
  `id,title,body,standfirst,kind,score,reply_count,created_at,tags,attachment,image_label,image_path,accepted_reply_id,edited_at,` +
  `board:boards!inner(${BOARD}),author:profiles!threads_author_id_fkey(${PERSON}),society:societies(${SOCIETY})`;

type Ok<R> = R extends { data: infer D; error: null } ? D : never;
function must<R extends { data: unknown; error: { message: string } | null }>(r: R): Ok<R> {
  if (r.error) throw new Error(r.error.message);
  return r.data as Ok<R>;
}

// ── Session & config ──────────────────────────────────────────────────────
export interface Me { userId: string; email: string | null; profile: ProfileRow }

export async function getMe(sb: DB): Promise<Me | null> {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const profile = must(await sb.from('profiles').select('*').eq('id', user.id).maybeSingle());
  if (!profile) return null;
  return { userId: user.id, email: user.email ?? null, profile };
}

export async function getConfig(sb: DB): Promise<ConfigRow | null> {
  return must(await sb.from('app_config').select('*').eq('id', 1).maybeSingle());
}

/** "End-sems in 19 days" — most specific upcoming exam window for the viewer. */
export async function getExamCountdown(sb: DB, profile: ProfileRow | null) {
  const today = istDate();
  const rows = must(await sb.from('exam_windows').select('*').gte('starts_on', today).order('starts_on'));
  const pick = rows.find((w) => w.branch_code === profile?.branch_code && w.semester === profile?.semester)
    ?? rows.find((w) => w.branch_code === profile?.branch_code && w.semester == null)
    ?? rows.find((w) => w.branch_code == null);
  if (!pick) return null;
  return { label: pick.label, days: daysUntil(pick.starts_on), semester: profile?.semester ?? null };
}

export async function updateProfile(sb: DB, id: string, patch: Tables['profiles']['Update']) {
  return must(await sb.from('profiles').update(patch).eq('id', id).select('*').single());
}

export async function handleAvailable(sb: DB, handle: string, myId: string) {
  const { data } = await sb.from('profiles').select('id').eq('handle', handle).maybeSingle();
  return !data || data.id === myId;
}

// Same rule as the profiles.handle check constraint.
export const HANDLE_RE = /^[a-z0-9][a-z0-9._]{2,23}$/;
export function normalizeHandle(raw: string) { return raw.trim().replace(/^@/, '').toLowerCase(); }
/** Returns a message explaining what's wrong with the handle, or null if it's valid. */
export function handleProblem(raw: string): string | null {
  return HANDLE_RE.test(normalizeHandle(raw)) ? null : 'Handles are 3–24 characters: lowercase letters, numbers, dots and underscores, starting with a letter or number.';
}
/** Checks and saves a new handle. Returns the saved handle. */
export async function changeHandle(sb: DB, userId: string, raw: string) {
  const h = normalizeHandle(raw);
  const problem = handleProblem(h);
  if (problem) throw new Error(problem);
  if (!(await handleAvailable(sb, h, userId))) throw new Error(`@${h} is taken. Try another.`);
  const { error } = await sb.from('profiles').update({ handle: h }).eq('id', userId);
  if (error?.code === '23505') throw new Error(`@${h} is taken. Try another.`);
  if (error) throw new Error(error.message);
  return h;
}

export async function getBranches(sb: DB) {
  return must(await sb.from('branches').select('*').order('sort'));
}

// ── Threads ───────────────────────────────────────────────────────────────
async function withPollPct(sb: DB, threads: ThreadCard[]) {
  const polls = threads.filter((t) => t.kind === 'poll').map((t) => t.id);
  if (!polls.length) return threads;
  const opts = must(await sb.from('poll_options').select('thread_id,votes').in('thread_id', polls));
  for (const t of threads) {
    if (t.kind !== 'poll') continue;
    const o = opts.filter((x) => x.thread_id === t.id);
    const total = o.reduce((s, x) => s + x.votes, 0);
    t.poll_pct = total ? Math.round((Math.max(...o.map((x) => x.votes)) / total) * 100) : null;
  }
  return threads;
}

export type FeedTab = 'hot' | 'new' | 'top' | 'branch';

/** Hot = votes + replies, decayed by age (HN-style). */
export function hotness(t: { score: number; reply_count: number; created_at: string }) {
  const hours = (Date.now() - Date.parse(t.created_at)) / 3600e3;
  return (t.score + t.reply_count * 0.5) / Math.pow(hours + 2, 1.5);
}

export async function listThreads(sb: DB, opts: {
  tab?: FeedTab; categoryId?: number; boardIds?: string[]; limit?: number; excludeNews?: boolean; branch?: string | null;
}) {
  let q = sb.from('threads').select(THREAD_SELECT);
  if (opts.excludeNews) q = q.neq('kind', 'news');
  if (opts.categoryId) q = q.eq('board.category_id', opts.categoryId);
  if (opts.boardIds) q = q.in('board_id', opts.boardIds);
  const tab = opts.tab ?? 'hot';
  if (tab === 'new') q = q.order('created_at', { ascending: false });
  else if (tab === 'top') q = q.gte('created_at', new Date(Date.now() - 7 * 864e5).toISOString()).order('score', { ascending: false });
  else if (tab === 'branch' && opts.branch) {
    q = q.or(`tags.cs.{${opts.branch}},title.ilike.%${opts.branch}%`).order('score', { ascending: false });
  } else q = q.order('score', { ascending: false }).order('created_at', { ascending: false });
  const limit = opts.limit ?? 20;
  let rows = must(await q.limit(tab === 'hot' ? Math.max(limit, 40) : limit)) as unknown as ThreadCard[];
  if (tab === 'hot') rows = rows.sort((a, b) => hotness(b) - hotness(a)).slice(0, limit);
  return withPollPct(sb, rows);
}

// ── Today ─────────────────────────────────────────────────────────────────
export interface TimelineItem {
  id: number; starts_at: string; ends_at: string | null; title: string; short_title: string | null;
  sub: string | null; thread_id: number | null; society_post_id: number | null;
  state: 'past' | 'now' | 'next';
}

export async function getTimeline(sb: DB): Promise<TimelineItem[]> {
  const today = istDate();
  const start = new Date(`${today}T00:00:00+05:30`);
  const end = new Date(start.getTime() + 27 * 3600e3);   // through 3 am, so "12 am" belongs to today
  let rows = must(await sb.from('campus_events').select('*')
    .gte('starts_at', start.toISOString()).lt('starts_at', end.toISOString()).order('starts_at'));
  if (!rows.length) {
    rows = must(await sb.from('campus_events').select('*').order('starts_at', { ascending: false }).limit(5)).reverse();
  }
  const now = Date.now();
  return rows.map((r) => {
    const s = Date.parse(r.starts_at), e = r.ends_at ? Date.parse(r.ends_at) : s + 30 * 60e3;
    return { ...r, state: now >= s && now < e ? 'now' : now >= e ? 'past' : 'next' } as TimelineItem;
  });
}

export async function getToday(sb: DB, tab: FeedTab = 'hot', branch: string | null = null) {
  const [lead, timeline, feed, guide, desks, teams, openTeams, picks, posts, boardCount, societyCount] = await Promise.all([
    sb.from('threads').select(THREAD_SELECT).eq('kind', 'news').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    getTimeline(sb),
    listThreads(sb, { tab, excludeNews: true, limit: 1, branch }),
    sb.from('wiki_articles').select('id,slug,title,editor_count,checked_at,cover_label,cover_path').eq('status', 'published').order('views_week', { ascending: false }).limit(1).maybeSingle(),
    getDesks(sb),
    sb.from('teams').select('id,title,short_title,deadline_on,deadline_label,urgent,team_roles(name,filled,sort)').order('deadline_on', { nullsFirst: false }).limit(2),
    sb.from('teams').select('id', { count: 'exact', head: true }),
    sb.from('places').select('*').not('home_sort', 'is', null).order('home_sort').limit(3),
    getSocietyStrip(sb),
    sb.from('boards').select('id', { count: 'exact', head: true }).is('parent_id', null),
    sb.from('societies').select('id', { count: 'exact', head: true }),
  ]);
  return {
    lead: must(lead) as unknown as ThreadCard | null,
    timeline,
    featured: feed[0] ?? null,
    guide: must(guide),
    desks,
    teams: must(teams),
    openTeamCount: openTeams.count ?? 0,
    picks: must(picks),
    posts,
    boardCount: boardCount.count ?? 0,
    societyCount: societyCount.count ?? 0,
  };
}

/** Four board "desks": Campus, Padhai, Career, Bahar — top two threads each. */
export async function getDesks(sb: DB) {
  const cats = must(await sb.from('board_categories').select('*').in('id', [1, 2, 3, 5]).order('id'));
  const lists = await Promise.all(cats.map((c) => listThreads(sb, { categoryId: c.id, excludeNews: true, limit: 2 })));
  return cats.map((c, i) => ({ category: c, threads: lists[i] }));
}

async function getSocietyStrip(sb: DB) {
  const rows = must(await sb.from('society_posts').select(`*,society:societies(${SOCIETY})`).order('created_at', { ascending: false }).limit(30));
  const out: typeof rows = [];
  for (const k of ['event', 'recruiting', 'workshop', 'talk']) {
    const r = rows.find((x) => x.kind === k);
    if (r) out.push(r);
  }
  return out as unknown as SocietyPost[];
}

// ── Boards ────────────────────────────────────────────────────────────────
export interface BoardWithLatest extends BoardRow {
  children: BoardRow[];
  latest: ThreadCard | null;
  newCount: number;
}

export async function getBoardsIndex(sb: DB) {
  const [cats, boards, recent, members, newest, newCounts] = await Promise.all([
    sb.from('board_categories').select('*').order('id'),
    sb.from('boards').select('*').order('sort'),
    sb.from('threads').select(THREAD_SELECT).order('created_at', { ascending: false }).limit(200),
    sb.from('profiles').select('id', { count: 'exact', head: true }),
    sb.from('profiles').select('handle,branch_code,grad_year').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    sb.rpc('board_new_counts'),
  ]);
  const all = must(boards);
  const threads = must(recent) as unknown as ThreadCard[];
  const nc = new Map((must(newCounts) ?? []).map((r) => [r.board_id, Number(r.n)]));
  const byId = new Map(all.map((b) => [b.id, b]));
  const rootOf = (id: string): string => {
    let b = byId.get(id);
    while (b?.parent_id) b = byId.get(b.parent_id);
    return b?.id ?? id;
  };
  const tops = all.filter((b) => !b.parent_id);
  const result: BoardWithLatest[] = tops.map((b) => {
    const descendants = all.filter((x) => x.id !== b.id && rootOf(x.id) === b.id).map((x) => x.id);
    const ids = new Set([b.id, ...descendants]);
    return {
      ...b,
      children: all.filter((x) => x.parent_id === b.id),
      latest: threads.find((t) => ids.has(t.board.id)) ?? null,
      newCount: [...ids].reduce((s, id) => s + (nc.get(id) ?? 0), 0),
    };
  });
  const totalPosts = all.filter((b) => !b.parent_id).reduce((s, b) => s + b.post_count, 0);
  return {
    categories: must(cats) as (CategoryRow & { tone: Tone })[],
    boards: result,
    members: members.count ?? 0,
    posts: totalPosts,
    newest: must(newest),
    newTotal: [...nc.values()].reduce((a, b) => a + b, 0),
  };
}

export async function markBoardsSeen(sb: DB, userId: string) {
  await sb.from('profiles').update({ boards_seen_at: new Date().toISOString() }).eq('id', userId);
}

export async function getBoard(sb: DB, slug: string, tab: FeedTab = 'hot') {
  const board = must(await sb.from('boards').select('*').eq('slug', slug).maybeSingle());
  if (!board) return null;
  const all = must(await sb.from('boards').select('*'));
  const desc = (id: string): string[] => all.filter((b) => b.parent_id === id).flatMap((b) => [b.id, ...desc(b.id)]);
  const ids = [board.id, ...desc(board.id)];
  const [threads, category, path] = await Promise.all([
    listThreads(sb, { tab, boardIds: ids, limit: 40 }),
    sb.from('board_categories').select('*').eq('id', board.category_id).single(),
    boardAncestors(sb, board.id, all),
  ]);
  return {
    board, threads, category: must(category) as CategoryRow & { tone: Tone }, path,
    children: all.filter((b) => b.parent_id === board.id).sort((a, b) => a.sort - b.sort),
  };
}

async function boardAncestors(sb: DB, id: string, all?: BoardRow[]) {
  const boards = all ?? must(await sb.from('boards').select('*'));
  const byId = new Map(boards.map((b) => [b.id, b]));
  const out: BoardRow[] = [];
  let b = byId.get(id);
  while (b) { out.unshift(b); b = b.parent_id ? byId.get(b.parent_id) : undefined; }
  return out;
}

export async function setBoardJoined(sb: DB, boardId: string, userId: string, join: boolean) {
  if (join) await sb.from('board_members').insert({ board_id: boardId, user_id: userId });
  else await sb.from('board_members').delete().eq('board_id', boardId).eq('user_id', userId);
}

// ── Thread page ───────────────────────────────────────────────────────────
export async function getThread(sb: DB, id: number, userId: string | null) {
  const thread = must(await sb.from('threads').select(THREAD_SELECT).eq('id', id).maybeSingle()) as unknown as ThreadCard | null;
  if (!thread) return null;
  const [replies, myVote, saved, replyVotes, path, board, joined, poll, myPoll, related, wiki, lounge] = await Promise.all([
    sb.from('replies').select(`id,thread_id,parent_id,body,score,created_at,edited_at,deleted_at,author:profiles!replies_author_id_fkey(${PERSON}),society:societies(${SOCIETY})`).eq('thread_id', id).order('created_at'),
    userId ? sb.from('thread_votes').select('value').eq('thread_id', id).eq('user_id', userId).maybeSingle() : null,
    userId ? sb.from('saves').select('thread_id').eq('thread_id', id).eq('user_id', userId).maybeSingle() : null,
    userId ? sb.from('reply_votes').select('reply_id,value').eq('user_id', userId) : null,
    boardAncestors(sb, thread.board.id),
    sb.from('boards').select('*').eq('id', thread.board.id).single(),
    userId ? sb.from('board_members').select('board_id').eq('board_id', thread.board.id).eq('user_id', userId).maybeSingle() : null,
    thread.kind === 'poll' ? sb.from('poll_options').select('*').eq('thread_id', id).order('sort') : null,
    thread.kind === 'poll' && userId ? sb.from('poll_votes').select('option_id').eq('thread_id', id).eq('user_id', userId).maybeSingle() : null,
    thread.attachment?.subject
      ? sb.from('library_items').select('id,title,kind,format,subject_code').eq('subject_code', thread.attachment.subject).neq('id', thread.attachment.library_item_id ?? -1).order('downloads_week', { ascending: false }).limit(3)
      : null,
    sb.from('wiki_articles').select('slug,title,editor_count,checked_at').eq('status', 'published').order('views_week', { ascending: false }).limit(1).maybeSingle(),
    sb.from('lounge_messages').select('id,room_slug').eq('promoted_thread_id', id).maybeSingle(),
  ]);
  const rv = new Map((replyVotes ? must(replyVotes) : []).map((r) => [r.reply_id, r.value]));
  const flat = (must(replies) as unknown as Omit<ReplyNode, 'children' | 'myVote'>[]).map((r) => ({ ...r, children: [] as ReplyNode[], myVote: rv.get(r.id) ?? 0 }));
  const byId = new Map(flat.map((r) => [r.id, r]));
  const roots: ReplyNode[] = [];
  for (const r of flat) (r.parent_id && byId.get(r.parent_id) ? byId.get(r.parent_id)!.children : roots).push(r);
  return {
    thread,
    replies: roots,
    replyCount: flat.length,
    myVote: myVote?.data?.value ?? 0,
    saved: !!saved?.data,
    path,
    board: must(board),
    joined: !!joined?.data,
    poll: poll ? must(poll) : null,
    myPollOption: myPoll?.data?.option_id ?? null,
    related: related ? must(related) : [],
    wiki: must(wiki),
    fromLounge: lounge?.data ?? null,
  };
}

export function sortReplies(nodes: ReplyNode[], by: 'best' | 'newest' | 'oldest', acceptedId: number | null): ReplyNode[] {
  const cmp = (a: ReplyNode, b: ReplyNode) => {
    if (by === 'best') {
      if (a.id === acceptedId) return -1;
      if (b.id === acceptedId) return 1;
      return b.score - a.score;
    }
    const d = Date.parse(a.created_at) - Date.parse(b.created_at);
    return by === 'oldest' ? d : -d;
  };
  return [...nodes].sort(cmp).map((n) => ({ ...n, children: sortReplies(n.children, 'oldest', null) }));
}

export async function voteThread(sb: DB, id: number, value: -1 | 0 | 1) {
  return must(await sb.rpc('set_thread_vote', { p_thread: id, p_value: value }));
}
export async function voteReply(sb: DB, id: number, value: -1 | 0 | 1) {
  return must(await sb.rpc('set_reply_vote', { p_reply: id, p_value: value }));
}
export async function setSaved(sb: DB, threadId: number, userId: string, save: boolean) {
  if (save) await sb.from('saves').insert({ thread_id: threadId, user_id: userId });
  else await sb.from('saves').delete().eq('thread_id', threadId).eq('user_id', userId);
}
export async function acceptReply(sb: DB, threadId: number, replyId: number | null) {
  must(await sb.rpc('accept_reply', { p_thread: threadId, p_reply: replyId as number }));
}
export async function postReply(sb: DB, input: { threadId: number; userId: string; body: string; parentId?: number | null; societyId?: string | null }) {
  return must(await sb.from('replies').insert({
    thread_id: input.threadId, author_id: input.userId, body: input.body.trim(),
    parent_id: input.parentId ?? null, society_id: input.societyId ?? null,
  }).select('id').single());
}

// ── Editing and deleting your own posts ───────────────────────────────────
export async function editThread(sb: DB, id: number, patch: { title: string; body: string }) {
  must(await sb.from('threads').update({ title: patch.title.trim(), body: patch.body.trim() }).eq('id', id).select('id').single());
}
export async function deleteThread(sb: DB, id: number) {
  must(await sb.from('threads').delete().eq('id', id));
}
export async function editReply(sb: DB, id: number, body: string) {
  must(await sb.from('replies').update({ body: body.trim() }).eq('id', id).select('id').single());
}
/** Removes the reply, or blanks it to "[deleted]" when others replied under it. */
export async function deleteReply(sb: DB, id: number) {
  must(await sb.rpc('delete_reply', { p_reply: id }));
}

// ── Reports ───────────────────────────────────────────────────────────────
export type ReportReason = 'spam' | 'harassment' | 'misinformation' | 'inappropriate' | 'other';
export const REPORT_REASONS: [ReportReason, string][] = [
  ['spam', 'Spam or ads'], ['harassment', 'Harassment or hate'], ['misinformation', 'False or misleading'],
  ['inappropriate', 'Inappropriate content'], ['other', 'Something else'],
];
export type ReportTarget = { threadId: number } | { replyId: number } | { loungeMessageId: number };

/** Returns false when you had already reported this. */
export async function reportContent(sb: DB, i: { userId: string; target: ReportTarget; reason: ReportReason; details?: string }) {
  const t = i.target;
  const { error } = await sb.from('reports').insert({
    reporter_id: i.userId, reason: i.reason, details: i.details?.trim() || null,
    thread_id: 'threadId' in t ? t.threadId : null,
    reply_id: 'replyId' in t ? t.replyId : null,
    lounge_message_id: 'loungeMessageId' in t ? t.loungeMessageId : null,
  });
  if (error?.code === '23505') return false;
  if (error) throw new Error(error.message);
  return true;
}

export interface OpenReport {
  key: string; count: number; reasons: string[]; details: string[]; first_at: string; ids: number[];
  kind: 'thread' | 'reply' | 'lounge'; title: string; body: string; route: string; author: PersonLite | null;
}
export async function getOpenReports(sb: DB): Promise<OpenReport[]> {
  const rows = must(await sb.from('reports').select(
    `id,reason,details,created_at,thread_id,reply_id,lounge_message_id,` +
    `thread:threads(id,title,body,author:profiles!threads_author_id_fkey(${PERSON})),` +
    `reply:replies(id,body,thread_id,author:profiles!replies_author_id_fkey(${PERSON})),` +
    `message:lounge_messages(id,body,room_slug,author:profiles!lounge_messages_author_id_fkey(${PERSON}))`,
  ).eq('status', 'open').order('created_at')) as unknown as {
    id: number; reason: string; details: string | null; created_at: string;
    thread_id: number | null; reply_id: number | null; lounge_message_id: number | null;
    thread: { id: number; title: string; body: string; author: PersonLite } | null;
    reply: { id: number; body: string; thread_id: number; author: PersonLite } | null;
    message: { id: number; body: string; room_slug: string; author: PersonLite } | null;
  }[];
  const groups = new Map<string, OpenReport>();
  for (const r of rows) {
    const key = r.thread_id ? `t${r.thread_id}` : r.reply_id ? `r${r.reply_id}` : `m${r.lounge_message_id}`;
    let g = groups.get(key);
    if (!g) {
      g = r.thread
        ? { kind: 'thread', title: r.thread.title, body: r.thread.body, route: `/t/${r.thread.id}`, author: r.thread.author } as OpenReport
        : r.reply
          ? { kind: 'reply', title: 'Reply', body: r.reply.body, route: `/t/${r.reply.thread_id}`, author: r.reply.author } as OpenReport
          : { kind: 'lounge', title: `Lounge · #${r.message?.room_slug ?? ''}`, body: r.message?.body ?? '', route: '/lounge', author: r.message?.author ?? null } as OpenReport;
      Object.assign(g, { key, count: 0, reasons: [], details: [], first_at: r.created_at, ids: [] });
      groups.set(key, g);
    }
    g.count++; g.ids.push(r.id);
    if (!g.reasons.includes(r.reason)) g.reasons.push(r.reason);
    if (r.details) g.details.push(r.details);
  }
  return [...groups.values()];
}
/** Dismiss the reports, or remove the reported content. */
export async function resolveReport(sb: DB, reportId: number, remove: boolean) {
  must(await sb.rpc('resolve_report', { p_report: reportId, p_remove: remove }));
}
export async function votePoll(sb: DB, threadId: number, optionId: number, userId: string) {
  await sb.from('poll_votes').delete().eq('thread_id', threadId).eq('user_id', userId);
  must(await sb.from('poll_votes').insert({ thread_id: threadId, option_id: optionId, user_id: userId }));
}

// ── Composer ──────────────────────────────────────────────────────────────
export type PostType = 'thread' | 'question' | 'article' | 'team' | 'poll' | 'event';

export async function similarThreads(sb: DB, title: string, limit = 3) {
  const words = titleWords(title);
  if (!words.length) return [];
  const ors = words.slice(0, 6).map((w) => `title.ilike.%${w.replace(/[%,()]/g, '')}%`).join(',');
  const [t, a] = await Promise.all([
    sb.from('threads').select('id,title,score,reply_count,board:boards(name,short_name)').or(ors).limit(20),
    sb.from('wiki_articles').select('slug,title,editor_count').eq('status', 'published').or(ors).limit(10),
  ]);
  type Sim = { title: string; sub: string; route: string; n: number };
  const out: Sim[] = [
    ...(must(t) as unknown as { id: number; title: string; score: number; reply_count: number; board: { name: string; short_name: string | null } }[])
      .map((x) => ({ title: x.title, sub: `${x.board.short_name ?? x.board.name} · ${x.score} votes · ${x.reply_count} replies`, route: `/t/${x.id}`, n: overlap(words, x.title) })),
    ...must(a).map((x) => ({ title: x.title, sub: `Wiki · ${x.editor_count} editors`, route: `/wiki/${x.slug}`, n: overlap(words, x.title) })),
  ];
  return out.filter((x) => x.n).sort((x, y) => y.n - x.n).slice(0, limit);
}

export interface NewThreadInput {
  userId: string; boardId: string; kind: 'thread' | 'question' | 'poll'; title: string; body: string;
  tags: string[]; pollOptions?: string[]; pollDays?: number; societyId?: string | null; notifyOnReply?: boolean;
}
export async function createThread(sb: DB, i: NewThreadInput) {
  const row = must(await sb.from('threads').insert({
    board_id: i.boardId, author_id: i.userId, kind: i.kind, title: i.title.trim(), body: i.body,
    tags: i.tags, society_id: i.societyId ?? null, notify_on_reply: i.notifyOnReply ?? true,
    poll_closes_at: i.kind === 'poll' ? new Date(Date.now() + (i.pollDays ?? 3) * 864e5).toISOString() : null,
  }).select('id').single());
  if (i.kind === 'poll' && i.pollOptions?.length) {
    must(await sb.from('poll_options').insert(i.pollOptions.filter(Boolean).map((label, k) => ({ thread_id: row.id, label, sort: k }))));
  }
  return row.id;
}

export async function isModerator(sb: DB) {
  return !!must(await sb.rpc('is_moderator'));
}

/** New guides go to the moderation queue (moderators publish directly). Returns the slug. */
export async function createWikiArticle(sb: DB, i: { userId: string; title: string; body: string; dek?: string; categoryId?: number | null; boardId?: string | null; coverPath?: string | null }) {
  const mod = await isModerator(sb);
  const base = i.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  const words = i.body.split(/\s+/).filter(Boolean).length;
  const row = must(await sb.from('wiki_articles').insert({
    slug, title: i.title.trim(), body: i.body, dek: i.dek ?? null, cover_path: i.coverPath ?? null, category_id: i.categoryId ?? null,
    board_id: i.boardId ?? null, started_by: i.userId, read_minutes: Math.max(1, Math.round(words / 220)),
    status: mod ? 'published' : 'pending',
  }).select('id,slug').single());
  must(await sb.from('wiki_revisions').insert({ article_id: row.id, editor_id: i.userId, summary: 'started the article', delta_words: words, body: i.body, status: mod ? 'published' : 'suggested' }));
  return row.slug;
}

export async function createTeam(sb: DB, i: { userId: string; category: string; eventName: string; title: string; description: string; deadlineOn: string | null; roles: { name: string; filled: boolean }[] }) {
  const row = must(await sb.from('teams').insert({
    owner_id: i.userId, category: i.category, event_name: i.eventName, title: i.title, description: i.description,
    deadline_on: i.deadlineOn,
  }).select('id').single());
  if (i.roles.length) must(await sb.from('team_roles').insert(i.roles.map((r, k) => ({ team_id: row.id, name: r.name, filled: r.filled, filled_by: r.filled ? i.userId : null, sort: k }))));
  await sb.from('team_members').insert({ team_id: row.id, user_id: i.userId });
  return row.id;
}

export async function createSocietyPost(sb: DB, i: { userId: string; societyId: string; kind: string; title: string; body: string; whenLabel: string; whereLabel: string; startsAt?: string | null; applyUrl?: string | null; posterPath?: string | null }) {
  const applyUrl = i.applyUrl?.trim() || null;
  if (applyUrl && !/^https?:\/\//i.test(applyUrl)) throw new Error('Application link must start with https:// or http://.');
  return must(await sb.from('society_posts').insert({
    society_id: i.societyId, author_id: i.userId, kind: i.kind, title: i.title, body: i.body,
    when_label: i.whenLabel, short_when: i.whenLabel, where_label: i.whereLabel || null, starts_at: i.startsAt ?? null, apply_url: applyUrl, poster_path: i.posterPath ?? null,
  }).select('id').single()).id;
}

export async function myPostingSocieties(sb: DB, userId: string) {
  const rows = must(await sb.from('society_members').select(`society:societies(${SOCIETY})`).eq('user_id', userId).eq('can_post', true));
  return (rows as unknown as { society: SocietyLite }[]).map((r) => r.society);
}

export async function saveDraft(sb: DB, d: { id?: string; userId: string; kind: string; boardId: string | null; title: string; body: string; payload?: Record<string, unknown> }) {
  const row = { user_id: d.userId, kind: d.kind, board_id: d.boardId, title: d.title, body: d.body, payload: (d.payload ?? {}) as never, updated_at: new Date().toISOString() };
  if (d.id) return must(await sb.from('drafts').update(row).eq('id', d.id).select('id').single()).id;
  return must(await sb.from('drafts').insert(row).select('id').single()).id;
}

export async function boardPicker(sb: DB) {
  const [boards, cats] = await Promise.all([
    sb.from('boards').select('*').is('link_screen', null).order('sort'),
    sb.from('board_categories').select('*').order('id'),
  ]);
  const all = must(boards);
  const byId = new Map(all.map((b) => [b.id, b]));
  const path = (b: BoardRow) => {
    const names: string[] = [];
    let cur: BoardRow | undefined = b;
    while (cur) { names.unshift(cur.short_name ?? cur.name); cur = cur.parent_id ? byId.get(cur.parent_id) : undefined; }
    return names;
  };
  const categories = must(cats);
  return all.map((b) => {
    const c = categories.find((x) => x.id === b.category_id)!;
    return { id: b.id, slug: b.slug, verified_only: b.verified_only, rules: b.rules, tone: c.tone as Tone, path: [c.name, ...path(b)] };
  });
}

// ── Wiki ──────────────────────────────────────────────────────────────────
export async function getWikiIndex(sb: DB) {
  const [cats, arts, editors] = await Promise.all([
    sb.from('wiki_categories').select('*').order('id'),
    sb.from('wiki_articles').select('id,slug,title,category_id,editor_count,read_minutes,checked_at,cover_label,cover_path,views_week').eq('status', 'published').order('views_week', { ascending: false }),
    sb.from('wiki_revisions').select('editor_id'),
  ]);
  const articles = must(arts);
  return {
    categories: must(cats) as (Tables['wiki_categories']['Row'] & { tone: Tone })[],
    articles,
    mostRead: articles[0] ?? null,
    articleCount: articles.length,
    editorCount: Math.max(new Set(must(editors).map((e) => e.editor_id)).size, articles.reduce((s, a) => s + a.editor_count, 0)),
  };
}

export async function getArticle(sb: DB, slug: string, userId: string | null) {
  const a = must(await sb.from('wiki_articles').select(`*,starter:profiles!wiki_articles_started_by_fkey(${PERSON}),checker:profiles!wiki_articles_checked_by_fkey(${PERSON}),board:boards(slug,name)`).eq('slug', slug).maybeSingle());
  if (!a) return null;
  const [revs, more, talk, fb] = await Promise.all([
    sb.from('wiki_revisions').select(`id,summary,delta_words,created_at,editor:profiles!wiki_revisions_editor_id_fkey(${PERSON})`).eq('article_id', a.id).eq('status', 'published').order('created_at', { ascending: false }).limit(20),
    sb.from('wiki_articles').select('slug,title').eq('status', 'published').neq('id', a.id).order('views_week', { ascending: false }).limit(4),
    sb.from('wiki_talk').select(`id,body,created_at,author:profiles!wiki_talk_author_id_fkey(${PERSON})`).eq('article_id', a.id).order('created_at', { ascending: false }).limit(20),
    userId ? sb.from('wiki_feedback').select('useful').eq('article_id', a.id).eq('user_id', userId).maybeSingle() : null,
  ]);
  type Rev = { id: number; summary: string; delta_words: number | null; created_at: string; editor: PersonLite };
  const revisions = must(revs) as unknown as Rev[];
  const editors: PersonLite[] = [];
  for (const r of [...revisions].reverse()) if (!editors.some((e) => e.id === r.editor.id)) editors.push(r.editor);
  const starter = (a as unknown as { starter: PersonLite | null }).starter;
  if (starter && !editors.some((e) => e.id === starter.id)) editors.unshift(starter);
  return {
    article: a as typeof a & { starter: PersonLite | null; checker: PersonLite | null; board: { slug: string; name: string } | null },
    revisions,
    editors,
    more: must(more),
    talk: must(talk) as unknown as { id: number; body: string; created_at: string; author: PersonLite }[],
    myFeedback: fb?.data?.useful ?? null,
  };
}

export async function setWikiFeedback(sb: DB, articleId: number, userId: string, useful: boolean | null) {
  if (useful === null) await sb.from('wiki_feedback').delete().eq('article_id', articleId).eq('user_id', userId);
  else await sb.from('wiki_feedback').upsert({ article_id: articleId, user_id: userId, useful });
}

/** Edits wait for a moderator unless you are one. Returns true if it went live immediately. */
export async function suggestWikiEdit(sb: DB, i: { articleId: number; userId: string; summary: string; body: string; oldBody: string }) {
  const mod = await isModerator(sb);
  const delta = i.body.split(/\s+/).filter(Boolean).length - i.oldBody.split(/\s+/).filter(Boolean).length;
  must(await sb.from('wiki_revisions').insert({ article_id: i.articleId, editor_id: i.userId, summary: i.summary, body: i.body, delta_words: delta, status: mod ? 'published' : 'suggested' }));
  return mod;
}

// ── Moderation ────────────────────────────────────────────────────────────
export interface PendingRevision {
  id: number; summary: string; delta_words: number | null; body: string | null; created_at: string;
  editor: PersonLite; article: { id: number; slug: string; title: string; body: string; status: string };
}
export interface PendingArticle {
  id: number; slug: string; title: string; dek: string | null; body: string; created_at: string; starter: PersonLite | null;
}

export async function getModQueue(sb: DB) {
  const [revs, arts] = await Promise.all([
    sb.from('wiki_revisions').select(`id,summary,delta_words,body,created_at,editor:profiles!wiki_revisions_editor_id_fkey(${PERSON}),article:wiki_articles!inner(id,slug,title,body,status)`)
      .eq('status', 'suggested').eq('article.status', 'published').order('created_at'),
    sb.from('wiki_articles').select(`id,slug,title,dek,body,created_at,starter:profiles!wiki_articles_started_by_fkey(${PERSON})`).eq('status', 'pending').order('created_at'),
  ]);
  return { revisions: must(revs) as unknown as PendingRevision[], articles: must(arts) as unknown as PendingArticle[] };
}
export async function reviewRevision(sb: DB, id: number, approve: boolean, note?: string) {
  must(await sb.rpc('review_wiki_revision', { p_revision: id, p_approve: approve, p_note: note }));
}
export async function reviewArticle(sb: DB, id: number, approve: boolean, note?: string) {
  must(await sb.rpc('review_wiki_article', { p_article: id, p_approve: approve, p_note: note }));
}
export async function myPendingEdits(sb: DB, articleId: number, userId: string) {
  return must(await sb.from('wiki_revisions').select('id,summary,created_at,status').eq('article_id', articleId).eq('editor_id', userId).eq('status', 'suggested'));
}

// ── Notifications ─────────────────────────────────────────────────────────
export interface NotificationRow {
  id: number; kind: string; count: number; text: string; snippet: string | null; route: string; read_at: string | null; created_at: string;
  actor: PersonLite | null;
}
export async function getNotifications(sb: DB, limit = 40) {
  const rows = must(await sb.from('notifications').select(`id,kind,count,text,snippet,route,read_at,created_at,actor:profiles!notifications_actor_id_fkey(${PERSON})`).order('created_at', { ascending: false }).limit(limit));
  return rows as unknown as NotificationRow[];
}
export async function unreadNotificationCount(sb: DB) {
  const { count } = await sb.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
  return count ?? 0;
}
export async function markNotificationsRead(sb: DB) {
  must(await sb.rpc('mark_notifications_read'));
}
export const NOTIFICATION_ICON: Record<string, string> = {
  mention: 'at', reply: 'chat-circle', comment: 'chats', upvote: 'arrow-fat-up', accepted: 'check-circle', team_request: 'users-three', wiki_review: 'shield-check',
};

// ── Images ────────────────────────────────────────────────────────────────
/** Upload an image to the public media bucket; returns its URL for ![](…) markdown. */
export async function uploadImage(sb: DB, userId: string, file: Blob | ArrayBuffer, fileName: string, contentType: string) {
  if (!contentType.startsWith('image/')) throw new Error('Choose an image file.');
  if ((file instanceof ArrayBuffer ? file.byteLength : file.size) > 10 * 1048576) throw new Error('Images can be up to 10 MB.');
  const ext = (fileName.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const up = await sb.storage.from('media').upload(path, file, { contentType, upsert: false });
  if (up.error) throw new Error(up.error.message);
  return sb.storage.from('media').getPublicUrl(path).data.publicUrl;
}

export async function postWikiTalk(sb: DB, articleId: number, userId: string, body: string) {
  must(await sb.from('wiki_talk').insert({ article_id: articleId, author_id: userId, body }));
}

// ── Library ───────────────────────────────────────────────────────────────
export async function getLibrary(sb: DB, branch: string, semester: number) {
  const [branches, subjects, top] = await Promise.all([
    sb.from('branches').select('*').order('sort'),
    sb.from('subjects').select('*').eq('branch_code', branch).eq('semester', semester).order('sort'),
    sb.from('library_items').select(`id,title,kind,subject_code,downloads_week,downloads,uploader:profiles!library_items_uploader_id_fkey(handle),subject:subjects!inner(branch_code,semester)`)
      .eq('subject.branch_code', branch).eq('subject.semester', semester).order('downloads_week', { ascending: false }).limit(3),
  ]);
  const subs = must(subjects);
  return {
    branches: must(branches),
    subjects: subs,
    top: must(top) as unknown as { id: number; title: string; kind: string; subject_code: string; downloads_week: number; downloads: number; uploader: { handle: string } | null }[],
    totals: subs.reduce((t, s) => ({ notes: t.notes + s.notes_count, pyqs: t.pyqs + s.pyq_count, labs: t.labs + s.lab_count }), { notes: 0, pyqs: 0, labs: 0 }),
  };
}

export async function getSubject(sb: DB, code: string) {
  const subject = must(await sb.from('subjects').select('*').eq('code', code).maybeSingle());
  if (!subject) return null;
  const [items, threads, branch] = await Promise.all([
    sb.from('library_items').select(`*,uploader:profiles!library_items_uploader_id_fkey(handle)`).eq('subject_code', code).order('downloads', { ascending: false }),
    sb.from('threads').select(THREAD_SELECT).or(`attachment->>subject.eq.${code},tags.cs.{${code}}`).order('score', { ascending: false }).limit(10),
    sb.from('branches').select('*').eq('code', subject.branch_code).single(),
  ]);
  return {
    subject,
    branch: must(branch),
    items: must(items) as unknown as (LibraryItemRow & { uploader: { handle: string } | null })[],
    threads: must(threads) as unknown as ThreadCard[],
  };
}

export async function searchSubjects(sb: DB, q: string) {
  const s = q.replace(/[%,()]/g, '');
  return must(await sb.from('subjects').select('*').or(`code.ilike.%${s}%,name.ilike.%${s}%`).order('semester').limit(20));
}

/** Count a download and return a short-lived signed URL (null for demo rows without a file). */
export async function downloadItem(sb: DB, itemId: number): Promise<string | null> {
  const path = must(await sb.rpc('record_download', { p_item: itemId }));
  if (!path) return null;
  const { data } = await sb.storage.from('library').createSignedUrl(path, 600, { download: true });
  return data?.signedUrl ?? null;
}

export async function uploadLibraryItem(sb: DB, i: {
  userId: string; subjectCode: string; kind: 'notes' | 'pyq' | 'lab' | 'slides'; title: string;
  file: Blob | ArrayBuffer; fileName: string; contentType: string; size: number;
}) {
  const ext = (i.fileName.split('.').pop() ?? 'bin').toLowerCase();
  const path = `${i.userId}/${i.subjectCode}/${Date.now()}-${i.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const up = await sb.storage.from('library').upload(path, i.file, { contentType: i.contentType, upsert: false });
  if (up.error) throw new Error(up.error.message);
  const format = ({ pdf: 'PDF', ppt: 'PPT', pptx: 'PPT', zip: 'ZIP', doc: 'DOC', docx: 'DOC', png: 'Image', jpg: 'Image', jpeg: 'Image' } as Record<string, string>)[ext] ?? ext.toUpperCase();
  return must(await sb.from('library_items').insert({
    subject_code: i.subjectCode, kind: i.kind, title: i.title, format, size_bytes: i.size, storage_path: path, uploader_id: i.userId,
  }).select('id').single()).id;
}

// ── Societies ─────────────────────────────────────────────────────────────
export interface SocietyPost {
  id: number; kind: string; title: string; body: string | null; when_label: string; short_when: string | null;
  where_label: string | null; starts_at: string | null; rsvp_count: number; rsvp_word: string; apply_url: string | null;
  meta_note: string | null; featured: boolean; poster_label: string | null; poster_path: string | null;
  created_at: string; society: SocietyLite;
}

export async function getSocietyBoard(sb: DB, userId: string | null, kind?: string | null) {
  let q = sb.from('society_posts').select(`*,society:societies(${SOCIETY})`).order('featured', { ascending: false }).order('created_at', { ascending: false });
  if (kind) q = q.eq('kind', kind);
  const [posts, mine, count] = await Promise.all([
    q.limit(60),
    userId ? sb.from('rsvps').select('post_id').eq('user_id', userId) : null,
    sb.from('societies').select('id', { count: 'exact', head: true }).eq('verified', true),
  ]);
  return {
    posts: must(posts) as unknown as SocietyPost[],
    myRsvps: new Set((mine ? must(mine) : []).map((r) => r.post_id)),
    verifiedCount: count.count ?? 0,
  };
}

export async function toggleRsvp(sb: DB, postId: number) {
  return must(await sb.rpc('toggle_rsvp', { p_post: postId }));
}

// ── Team Up ───────────────────────────────────────────────────────────────
export interface TeamCard {
  id: number; category: string; event_name: string; event_short: string | null; event_tone: 'accent' | 'accent2' | 'neutral';
  title: string; short_title: string | null; description: string | null; deadline_label: string | null; deadline_on: string | null;
  urgent: boolean; extra_members: number; owner_id: string;
  team_roles: { id: number; name: string; filled: boolean; sort: number }[];
  team_members: { user: PersonLite }[];
}
export interface TeamRequest { team_id: number; created_at: string; user: PersonLite & { skills: string[] } }

export async function getTeams(sb: DB, userId: string | null) {
  const [teams, mine, deadlines, looking, incoming] = await Promise.all([
    sb.from('teams').select(`*,team_roles(id,name,filled,sort),team_members(user:profiles(${PERSON}))`).order('created_at', { ascending: false }),
    userId ? sb.from('team_requests').select('team_id,status').eq('user_id', userId) : null,
    sb.from('deadlines').select('*').gte('on_date', istDate()).order('on_date').limit(5),
    sb.from('profiles').select(`${PERSON},skills,semester`).eq('open_to_teams', true).neq('id', userId ?? '00000000-0000-0000-0000-000000000000').order('created_at', { ascending: false }).limit(6),
    userId
      ? sb.from('team_requests').select(`team_id,created_at,user:profiles!team_requests_user_id_fkey(${PERSON},skills),team:teams!inner(owner_id)`)
        .eq('team.owner_id', userId).eq('status', 'pending').order('created_at')
      : null,
  ]);
  const requests = new Map<number, TeamRequest[]>();
  for (const r of (incoming ? must(incoming) : []) as unknown as TeamRequest[]) {
    requests.set(r.team_id, [...(requests.get(r.team_id) ?? []), { team_id: r.team_id, created_at: r.created_at, user: r.user }]);
  }
  const myRows = mine ? must(mine) : [];
  const list = (must(teams) as unknown as TeamCard[]).map((t) => ({ ...t, team_roles: [...t.team_roles].sort((a, b) => a.sort - b.sort) }));
  const counts = list.reduce<Record<string, number>>((c, t) => ({ ...c, [t.category]: (c[t.category] ?? 0) + 1 }), {});
  return {
    teams: list,
    counts,
    /** Teams you have a pending request with. */
    myRequests: new Set(myRows.filter((r) => r.status === 'pending').map((r) => r.team_id)),
    /** Every request you've sent, by team: pending, accepted or declined. */
    myRequestStatus: new Map(myRows.map((r) => [r.team_id, r.status as 'pending' | 'accepted' | 'declined'])),
    /** Pending requests to teams you own. */
    requests,
    deadlines: must(deadlines),
    looking: must(looking) as unknown as (PersonLite & { skills: string[] })[],
  };
}

export function matchesSkills(team: TeamCard, skills: string[]) {
  const s = skills.map((x) => x.toLowerCase());
  return team.team_roles.some((r) => !r.filled && s.some((k) => r.name.toLowerCase().includes(k) || k.includes(r.name.toLowerCase())));
}

export async function toggleTeamRequest(sb: DB, teamId: number) {
  return must(await sb.rpc('toggle_team_request', { p_team: teamId }));
}
/** Team owners accept (optionally filling an open role) or decline a request. */
export async function reviewTeamRequest(sb: DB, i: { teamId: number; userId: string; accept: boolean; roleId?: number | null }) {
  must(await sb.rpc('review_team_request', { p_team: i.teamId, p_user: i.userId, p_accept: i.accept, p_role: i.roleId ?? undefined }));
}

// ── Kahan chalein? ────────────────────────────────────────────────────────
export async function getPlaces(sb: DB, userId: string | null) {
  const [places, mine] = await Promise.all([
    sb.from('places').select('*').order('sort'),
    userId ? sb.from('place_hearts').select('place_id').eq('user_id', userId) : null,
  ]);
  const all = must(places);
  const today = istDate();
  return {
    canteen: all.filter((p) => p.category === 'canteen').sort((a, b) => b.hearts - a.hearts),
    nearby: all.filter((p) => p.category === 'nearby'),
    delhi: all.filter((p) => p.category === 'delhi' && (!p.event_on || p.event_on >= today)).sort((a, b) => (a.event_on ?? '').localeCompare(b.event_on ?? '')),
    chill: all.filter((p) => p.category === 'chill'),
    myHearts: new Set((mine ? must(mine) : []).map((r) => r.place_id)),
  };
}

export async function toggleHeart(sb: DB, placeId: number) {
  return must(await sb.rpc('toggle_heart', { p_place: placeId }));
}

export async function recommendPlace(sb: DB, i: { userId: string; category: string; name: string; whereLabel: string; priceLabel: string; distanceKm?: number | null; imagePath?: string | null }) {
  must(await sb.from('places').insert({ author_id: i.userId, category: i.category, name: i.name, where_label: i.whereLabel, price_label: i.priceLabel, distance_km: i.distanceKm ?? null, image_path: i.imagePath ?? null, sort: 50 }));
}

// ── Profile ───────────────────────────────────────────────────────────────
export async function getProfile(sb: DB, handle: string) {
  const p = must(await sb.from('profiles').select('*').eq('handle', handle).maybeSingle());
  if (!p) return null;
  const [breakdown, week, acts, socs, badges, threads, replies, uploads] = await Promise.all([
    sb.rpc('karma_breakdown', { p_user: p.id }),
    sb.rpc('karma_this_week', { p_user: p.id }),
    sb.from('activities').select('*').eq('user_id', p.id).order('created_at', { ascending: false }).limit(30),
    sb.from('society_members').select(`role,society:societies(${SOCIETY})`).eq('user_id', p.id),
    sb.from('badges').select('*').eq('user_id', p.id).order('created_at'),
    sb.from('threads').select(THREAD_SELECT).eq('author_id', p.id).order('created_at', { ascending: false }).limit(30),
    sb.from('replies').select('id,body,score,created_at,thread:threads!replies_thread_id_fkey(id,title)').eq('author_id', p.id).order('created_at', { ascending: false }).limit(30),
    sb.from('library_items').select('id,title,kind,subject_code,downloads,created_at').eq('uploader_id', p.id).order('created_at', { ascending: false }).limit(30),
  ]);
  return {
    profile: p,
    karmaBreakdown: (must(breakdown) ?? []).map((r) => ({ bucket: r.bucket, amount: Number(r.amount) })),
    karmaWeek: Number(must(week) ?? 0),
    activities: must(acts),
    societies: must(socs) as unknown as { role: string; society: SocietyLite }[],
    badges: must(badges),
    threads: must(threads) as unknown as ThreadCard[],
    replies: must(replies) as unknown as { id: number; body: string; score: number; created_at: string; thread: { id: number; title: string } }[],
    uploads: must(uploads),
  };
}

export async function getSaved(sb: DB, userId: string) {
  const rows = must(await sb.from('saves').select(`thread:threads(${THREAD_SELECT})`).eq('user_id', userId).order('created_at', { ascending: false }).limit(50));
  return (rows as unknown as { thread: ThreadCard }[]).map((r) => r.thread).filter(Boolean);
}
export async function getDrafts(sb: DB) {
  return must(await sb.from('drafts').select('*').order('updated_at', { ascending: false }));
}

// ── Lounge ────────────────────────────────────────────────────────────────
export interface LoungeMessage {
  id: number; room_slug: string; body: string; created_at: string; promoted_thread_id: number | null;
  edited_at?: string | null; author: PersonLite; society: SocietyLite | null;
  promoted?: { id: number; reply_count: number; board: { name: string } } | null;
  pending?: boolean;
}
export const LOUNGE_SELECT = `id,room_slug,body,created_at,edited_at,promoted_thread_id,author:profiles!lounge_messages_author_id_fkey(${PERSON}),society:societies(${SOCIETY}),promoted:threads!lounge_messages_promoted_thread_id_fkey(id,reply_count,board:boards(name))`;

export async function getLoungeRooms(sb: DB) {
  return must(await sb.from('lounge_rooms').select('*').order('sort'));
}
export async function getLoungeMessages(sb: DB, room: string, limit = 60) {
  const rows = must(await sb.from('lounge_messages').select(LOUNGE_SELECT).eq('room_slug', room).order('created_at', { ascending: false }).limit(limit));
  return (rows as unknown as LoungeMessage[]).reverse();
}
export async function getLoungeMessage(sb: DB, id: number) {
  return must(await sb.from('lounge_messages').select(LOUNGE_SELECT).eq('id', id).single()) as unknown as LoungeMessage;
}
export async function sendLoungeMessage(sb: DB, room: string, userId: string, body: string) {
  return must(await sb.from('lounge_messages').insert({ room_slug: room, author_id: userId, body: body.trim() }).select('id').single()).id;
}
export async function editLoungeMessage(sb: DB, id: number, body: string) {
  must(await sb.from('lounge_messages').update({ body: body.trim() }).eq('id', id).select('id').single());
}
export async function deleteLoungeMessage(sb: DB, id: number) {
  must(await sb.from('lounge_messages').delete().eq('id', id));
}
export async function unreadCounts(sb: DB, since: Record<string, string>) {
  const out: Record<string, number> = {};
  await Promise.all(Object.entries(since).map(async ([room, iso]) => {
    const { count } = await sb.from('lounge_messages').select('id', { count: 'exact', head: true }).eq('room_slug', room).gt('created_at', iso);
    out[room] = count ?? 0;
  }));
  return out;
}

// ── Search ────────────────────────────────────────────────────────────────
export async function search(sb: DB, q: string, kind: SearchKind | null) {
  const [docs, total] = await Promise.all([
    sb.rpc('search', { q, p_kind: kind ?? undefined, p_limit: 120 }),
    sb.rpc('search_total', { p_kind: kind ?? undefined }),
  ]);
  const ranked = rank(must(docs) as SearchDoc[], q);
  return { results: ranked, total: Number(must(total) ?? 0) };
}
