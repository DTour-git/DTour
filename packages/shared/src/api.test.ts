import { describe, expect, it, vi } from 'vitest';
import {
  DELETED_PERSON,
  atHandle,
  getBoard,
  getThread,
  hotness,
  isRateLimited,
  matchesSkills,
  nextHandleChange,
  similarThreads,
  sortReplies,
  type ReplyNode,
  type TeamCard,
} from './api';

const ago = (h: number) => new Date(Date.now() - h * 3600e3).toISOString();

describe('nextHandleChange', () => {
  it('uses the server clock even when onboarding was cleared', () => {
    const changed = ago(24);
    expect(nextHandleChange({ onboarded: false, handle_changed_at: changed })?.toISOString()).toBe(
      new Date(Date.parse(changed) + 7 * 864e5).toISOString(),
    );
  });
  it('allows a change after the cooldown expires', () => {
    expect(nextHandleChange({ onboarded: true, handle_changed_at: ago(8 * 24) })).toBeNull();
  });
  it('does not lock a profile that has never changed its handle', () => {
    expect(nextHandleChange({ onboarded: true, handle_changed_at: null })).toBeNull();
  });
});

describe('hotness', () => {
  it('prefers a fresh thread over an older one with slightly more votes', () => {
    expect(hotness({ score: 284, reply_count: 63, created_at: ago(2) })).toBeGreaterThan(
      hotness({ score: 318, reply_count: 24, created_at: ago(20) }),
    );
  });
});

const reply = (id: number, score: number, h: number, children: ReplyNode[] = []): ReplyNode => ({
  id,
  thread_id: 1,
  parent_id: null,
  body: '',
  score,
  created_at: ago(h),
  edited_at: null,
  deleted_at: null,
  children,
  myVote: 0,
  author: { id: 'u', handle: 'u', display_name: null, branch_code: null, grad_year: null, tint: 'neutral', karma: 0 },
  society: null,
});

describe('sortReplies', () => {
  const list = [reply(1, 5, 3), reply(2, 50, 2), reply(3, 1, 1)];
  it('best: accepted answer first, then by score', () => {
    expect(sortReplies(list, 'best', 3).map((r) => r.id)).toEqual([3, 2, 1]);
  });
  it('newest and oldest sort by time', () => {
    expect(sortReplies(list, 'newest', null).map((r) => r.id)).toEqual([3, 2, 1]);
    expect(sortReplies(list, 'oldest', null).map((r) => r.id)).toEqual([1, 2, 3]);
  });
  it('nested replies are always oldest first', () => {
    const [top] = sortReplies([reply(1, 0, 5, [reply(9, 0, 1), reply(8, 0, 3)])], 'best', null);
    expect(top.children.map((r) => r.id)).toEqual([8, 9]);
  });
});

describe('matchesSkills', () => {
  const team = {
    team_roles: [
      { id: 1, name: 'Frontend', filled: false, sort: 0 },
      { id: 2, name: 'ML', filled: true, sort: 1 },
    ],
  } as TeamCard;
  it('matches open roles only, case-insensitively', () => {
    expect(matchesSkills(team, ['frontend'])).toBe(true);
    expect(matchesSkills(team, ['ML'])).toBe(false);
    expect(matchesSkills(team, [])).toBe(false);
  });
});

describe('isRateLimited', () => {
  it('recognises the database rate-limit message only', () => {
    expect(isRateLimited(new Error('Slow down a little — try again in a minute.'))).toBe(true);
    expect(isRateLimited(new Error('permission denied'))).toBe(false);
    expect(isRateLimited('Slow down a little')).toBe(false);
  });
});

describe('similarThreads', () => {
  const fakeDb = (result: { data: unknown; error: unknown }) => {
    const rpc = vi.fn().mockResolvedValue(result);
    return { sb: { rpc } as never, rpc };
  };
  it('maps rows to suggestions and keeps the server order', async () => {
    const { sb, rpc } = fakeDb({
      error: null,
      data: [
        {
          kind: 'wiki',
          id: 2,
          slug: 'endsem-plan',
          title: 'End-sem plan',
          board_name: null,
          score: null,
          reply_count: null,
          editor_count: 4,
          rank: 0.9,
        },
        {
          kind: 'thread',
          id: 7,
          slug: null,
          title: 'DSA end-sem: which units?',
          board_name: 'COE · 3rd sem',
          score: 12,
          reply_count: 5,
          editor_count: null,
          rank: 0.7,
        },
      ],
    });
    expect(await similarThreads(sb, 'DSA endsem units', 2)).toEqual([
      { title: 'End-sem plan', sub: 'Wiki · 4 editors', route: '/wiki/endsem-plan' },
      { title: 'DSA end-sem: which units?', sub: 'COE · 3rd sem · 12 votes · 5 replies', route: '/t/7' },
    ]);
    expect(rpc).toHaveBeenCalledWith('similar_threads', { q: 'DSA endsem units', p_limit: 2 });
  });
  it('does not call the database for a title with no searchable words', async () => {
    const { sb, rpc } = fakeDb({ data: [], error: null });
    expect(await similarThreads(sb, 'a?')).toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('throws when the database errors', async () => {
    const { sb } = fakeDb({ data: null, error: { message: 'boom' } });
    await expect(similarThreads(sb, 'DSA endsem units')).rejects.toBeTruthy();
  });
});

describe('getBoard', () => {
  const fake = (tables: Record<string, unknown[]>) =>
    ({ from: (t: string) => ({ select: async () => ({ data: tables[t] ?? [], error: null }) }) }) as unknown as Parameters<
      typeof getBoard
    >[0];

  it('returns null for an unknown board', async () => {
    await expect(getBoard(fake({}), 'nope')).resolves.toBeNull();
  });
  it('throws a clear error when the board has no category', async () => {
    const boards = [{ id: 'b1', slug: 'x', category_id: 9, parent_id: null, sort: 0 }];
    await expect(getBoard(fake({ boards }), 'x')).rejects.toThrow(/Category 9 for board x not found/);
  });
});

describe('getThread', () => {
  // Fake client: logs when each table's request starts and ends. The thread row answers first, the rest 5 ms later.
  const fake = (thread: Record<string, unknown>) => {
    const log: string[] = [];
    const selects: Record<string, string> = {};
    const list = ['replies', 'reply_votes', 'board_members'];
    const data: Record<string, unknown> = { threads: thread, boards: [{ id: 'b1', parent_id: null }], library_items: [{ id: 3 }] };
    const from = (t: string) => {
      const q: Record<string, unknown> = { select: (s: string) => ((selects[t] = s), q) };
      for (const m of ['eq', 'neq', 'order', 'limit', 'maybeSingle']) q[m] = () => q;
      q.then = (ok: (v: unknown) => unknown, err: (e: unknown) => unknown) => {
        log.push(`start ${t}`);
        return new Promise((r) => setTimeout(r, t === 'threads' ? 0 : 5))
          .then(() => (log.push(`end ${t}`), { data: data[t] ?? (list.includes(t) ? [] : null), error: null }))
          .then(ok, err);
      };
      return q;
    };
    return { sb: { from } as unknown as Parameters<typeof getThread>[0], log, selects };
  };
  const row = (kind: string, attachment: unknown = null) => ({
    id: 1,
    kind,
    attachment,
    board: { id: 'b1' },
    author: { handle: 'a' },
    poll_options: kind === 'poll' ? [{ id: 5, label: 'Yes', sort: 0, votes: 2 }] : [],
  });
  const starts = (log: string[]) => log.filter((e) => e.startsWith('start'));

  it('loads a plain thread in one parallel round, with no poll_options or library request', async () => {
    const { sb, log, selects } = fake(row('discussion'));
    const d = await getThread(sb, 1, 'u1');
    expect(starts(log)).toHaveLength(10);
    expect(log.slice(0, 10)).toEqual(starts(log));
    expect(log.some((e) => /poll_options|library_items/.test(e))).toBe(false);
    expect(selects.threads).toContain('poll_options(*)');
    expect(d?.poll).toBeNull();
    expect(d?.related).toEqual([]);
    expect(d?.thread).not.toHaveProperty('poll_options');
  });
  it('takes poll options from the thread row and starts Related in Library before the other queries finish', async () => {
    const { sb, log } = fake(row('poll', { subject: 'CO201', library_item_id: 2 }));
    const d = await getThread(sb, 1, null);
    expect(starts(log)).toEqual(
      ['threads', 'replies', 'boards', 'wiki_articles', 'lounge_messages', 'library_items'].map((t) => `start ${t}`),
    );
    expect(log.indexOf('end threads')).toBeLessThan(log.indexOf('start library_items'));
    expect(log.indexOf('start library_items')).toBeLessThan(log.indexOf('end replies'));
    expect(d?.poll).toEqual([{ id: 5, label: 'Yes', sort: 0, votes: 2 }]);
    expect(d?.related).toEqual([{ id: 3 }]);
  });
});

describe('deleted users', () => {
  it('shows no @ before the placeholder, and one before a real handle', () => {
    expect(atHandle(DELETED_PERSON)).toBe('[deleted user]');
    expect(atHandle({ handle: 'asha' })).toBe('@asha');
  });
  it('has an empty id, so nothing links to it or matches it as a real person', () => {
    expect(DELETED_PERSON.id).toBe('');
  });
});
