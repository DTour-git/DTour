import { describe, expect, it } from 'vitest';
import { fuzzy, overlap, parseQuery, rank, segments, titleWords, type SearchDoc } from './fuzzy';

const doc = (title: string, kind = 'Thread'): SearchDoc => ({
  kind,
  icon: 'chat-circle',
  title,
  sub: '',
  body: '',
  route: '/t/1',
  popularity: 0,
});

describe('fuzzy', () => {
  it('matches a subsequence and returns the hit positions', () => {
    const m = fuzzy('dsa', 'DSA end-sem papers');
    expect(m).not.toBeNull();
    expect(m!.hits).toEqual([0, 1, 2]);
  });

  it('returns null when the letters are not all present in order', () => {
    expect(fuzzy('xyz', 'DSA end-sem papers')).toBeNull();
    expect(fuzzy('asd', 'dsa')).toBeNull();
  });

  it('ignores spaces in the query', () => {
    expect(fuzzy('dsa pyq', 'DSA PYQ papers')).not.toBeNull();
  });

  it('scores consecutive and word-start matches above scattered ones (+8 / +6 / +1)', () => {
    const tight = fuzzy('pyq', 'pyq sheet')!;
    const loose = fuzzy('pyq', 'paper by quiz')!;
    expect(tight.score).toBeGreaterThan(loose.score);
  });

  it('empty query matches everything with score 0', () => {
    expect(fuzzy('', 'anything')).toEqual({ score: 0, hits: [] });
  });
});

describe('segments', () => {
  it('splits text into hit and non-hit runs', () => {
    expect(segments('abcd', [1, 2])).toEqual([
      { text: 'a', hit: false },
      { text: 'bc', hit: true },
      { text: 'd', hit: false },
    ]);
  });
});

describe('parseQuery', () => {
  it('@ scopes to people, # to boards, lib: to library', () => {
    expect(parseQuery('@riya', null)).toEqual({ q: 'riya', kind: 'Person' });
    expect(parseQuery('#placements', null)).toEqual({ q: 'placements', kind: 'Board' });
    expect(parseQuery('lib: co201', null)).toEqual({ q: 'co201', kind: 'Library' });
  });

  it('keeps the chosen scope when there is no prefix', () => {
    expect(parseQuery('  DSA ', 'Thread')).toEqual({ q: 'dsa', kind: 'Thread' });
  });
});

describe('rank', () => {
  it('drops non-matches and sorts best match first', () => {
    const out = rank([doc('Mess menu changed'), doc('DSA end-sem PYQs'), doc('Data structures and algorithms')], 'dsa');
    expect(out.map((r) => r.title)).toEqual(['DSA end-sem PYQs', 'Data structures and algorithms']);
    expect(out[0].segs[0]).toEqual({ text: 'DSA', hit: true });
  });

  it('keeps server order for an empty query', () => {
    const out = rank([doc('B'), doc('A')], '');
    expect(out.map((r) => r.title)).toEqual(['B', 'A']);
  });
});

describe('Already asked? helpers', () => {
  it('titleWords keeps words longer than 2 characters', () => {
    expect(titleWords('Is the DSA end-sem hard?')).toEqual(['the', 'dsa', 'end', 'sem', 'hard']);
  });
  it('overlap counts shared words', () => {
    expect(overlap(['dsa', 'notes', 'sem'], 'DSA end-sem papers')).toBe(2);
  });
});
