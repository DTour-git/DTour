import { describe, expect, it } from 'vitest';
import { getBoard, hotness, matchesSkills, nextHandleChange, sortReplies, type ReplyNode, type TeamCard } from './api';

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
