// fzf-style fuzzy ranking, ported from the prototypes:
// subsequence match; +8 for a consecutive char, +6 at a word start, +1 otherwise;
// small length penalty. Spaces in the query are ignored.

export interface FuzzyMatch { score: number; hits: number[] }

const WORD_START = /[\s\-—:#@(]/;

export function fuzzy(q: string, text: string): FuzzyMatch | null {
  if (!q) return { score: 0, hits: [] };
  const t = text.toLowerCase();
  let qi = 0, score = 0, last = -2;
  const hits: number[] = [];
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (q[qi] === ' ') { qi++; i--; continue; }
    if (t[i] === q[qi]) {
      hits.push(i);
      score += (i === last + 1 ? 8 : 1) + (i === 0 || WORD_START.test(t[i - 1]) ? 6 : 0);
      last = i;
      qi++;
    }
  }
  while (qi < q.length && q[qi] === ' ') qi++;
  if (qi < q.length) return null;
  return { score: score - text.length * 0.02, hits };
}

export interface Segment { text: string; hit: boolean }

/** Split text into highlighted / plain runs for rendering matched characters bold. */
export function segments(text: string, hits: number[]): Segment[] {
  const set = new Set(hits);
  const out: Segment[] = [];
  let cur: Segment | null = null;
  for (let i = 0; i < text.length; i++) {
    const hit = set.has(i);
    if (!cur || cur.hit !== hit) { cur = { text: '', hit }; out.push(cur); }
    cur.text += text[i];
  }
  return out;
}

export const SEARCH_KINDS = ['Thread', 'Article', 'Library', 'Person', 'Board', 'Society', 'Team', 'Place'] as const;
export type SearchKind = (typeof SEARCH_KINDS)[number];

/** Web palette scopes (mobile drops Articles and Societies). */
export const WEB_SCOPES: Record<string, SearchKind | null> = {
  All: null, Threads: 'Thread', Articles: 'Article', Library: 'Library', People: 'Person',
  Boards: 'Board', Societies: 'Society', Places: 'Place',
};
export const MOBILE_SCOPES: Record<string, SearchKind | null> = {
  All: null, Threads: 'Thread', Library: 'Library', People: 'Person', Boards: 'Board', Places: 'Place',
};

/** `@` people, `#` boards, `lib:` library — prefixes override the scope. */
export function parseQuery(input: string, scopeKind: SearchKind | null): { q: string; kind: SearchKind | null } {
  let q = input.trim().toLowerCase();
  let kind = scopeKind;
  if (q.startsWith('@')) { kind = 'Person'; q = q.slice(1); }
  else if (q.startsWith('#')) { kind = 'Board'; q = q.slice(1); }
  else if (q.startsWith('lib:')) { kind = 'Library'; q = q.slice(4).trim(); }
  return { q, kind };
}

export interface SearchDoc {
  kind: string; icon: string; title: string; sub: string; body: string; route: string; popularity: number;
}
export interface RankedDoc extends SearchDoc { match: FuzzyMatch; segs: Segment[] }

/** Client-side re-rank of server candidates. */
export function rank(docs: SearchDoc[], q: string, limit = 40): RankedDoc[] {
  const out: RankedDoc[] = [];
  for (const d of docs) {
    const m = fuzzy(q, d.title);
    if (m) out.push({ ...d, match: m, segs: segments(d.title, m.hits) });
  }
  if (q) out.sort((a, b) => b.match.score - a.match.score);
  return out.slice(0, limit);
}

/** "Already asked?" — word overlap between a draft title and existing titles. */
export function titleWords(title: string): string[] {
  return title.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
}
export function overlap(words: string[], title: string): number {
  const t = title.toLowerCase();
  return words.filter((w) => t.includes(w)).length;
}
